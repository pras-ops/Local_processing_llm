/**
 * Non-LLM cleaning using rules and regex
 * Fast, deterministic, works without model
 * All options are opt-in (default: false) - user chooses what to remove
 */

/**
 * Clean text using rule-based approach (no LLM)
 * @param {string} text - Text to clean
 * @param {Object} options - Cleaning options (all optional, default: false)
 * @param {boolean} options.removeHtml - Remove HTML tags (default: false)
 * @param {boolean} options.removeUrls - Remove URLs (default: false)
 * @param {boolean} options.removeExtraWhitespace - Remove extra whitespace (default: false)
 * @param {boolean} options.removeLineBreaks - Remove line breaks (default: false)
 * @param {boolean} options.removeSpecialChars - Remove special characters (default: false)
 * @param {boolean} options.decodeHtmlEntities - Decode HTML entities like &amp; (default: false)
 * @returns {string}
 */
export function cleanWithRules(text, options = {}) {
  const {
    removeHtml = false,
    removeUrls = false,
    removeExtraWhitespace = false,
    removeLineBreaks = false,
    removeSpecialChars = false,
    decodeHtmlEntities = false,
  } = options;

  let cleaned = text;

  // Decode HTML entities (if requested)
  if (decodeHtmlEntities) {
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }

  // Remove HTML tags (if requested)
  if (removeHtml) {
    cleaned = cleaned.replace(/<[^>]+>/g, '');
  }

  // Remove URLs (if requested)
  if (removeUrls) {
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
  }

  // Remove line breaks (if requested)
  if (removeLineBreaks) {
    cleaned = cleaned.replace(/[\r\n]+/g, ' ');
  }

  // Remove extra whitespace (if requested)
  if (removeExtraWhitespace) {
    // Replace multiple spaces with single space
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    // Remove leading/trailing whitespace from each line
    if (!removeLineBreaks) {
      cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
    }
    // Remove multiple newlines (if line breaks not removed)
    if (!removeLineBreaks) {
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    }
    // Trim overall
    cleaned = cleaned.trim();
  }

  // Remove special characters (if requested)
  if (removeSpecialChars) {
    // Keep alphanumeric, spaces, and basic punctuation
    cleaned = cleaned.replace(/[^\w\s.,!?;:()\-'"]/g, '');
  }

  return cleaned;
}

