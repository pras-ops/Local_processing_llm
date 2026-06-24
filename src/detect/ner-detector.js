import { getLogger } from "../utils/logger.js";

/**
 * NERDetector — Tier 2 PII detection with a small, local NER model.
 *
 * Runs fully on-device via transformers.js (ONNX runtime, CPU/WASM/WebGPU). The
 * model is downloaded once from the Hugging Face hub and cached locally; after
 * that it runs offline with no network and no data leaving the machine. This is
 * the preferred middle tier — far lighter than a full LLM, more capable than regex.
 *
 * transformers.js token-classification returns BIO-tagged word-pieces WITHOUT
 * character offsets, so we reconstruct entity phrases from the tokens and then
 * locate the exact substring back in the original text (value-based redaction).
 *
 * `@huggingface/transformers` is an OPTIONAL dependency, imported lazily so Tier 1
 * stays dependency-free.
 */
const DEFAULT_MODEL = {
  bert: "Xenova/bert-base-NER", // reliable PER/LOC/ORG, good default
  piiranha: "onnx-community/piiranha-v1-detect-personal-information-ONNX", // more PII types
  gliner: "onnx-community/gliner_multi_pii-v1", // zero-shot, custom labels
};

// Map model labels onto the placeholder types used by the redactor.
const LABEL_MAP = {
  PER: "NAME", PERSON: "NAME", GIVENNAME: "NAME", SURNAME: "NAME", NAME: "NAME",
  LOC: "ADDRESS", LOCATION: "ADDRESS", CITY: "ADDRESS", STREET: "ADDRESS",
  BUILDINGNUM: "ADDRESS", ZIPCODE: "ADDRESS", ADDRESS: "ADDRESS",
  ORG: "ORGANIZATION", ORGANIZATION: "ORGANIZATION",
  EMAIL: "EMAIL", TELEPHONENUM: "PHONE", SOCIALNUM: "SSN", CREDITCARDNUMBER: "CREDIT_CARD",
};

function mapLabel(raw) {
  const base = String(raw).replace(/^[BI]-/, "").toUpperCase();
  return LABEL_MAP[base] || base;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split text into <=maxChars windows, breaking on whitespace, tracking offsets. */
export function chunkWithOffsets(text, maxChars = 800) {
  if (text.length <= maxChars) return [{ chunk: text, offset: 0 }];
  const out = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + maxChars, text.length);
    if (end < text.length) {
      const ws = text.lastIndexOf(" ", end);
      if (ws > i) end = ws;
    }
    out.push({ chunk: text.slice(i, end), offset: i });
    i = end === i ? end + maxChars : end;
  }
  return out;
}

/**
 * Group BIO-tagged word-piece tokens into entity phrases.
 * Handles BERT word-pieces ("##xyz") and SentencePiece markers ("▁xyz").
 * @returns {Array<{label:string, phrase:string, score:number}>}
 */
export function groupEntities(tokens) {
  const groups = [];
  let cur = null;
  const flush = () => {
    if (cur) groups.push({ label: cur.label, phrase: cur.parts.join(""), score: cur.scoreSum / cur.n });
    cur = null;
  };

  for (const t of tokens) {
    const tag = t.entity ?? t.entity_group ?? "";
    const label = mapLabel(tag);
    const word = String(t.word ?? "");
    const isSubword = word.startsWith("##");
    const piece = isSubword ? word.slice(2) : word.replace(/^▁/, "");
    const continues = cur && cur.label === label && (tag.startsWith("I-") || isSubword);

    if (continues) {
      cur.parts.push(isSubword ? piece : " " + piece);
      cur.scoreSum += t.score ?? 1;
      cur.n += 1;
    } else {
      flush();
      cur = { label, parts: [piece], scoreSum: t.score ?? 1, n: 1 };
    }
  }
  flush();
  return groups.map((g) => ({ ...g, phrase: g.phrase.trim() }));
}

/** Find the exact substring in `text` for a reconstructed phrase (case-insensitive, flexible whitespace). */
function locate(text, phrase) {
  const parts = phrase.split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (!parts.length) return null;
  const m = text.match(new RegExp(parts.join("\\s+"), "i"));
  return m ? m[0] : null;
}

export class NERDetector {
  constructor(options = {}) {
    this.name = "ner";
    this.backend = options.backend || "bert";
    this.model = options.model || DEFAULT_MODEL[this.backend] || DEFAULT_MODEL.bert;
    this.device = options.device; // undefined => transformers.js auto-selects
    this.labels = options.labels; // for gliner zero-shot
    this.threshold = options.threshold ?? 0.5;
    this.maxChars = options.maxChars ?? 800;
    this.logger = options.logger || getLogger(options.loggerOptions);
    this.pipe = null;
  }

  isLoaded() {
    return this.pipe !== null;
  }

  getLogger() {
    return this.logger;
  }

  async load() {
    if (this.pipe) return;
    let transformers;
    try {
      transformers = await import("@huggingface/transformers");
    } catch (e) {
      throw new Error(
        "Tier 2 NER needs the optional dependency '@huggingface/transformers'. Install it: npm i @huggingface/transformers"
      );
    }
    this.logger.log("info", "NER", `Loading local NER model: ${this.model}`, { backend: this.backend });
    const opts = {};
    if (this.device) opts.device = this.device;
    this.pipe = await transformers.pipeline("token-classification", this.model, opts);
    this.logger.log("info", "NER", "NER model ready");
  }

  /**
   * @returns {Promise<Array<{value:string,type:string,score:number,source:'ner'}>>}
   */
  async detect(text, opts = {}) {
    if (!text) return [];
    if (!this.pipe) await this.load();

    const seen = new Set();
    const entities = [];

    for (const { chunk } of chunkWithOffsets(text, this.maxChars)) {
      const runOpts =
        this.backend === "gliner" && (opts.labels || this.labels)
          ? { labels: opts.labels || this.labels }
          : undefined;
      let tokens;
      try {
        tokens = await this.pipe(chunk, runOpts);
      } catch (e) {
        this.logger.log("warn", "NER", "NER inference failed on chunk", { error: e.message });
        continue;
      }

      for (const g of groupEntities(Array.isArray(tokens) ? tokens : [])) {
        if (g.score < this.threshold || g.phrase.length < 2) continue;
        const value = locate(text, g.phrase);
        if (!value || seen.has(value)) continue;
        seen.add(value);
        entities.push({ value, type: g.label, score: g.score, source: "ner" });
      }
    }
    return entities;
  }
}

export { DEFAULT_MODEL };
