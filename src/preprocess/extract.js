import { validateExtraction } from "../utils/validation.js";
import { getLogger } from "../utils/logger.js";

/**
 * Extract specific information from text
 * Uses rule-based validation to prevent hallucinations
 * @param {LLMEngine} engine - The LLM engine instance
 * @param {string} text - Text to extract from
 * @param {Object} options - Extraction options
 * @returns {Promise<string>}
 */
export async function extract(engine, text, options = {}) {
  const logger = engine.getLogger();
  
  const {
    what = "key information", // What to extract
    format = "text", // "text", "json", "list"
    fields = [], // Specific fields to extract (for JSON)
    validate = true, // Enable rule-based validation
    strict = false, // If true, throw error on validation failure
  } = options;

  // Log prompt construction
  const originalPrompt = `Extract ${what} from the following text`;
  let prompt = originalPrompt;

  if (format === "json") {
    if (fields.length > 0) {
      prompt += ` in JSON format with these fields: ${fields.join(", ")}`;
    } else {
      prompt += ` in JSON format`;
    }
  } else if (format === "list") {
    prompt += ` as a list`;
  }

  prompt += `:\n\n${text}`;

  logger.logPromptConstruction('extract', originalPrompt, prompt, options);

  // Run LLM extraction
  const llmResult = await engine.run(prompt, { temperature: 0.3 });
  const rawResult = llmResult.trim();

  logger.log('info', 'EXTRACT', 'LLM extraction completed', {
    format,
    fields,
    resultLength: rawResult.length
  });

  // Apply validation if enabled and format is JSON
  if (validate && format === "json") {
    logger.log('info', 'VALIDATION', 'Starting rule-based validation');
    
    const validation = validateExtraction(rawResult, text, {
      format,
      fields,
      strict
    });

    logger.logValidation('extract', text, validation.validated || rawResult, validation.isValid, 
      validation.error ? new Error(validation.error) : null);

    if (!validation.isValid) {
      if (strict) {
        throw new Error(`Extraction validation failed: ${validation.error}`);
      } else {
        logger.log('warn', 'VALIDATION', 'Validation failed but continuing (non-strict mode)', {
          error: validation.error,
          issues: validation.issues
        });
        // Return raw result with warning
        return rawResult;
      }
    }

    // Return validated result
    if (validation.validated) {
      logger.log('info', 'VALIDATION', 'Validation passed, returning validated data');
      return JSON.stringify(validation.validated, null, 2);
    }
  }

  return rawResult;
}

