import { getLogger } from "../utils/logger.js";
import { cleanWithRules } from "./clean-rules.js";

/**
 * Clean text by removing noise, HTML, and irrelevant content
 * Uses LLM if available, falls back to rule-based cleaning if not
 * All options are opt-in (default: false) - user chooses what to remove
 * @param {LLMEngine|null} engine - The LLM engine instance (can be null)
 * @param {string} text - Text to clean
 * @param {Object} options - Cleaning options (all optional, default: false)
 * @param {boolean} options.removeHtml - Remove HTML tags (default: false)
 * @param {boolean} options.removeUrls - Remove URLs (default: false)
 * @param {boolean} options.removeExtraWhitespace - Remove extra whitespace (default: false)
 * @param {boolean} options.removeLineBreaks - Remove line breaks (default: false)
 * @param {boolean} options.removeSpecialChars - Remove special characters (default: false)
 * @param {boolean} options.decodeHtmlEntities - Decode HTML entities like &amp; (default: false)
 * @param {string} options.customInstructions - Additional cleaning instructions (requires LLM)
 * @param {boolean} options.useLLM - Force LLM usage if model is loaded (default: auto-detect)
 * @returns {Promise<string>|string}
 */
export async function clean(engine, text, options = {}) {
  const {
    removeHtml = false,
    removeUrls = false,
    removeExtraWhitespace = false,
    removeLineBreaks = false,
    removeSpecialChars = false,
    decodeHtmlEntities = false,
    customInstructions = "",
    useLLM = null, // null = auto-detect, true = force LLM, false = force rules
  } = options;

  // Check if we should use LLM
  const shouldUseLLM = useLLM !== false && 
                       engine !== null && 
                       engine.isLoaded() && 
                       (useLLM === true || customInstructions !== "");

  if (!shouldUseLLM) {
    // Use fast rule-based cleaning (no LLM needed)
    const logger = engine?.getLogger();
    if (logger) {
      logger.log('info', 'CLEAN', 'Using rule-based cleaning (no LLM)', {
        reason: !engine ? 'No engine' : !engine.isLoaded() ? 'Model not loaded' : 'useLLM=false',
        options: { removeHtml, removeUrls, removeExtraWhitespace, removeLineBreaks, removeSpecialChars, decodeHtmlEntities }
      });
    }
    
    return cleanWithRules(text, {
      removeHtml,
      removeUrls,
      removeExtraWhitespace,
      removeLineBreaks,
      removeSpecialChars,
      decodeHtmlEntities
    });
  }

  // Use LLM for semantic cleaning (especially if customInstructions provided)
  const logger = engine.getLogger();
  
  // Build prompt based on user's selections
  const cleaningSteps = [];
  
  if (removeHtml) cleaningSteps.push('HTML tags');
  if (removeUrls) cleaningSteps.push('URLs');
  if (removeExtraWhitespace) cleaningSteps.push('extra whitespace');
  if (removeLineBreaks) cleaningSteps.push('line breaks');
  if (removeSpecialChars) cleaningSteps.push('special characters');
  if (decodeHtmlEntities) cleaningSteps.push('decode HTML entities');
  
  let originalPrompt = `Clean the following text`;
  let prompt = originalPrompt;
  
  if (cleaningSteps.length > 0) {
    prompt += ` by removing: ${cleaningSteps.join(', ')}`;
  } else if (!customInstructions) {
    // If no options selected and no custom instructions, just return text
    return text;
  }
  
  // Add instruction to preserve meaning
  prompt += `. IMPORTANT: Do NOT modify the meaning or remove important information. Only remove what was requested.`;
  
  if (customInstructions) {
    prompt += ` Also: ${customInstructions}`;
  }
  
  prompt += `:\n\n${text}`;

  logger.logPromptConstruction('clean', originalPrompt, prompt, options);
  logger.log('info', 'CLEAN', 'Using LLM-based cleaning');

  const result = await engine.run(prompt, { temperature: 0.3 });
  const cleaned = result.trim();

  logger.log('info', 'CLEAN', 'LLM cleaning completed', {
    originalLength: text.length,
    finalLength: cleaned.length
  });

  return cleaned;
}

