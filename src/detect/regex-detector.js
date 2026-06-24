/**
 * RegexDetector — Tier 1 PII detection (zero dependencies, runs anywhere).
 *
 * Extracted from the original inline logic in preprocess/redact.js. It returns
 * an ORDERED list of candidate entities `{ value, type, source }`. The order is
 * the canonical order the redactor has always used (deny → custom → creditCard →
 * ssn → apiKey → email → ip → phone, and within each type sorted longest-first),
 * so placeholder numbering stays byte-identical to previous behaviour. The actual
 * placeholder assignment / replacement still happens in redact() so it can reuse
 * the shared state map, allowList and format-preserving logic.
 */

// Luhn validation for credit card candidates.
export function isValidLuhn(number) {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let val = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      val *= 2;
      if (val > 9) val -= 9;
    }
    sum += val;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

const DEFAULT_RULES = { email: true, phone: true, ssn: true, creditCard: true, ip: true, apiKey: true };

const API_KEY_PATTERNS = [
  { name: "OPENAI_KEY", regex: /\bsk-[a-zA-Z0-9]{48}\b/g },
  { name: "JWT", regex: /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]\b/g },
  { name: "AWS_KEY", regex: /\bAKIA[A-Z0-9]{16}\b/g },
  { name: "SLACK_TOKEN", regex: /\bxox[bapr]-[0-9a-zA-Z]{10,12}-[0-9a-zA-Z]{10,12}-[0-9a-zA-Z]{24}\b/g },
];

function uniqueLongestFirst(matches) {
  return Array.from(new Set(matches)).sort((a, b) => b.length - a.length);
}

function collect(regex, text) {
  const out = [];
  let m;
  while ((m = regex.exec(text)) !== null) out.push(m[0]);
  return out;
}

export class RegexDetector {
  constructor(options = {}) {
    this.name = "regex";
  }

  /**
   * @param {string} text
   * @param {Object} opts - { rules, customPatterns, denyList }
   * @returns {Array<{value:string,type:string,source:'regex'}>} ordered entities
   */
  detect(text, opts = {}) {
    if (!text) return [];
    const rules = { ...DEFAULT_RULES, ...opts.rules };
    const customPatterns = opts.customPatterns || [];
    const denyList = opts.denyList || [];
    const entities = [];
    const push = (value, type) => entities.push({ value, type, source: "regex" });

    // 1. Deny list (exact matches), longest-first.
    for (const deniedVal of [...denyList].sort((a, b) => b.length - a.length)) {
      if (deniedVal && text.includes(deniedVal)) push(deniedVal, "CUSTOM_DENIED");
    }

    // 2. Custom regex patterns.
    for (const custom of customPatterns) {
      if (!custom.regex || !custom.name) continue;
      const regex = custom.regex.global ? custom.regex : new RegExp(custom.regex.source, custom.regex.flags + "g");
      for (const v of uniqueLongestFirst(collect(regex, text))) push(v, custom.name);
    }

    // 3. Credit cards (Luhn-validated).
    if (rules.creditCard) {
      const cands = collect(/\b\d(?:[ -]?\d){12,18}\b/g, text).filter(isValidLuhn);
      for (const v of uniqueLongestFirst(cands)) push(v, "CREDIT_CARD");
    }

    // 4. SSN (insertion order, fixed length).
    if (rules.ssn) {
      for (const v of Array.from(new Set(collect(/\b\d{3}-\d{2}-\d{4}\b/g, text)))) push(v, "SSN");
    }

    // 5. API keys / secrets.
    if (rules.apiKey) {
      const keys = [];
      for (const p of API_KEY_PATTERNS) keys.push(...collect(p.regex, text));
      for (const v of uniqueLongestFirst(keys)) push(v, "API_KEY");
    }

    // 6. Emails.
    if (rules.email) {
      const cands = collect(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, text);
      for (const v of uniqueLongestFirst(cands)) push(v, "EMAIL");
    }

    // 7. IP addresses (v4 + v6).
    if (rules.ip) {
      const ipv4 = collect(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, text);
      const ipv6 = collect(/\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:(?:[0-9a-fA-F]{1,4}:?){0,6}\b/g, text);
      for (const v of uniqueLongestFirst([...ipv4, ...ipv6])) push(v, "IP_ADDRESS");
    }

    // 8. Phone numbers.
    if (rules.phone) {
      const cands = collect(/(?:\+?\b\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, text);
      for (const v of uniqueLongestFirst(cands)) push(v, "PHONE");
    }

    return entities;
  }
}
