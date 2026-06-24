import { RegexDetector } from "./regex-detector.js";
import { NERDetector } from "./ner-detector.js";
import { LLMDetector } from "./llm-detector.js";

/**
 * DetectorRouter — runs detection tiers cheapest-first and returns a single
 * ordered list of entity candidates for the redactor to place.
 *
 * Order of the returned list matters: regex entities come first in their canonical
 * order (so Tier 1 placeholder numbering is unchanged), followed by the merged
 * semantic (NER/LLM) entities sorted longest-first to avoid substring collisions.
 */
export class DetectorRouter {
  constructor({ regexDetector, semanticDetectors = [], auto = false } = {}) {
    this.regexDetector = regexDetector || new RegexDetector();
    this.semanticDetectors = semanticDetectors;
    this.auto = auto; // in auto mode, NER failures degrade gracefully to regex-only
  }

  async detect(text, opts = {}) {
    const regexEntities = this.regexDetector ? this.regexDetector.detect(text, opts) : [];

    const semantic = [];
    for (const d of this.semanticDetectors) {
      try {
        semantic.push(...(await d.detect(text, opts)));
      } catch (e) {
        // In auto mode a missing NER dep/model must not break redaction.
        if (this.auto && d.name === "ner") {
          d.getLogger?.()?.log("warn", "NER", "NER tier unavailable, using regex only", { error: e.message });
          continue;
        }
        throw e;
      }
    }

    return [...regexEntities, ...dedupeSemantic(semantic)];
  }
}

/** Dedupe semantic entities by value (highest score wins), then longest-first. */
export function dedupeSemantic(entities) {
  const byValue = new Map();
  for (const e of entities) {
    if (!e.value) continue;
    const existing = byValue.get(e.value);
    if (!existing || (e.score ?? 0) > (existing.score ?? 0)) byValue.set(e.value, e);
  }
  return [...byValue.values()].sort((a, b) => b.value.length - a.value.length);
}

/**
 * Merge overlapping spans, keeping the strongest (longest, then highest score).
 * Utility for span-based callers; the redactor itself works value-first.
 * @param {Array<{start,end,score}>} spans
 */
export function mergeSpans(spans) {
  const sorted = [...spans].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const lenDiff = b.end - b.start - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    return (b.score ?? 0) - (a.score ?? 0);
  });
  const out = [];
  for (const s of sorted) {
    if (!out.some((k) => s.start < k.end && s.end > k.start)) out.push(s);
  }
  return out;
}

/**
 * Build a router from redact options.
 * @param {Object} engine - LLM engine (for Tier 3); may be null.
 * @param {Object} options - { tier, ner, nerDetector, llm }
 */
export function buildRouter(engine, options = {}) {
  const tier = options.tier || (options.llm?.enabled ? "llm" : "rules");
  const regexDetector = new RegexDetector();
  const semanticDetectors = [];

  if (tier === "ner" || tier === "auto") {
    semanticDetectors.push(options.nerDetector || new NERDetector(options.ner || {}));
  }
  if (tier === "llm" || options.llm?.enabled) {
    // Always add it (even if engine is null): LLMDetector.detect() throws the same
    // ModelNotLoadedError the redactor used to throw, preserving old behaviour.
    semanticDetectors.push(new LLMDetector(engine, options.llm || {}));
  }

  return new DetectorRouter({ regexDetector, semanticDetectors, auto: tier === "auto" });
}
