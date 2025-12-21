/**
 * Rule-based validation utilities
 * Prevents hallucinations by validating LLM output against source text
 */

/**
 * Validate JSON structure and parse safely
 */
export function validateJSON(text, expectedFields = []) {
  try {
    const parsed = JSON.parse(text);

    // If fields specified, check they exist
    if (expectedFields.length > 0) {
      const missingFields = expectedFields.filter(field => !(field in parsed));
      if (missingFields.length > 0) {
        return {
          isValid: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
          data: parsed
        };
      }
    }

    return {
      isValid: true,
      data: parsed
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Invalid JSON: ${error.message}`,
      data: null
    };
  }
}

/**
 * Format-specific validators
 */
const validators = {
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  phone: (value) => /^[\d\s\-\+\(\)]+$/.test(value) && value.replace(/\D/g, '').length >= 7,
  url: (value) => /^https?:\/\/.+/.test(value),
};

/**
 * Verify extracted data exists in source text
 * Prevents hallucination by checking if extracted values appear in original text
 * Now uses exact matching for structured fields and format validation
 */
export function verifyExtraction(extracted, sourceText, fields = []) {
  const sourceLower = sourceText.toLowerCase();
  const issues = [];

  if (typeof extracted === 'object' && extracted !== null) {
    // Check each field
    for (const [key, value] of Object.entries(extracted)) {
      if (fields.length > 0 && !fields.includes(key)) {
        continue; // Skip fields not in expected list
      }

      if (value && typeof value === 'string' && value.trim().length > 0) {
        const valueLower = value.toLowerCase();

        // First, try exact substring match (case-insensitive)
        let foundInSource = sourceLower.includes(valueLower);

        // If not found, try format-specific validation
        if (!foundInSource) {
          // Check if it matches expected format
          const fieldType = key.toLowerCase();
          if (validators[fieldType]) {
            if (!validators[fieldType](value)) {
              issues.push({
                field: key,
                value,
                reason: `Invalid ${fieldType} format`
              });
              continue;
            }
          }

          // For non-exact matches, try word-level matching with stricter threshold
          const words = valueLower.split(/\s+/).filter(w => w.length > 3);
          const matchedWords = words.filter(word => sourceLower.includes(word));
          const matchRatio = words.length > 0 ? matchedWords.length / words.length : 0;

          // Require at least 80% of words to match (stricter than before)
          foundInSource = matchRatio >= 0.8;
        }

        if (!foundInSource) {
          issues.push({
            field: key,
            value,
            reason: 'Value not found in source text (possible hallucination)'
          });
        }
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    extracted
  };
}

/**
 * Clean and normalize extracted values
 */
export function normalizeExtracted(extracted) {
  if (typeof extracted !== 'object' || extracted === null) {
    return extracted;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(extracted)) {
    if (typeof value === 'string') {
      // Remove common LLM artifacts
      normalized[key] = value
        .trim()
        .replace(/^["']|["']$/g, '') // Remove quotes
        .replace(/^[-•*]\s*/, '') // Remove list markers
        .trim();
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Validate extraction result with multiple checks
 */
export function validateExtraction(llmOutput, sourceText, options = {}) {
  const {
    format = 'json',
    fields = [],
    strict = true, // If true, reject if validation fails
  } = options;

  let parsed = llmOutput.trim();

  // Step 1: Parse JSON if needed
  if (format === 'json') {
    const jsonResult = validateJSON(parsed, fields);
    if (!jsonResult.isValid) {
      return {
        isValid: false,
        error: jsonResult.error,
        raw: llmOutput,
        validated: null
      };
    }
    parsed = jsonResult.data;
  }

  // Step 2: Normalize
  const normalized = normalizeExtracted(parsed);

  // Step 3: Verify against source
  const verification = verifyExtraction(normalized, sourceText, fields);

  // Step 4: Return result
  if (strict && !verification.isValid) {
    return {
      isValid: false,
      error: 'Extraction validation failed',
      issues: verification.issues,
      raw: llmOutput,
      validated: null
    };
  }

  return {
    isValid: true,
    raw: llmOutput,
    validated: normalized,
    warnings: verification.issues // Include warnings even if not strict
  };
}

