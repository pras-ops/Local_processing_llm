import { RegexDetector } from "../detect/regex-detector.js";
import { buildRouter } from "../detect/router.js";

/**
 * OcrPiiRegionDetector — finds image regions containing sensitive TEXT.
 *
 * Runs local OCR (Tesseract.js, pure WASM) to get word bounding boxes, then
 * reuses the project's text PII engine to decide which words are sensitive, and
 * returns their boxes for blurring. Fully local; tesseract.js is an OPTIONAL,
 * lazily-imported dependency.
 */

/**
 * Extract word-level {text, bbox, confidence} from a Tesseract result.
 * Prefers the always-present TSV output (stable across tesseract.js versions);
 * falls back to walking data.blocks / data.words if TSV is missing.
 */
function wordsFromTSV(tsv) {
  const words = [];
  for (const line of tsv.split("\n")) {
    const cols = line.split("\t");
    if (cols.length < 12 || cols[0] !== "5") continue; // level 5 = word
    const left = +cols[6], top = +cols[7], width = +cols[8], height = +cols[9];
    const confidence = +cols[10];
    const text = cols.slice(11).join("\t");
    if (!text || !text.trim()) continue;
    words.push({ text, confidence, bbox: { x0: left, y0: top, x1: left + width, y1: top + height } });
  }
  return words;
}

function collectWords(data) {
  if (typeof data?.tsv === "string" && data.tsv.length) {
    const fromTsv = wordsFromTSV(data.tsv);
    if (fromTsv.length) return fromTsv;
  }
  if (Array.isArray(data?.words) && data.words.length) return data.words;
  const words = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.bbox && typeof node.text === "string" && !node.lines && !node.words && !node.paragraphs) {
      words.push(node);
    }
    for (const key of ["blocks", "paragraphs", "lines", "words"]) {
      if (Array.isArray(node[key])) node[key].forEach(walk);
    }
  };
  (data?.blocks || []).forEach(walk);
  return words;
}

function boxFromBBox(bbox) {
  return { x: bbox.x0, y: bbox.y0, w: bbox.x1 - bbox.x0, h: bbox.y1 - bbox.y0, source: "ocr" };
}

export class OcrPiiRegionDetector {
  constructor(options = {}) {
    this.name = "ocr";
    this.lang = options.lang || "eng";
    this.minConfidence = options.minConfidence ?? 30;
    this.regex = new RegexDetector();
    this.worker = null;
  }

  // Lazily create and cache a Tesseract worker (loading lang data once).
  async _getWorker() {
    if (this.worker) return this.worker;
    let Tesseract;
    try {
      Tesseract = (await import("tesseract.js")).default ?? (await import("tesseract.js"));
    } catch (e) {
      throw new Error("OCR needs the optional dependency 'tesseract.js'. Install it: npm i tesseract.js");
    }
    this.worker = await Tesseract.createWorker(this.lang);
    return this.worker;
  }

  /** Free the worker (e.g. on proxy shutdown). */
  async dispose() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * @param {Buffer|string} imageInput - buffer or path
   * @param {Object} opts - text-detection options ({ tier, rules, ... })
   * @returns {Promise<Array<{x,y,w,h,source}>>}
   */
  async detect(imageInput, opts = {}) {
    const worker = await this._getWorker();
    // The module-level recognize() omits structural output; the worker API must
    // be told which formats to emit (blocks/tsv carry word bounding boxes).
    const { data } = await worker.recognize(imageInput, {}, { blocks: true, tsv: true, text: true });
    const words = collectWords(data).filter((w) => (w.confidence ?? 100) >= this.minConfidence);
    if (!words.length) return [];

    // Detect PII over the full OCR text (catches multi-word entities like names via NER).
    const fullText = words.map((w) => w.text).join(" ");
    const router = buildRouter(opts.engine || null, { ...opts, tier: opts.tier || "rules" });
    const entityValues = (await router.detect(fullText, opts)).map((e) => e.value);

    const regions = [];
    for (const w of words) {
      const wt = (w.text || "").trim();
      if (wt.length < 2) continue;
      const directHit = this.regex.detect(wt, opts).length > 0; // emails/SSNs/cards in a single token
      const partOfEntity = entityValues.some((v) => v.includes(wt));
      if (directHit || partOfEntity) regions.push(boxFromBBox(w.bbox));
    }
    return regions;
  }
}
