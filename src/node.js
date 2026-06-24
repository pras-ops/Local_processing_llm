/**
 * Node.js entry point for RedactKit.
 *
 * Unlike the default (browser) entry, this does NOT pull in WebLLM/WebGPU. It
 * exposes the server/CLI pieces and the pure preprocessing functions so the
 * privacy layer can run as a local proxy, a CLI, or an embedded library in any
 * Node service. Use OllamaEngine for the optional Tier 2 (local LLM NER).
 */
export { createProxyServer, startProxy, ALL_FORMATS } from "./server/proxy.js";
export { MapStore } from "./server/store.js";
export { OllamaEngine } from "./engines/ollama.js";

// Tiered detection pipeline (regex -> NER -> LLM).
export { RegexDetector } from "./detect/regex-detector.js";
export { NERDetector } from "./detect/ner-detector.js";
export { LLMDetector } from "./detect/llm-detector.js";
export { DetectorRouter, buildRouter, mergeSpans } from "./detect/router.js";

// Rule-based compression (token reduction, no AI).
export { compress, detectType } from "./compress/compress.js";
export { compressJSON, prune } from "./compress/json-compress.js";

// Image sanitization (blur PII text + faces). One-way / not reversible.
export { ImageSanitizer } from "./image/sanitizer.js";
export { OcrPiiRegionDetector } from "./image/ocr-region-detector.js";
export { FaceRegionDetector } from "./image/face-region-detector.js";
export { blurRegions, recompress } from "./image/blur.js";

// Pure, engine-agnostic preprocessing (work with engine = null = rules only).
export { redact, restore } from "./preprocess/redact.js";
export { clean } from "./preprocess/clean.js";
export { cleanWithRules } from "./preprocess/clean-rules.js";
export { chunk } from "./preprocess/chunk.js";
export { extract } from "./preprocess/extract.js";

// The Preprocessor class also works in Node when given an injected engine:
//   new Preprocessor({ engine: new OllamaEngine() })
export { Preprocessor } from "./index.js";
