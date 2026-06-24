import { buildRouter } from "../detect/router.js";

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Masking helpers for format-preserving redaction
function maskValue(value, type) {
  switch (type) {
    case "EMAIL": {
      if (!value.includes('@')) return "XXXX@XXXX.XXX";
      const [local, domain] = value.split('@');
      const maskedLocal = local.length > 2
        ? local[0] + 'X'.repeat(local.length - 2) + local[local.length - 1]
        : 'X'.repeat(local.length);
      return `${maskedLocal}@${domain}`;
    }
    case "PHONE": {
      let digitCount = 0;
      return value.replace(/\d/g, (char) => {
        digitCount++;
        return digitCount > 5 ? 'X' : char;
      });
    }
    case "CREDIT_CARD": {
      const digits = value.replace(/\D/g, "");
      let digitCount = 0;
      return value.replace(/\d/g, (char) => {
        digitCount++;
        return (digitCount > 4 && digitCount <= digits.length - 4) ? 'X' : char;
      });
    }
    case "SSN": {
      let digitCount = 0;
      return value.replace(/\d/g, (char) => {
        digitCount++;
        return digitCount <= 5 ? 'X' : char;
      });
    }
    case "IP_ADDRESS": {
      if (value.includes('.')) {
        const parts = value.split('.');
        return `${parts[0]}.${parts[1]}.X.X`;
      } else {
        const parts = value.split(':');
        return `${parts[0]}:${parts[1]}:XXXX:XXXX:XXXX:XXXX:XXXX:XXXX`;
      }
    }
    case "API_KEY": {
      if (value.length <= 8) return "XXXX";
      return value.substring(0, 4) + 'X'.repeat(8) + value.substring(value.length - 4);
    }
    default:
      return "XXXX";
  }
}

// Default options
const DEFAULT_OPTIONS = {
  rules: {
    email: true,
    phone: true,
    ssn: true,
    creditCard: true,
    ip: true,
    apiKey: true
  },
  llm: {
    enabled: false,
    names: true,
    addresses: true,
    organizations: true
  },
  customPatterns: [],
  allowList: [],
  denyList: [],
  formatPreserving: false
};

/**
 * Redact sensitive PII data locally using a tiered detector pipeline:
 *   Tier 1 regex (always) -> Tier 2 local NER (optional) -> Tier 3 LLM (optional)
 *
 * @param {Object|null} engine - LLM engine wrapper (only used for the LLM tier)
 * @param {string} text - Input text to redact
 * @param {Object} options - Redaction configuration
 * @param {('rules'|'ner'|'llm'|'auto')} [options.tier] - Detection tier (default 'rules')
 * @returns {Promise<{redacted: string, map: Object}>}
 */
export async function redact(engine, text, options = {}) {
  if (!text) {
    return { redacted: "", map: {} };
  }

  // Merge options deeply
  const rules = { ...DEFAULT_OPTIONS.rules, ...options.rules };
  const llm = { ...DEFAULT_OPTIONS.llm, ...options.llm };
  const customPatterns = options.customPatterns || DEFAULT_OPTIONS.customPatterns;
  const allowList = options.allowList || DEFAULT_OPTIONS.allowList;
  const denyList = options.denyList || DEFAULT_OPTIONS.denyList;
  const formatPreserving = options.formatPreserving !== undefined ? options.formatPreserving : DEFAULT_OPTIONS.formatPreserving;

  // Support shared state for multi-message / conversational context
  const state = options.state || { map: {}, reverseMap: {}, placeholderCounts: {} };
  const map = state.map || {};
  const reverseMap = state.reverseMap || {};
  const placeholderCounts = state.placeholderCounts || {};

  const checkAllowed = (val) => {
    return allowList.some(item => item.toLowerCase() === val.toLowerCase());
  };

  function getPlaceholder(value, type) {
    if (reverseMap[value]) {
      return reverseMap[value];
    }
    placeholderCounts[type] = (placeholderCounts[type] || 0) + 1;

    let placeholder;
    if (formatPreserving) {
      const masked = maskValue(value, type);
      placeholder = `{{${type.toUpperCase()}_${placeholderCounts[type]}:${masked}}}`;
    } else {
      placeholder = `{{${type.toUpperCase()}_${placeholderCounts[type]}}}`;
    }

    map[placeholder] = value;
    reverseMap[value] = placeholder;
    return placeholder;
  }

  // Run the tiered detector pipeline. Regex entities come first in canonical order
  // (preserving placeholder numbering); semantic (NER/LLM) entities follow,
  // deduped and longest-first.
  const router = buildRouter(engine, {
    tier: options.tier,
    rules,
    customPatterns,
    denyList,
    llm,
    ner: options.ner,
    nerDetector: options.nerDetector,
    labels: options.labels,
  });

  const entities = await router.detect(text, { rules, customPatterns, denyList, labels: options.labels });

  let redactedText = text;
  for (const ent of entities) {
    const value = ent.value;
    if (!value || checkAllowed(value)) continue;
    // Tier 1 regex values were matched against the original text and are replaced
    // unconditionally (as before). Semantic values are only applied if still present
    // (a longer overlapping entity may have already consumed them).
    if (ent.source !== "regex" && !redactedText.includes(value)) continue;
    const placeholder = getPlaceholder(value, ent.type);
    redactedText = redactedText.replaceAll(value, placeholder);
  }

  return { redacted: redactedText, map };
}

/**
 * Restore redacted placeholders in a response with their original values
 * @param {string} text - The response containing placeholders
 * @param {Object} map - Bidirectional map returned from redact()
 * @returns {string}
 */
export function restore(text, map) {
  if (!text) return "";
  if (!map || Object.keys(map).length === 0) return text;

  let restored = text;

  // Sort placeholders by length descending to prevent short matches replacing long placeholders
  const placeholders = Object.keys(map).sort((a, b) => b.length - a.length);

  for (const placeholder of placeholders) {
    const originalValue = map[placeholder];
    const inner = placeholder.replace(/[{}]/g, "").trim();
    // Escape special characters so format-preserved parts like (555) work correctly in RegExp
    const regex = new RegExp(`\\{\\{\\s*${escapeRegExp(inner)}\\s*\\}\\}`, "gi");
    // Use the function form so `$` sequences in the original value (e.g. "$&", "$1")
    // are inserted literally instead of being treated as replacement patterns.
    restored = restored.replace(regex, () => originalValue);
  }

  return restored;
}
