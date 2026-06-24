import { cleanWithRules } from "../preprocess/clean-rules.js";
import { compressJSON } from "./json-compress.js";

/**
 * Rule-based, safe text compression — reduces tokens sent to an LLM without
 * losing meaning. Zero AI, zero dependencies, runs anywhere. Content-type aware:
 *   json -> structural minify (optionally prune empties)
 *   html -> strip tags + decode entities + collapse whitespace
 *   text -> collapse whitespace + dedupe adjacent duplicate lines
 *
 * (Aggressive/semantic compression is intentionally out of scope — that would
 * need a model and risks changing the answer.)
 */

/** Cheap content-type sniff. */
export function detectType(input) {
  const s = String(input).trim();
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try {
      JSON.parse(s);
      return "json";
    } catch {
      /* not valid json */
    }
  }
  if (/<\/?[a-z][\s\S]*>/i.test(s)) return "html";
  return "text";
}

function dedupeAdjacentLines(text) {
  const lines = text.split("\n");
  const out = [];
  for (const line of lines) {
    if (out.length === 0 || out[out.length - 1] !== line) out.push(line);
  }
  return out.join("\n");
}

function compressText(text) {
  const collapsed = text
    .replace(/[ \t]+/g, " ") // runs of spaces/tabs -> single space
    .replace(/ *\n/g, "\n") // trailing spaces before newline
    .replace(/\n{3,}/g, "\n\n") // 3+ blank lines -> one
    .trim();
  return dedupeAdjacentLines(collapsed);
}

/**
 * @param {string|object} input
 * @param {Object} opts - { type?: 'json'|'html'|'text', dropEmpty?: boolean }
 * @returns {{ compressed: string, before: number, after: number, ratio: number, type: string }}
 */
export function compress(input, opts = {}) {
  const original = typeof input === "string" ? input : JSON.stringify(input);
  const type = opts.type || detectType(original);

  let compressed;
  if (type === "json") {
    compressed = compressJSON(input, opts);
  } else if (type === "html") {
    compressed = cleanWithRules(original, {
      removeHtml: true,
      decodeHtmlEntities: true,
      removeExtraWhitespace: true,
    });
  } else {
    compressed = compressText(original);
  }

  const before = original.length;
  const after = compressed.length;
  return { compressed, before, after, ratio: after / Math.max(1, before), type };
}
