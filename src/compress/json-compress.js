/**
 * Structural JSON compaction (SmartCrusher-lite).
 *
 * Lossless by default: parse and re-stringify without whitespace. With
 * `dropEmpty`, also prune null/undefined/""/[]/{} values (semantically empty),
 * which is safe for most LLM payloads and saves more tokens.
 */

function isEmpty(v) {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

/** Recursively remove semantically-empty values. */
export function prune(value) {
  if (Array.isArray(value)) {
    const arr = value.map(prune).filter((v) => !isEmpty(v));
    return arr;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const pv = prune(v);
      if (!isEmpty(pv)) out[k] = pv;
    }
    return out;
  }
  return value;
}

/**
 * @param {string|object} input - JSON string or already-parsed object.
 * @param {Object} opts - { dropEmpty }
 * @returns {string} minified JSON
 */
export function compressJSON(input, opts = {}) {
  const obj = typeof input === "string" ? JSON.parse(input) : input;
  const result = opts.dropEmpty ? prune(obj) : obj;
  return JSON.stringify(result);
}
