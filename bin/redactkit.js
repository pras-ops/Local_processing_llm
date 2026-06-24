#!/usr/bin/env node
/**
 * redactkit — local CLI for RedactKit.
 *
 * Commands:
 *   serve     Start the local PII-shielding reverse proxy.
 *   redact    Redact PII in a file (rules, optional local LLM via Ollama).
 *   restore   Restore a redacted file using a saved map.
 *   clean     Rule-based text cleaning (HTML/URLs/whitespace...).
 *
 * Everything runs locally. With --engine ollama it uses a local Ollama model
 * for Tier 2 NER; otherwise it is pure regex with zero downloads.
 */
import fs from "node:fs";
import {
  startProxy,
  OllamaEngine,
  NERDetector,
  redact,
  restore,
  cleanWithRules,
  compress,
  ImageSanitizer,
} from "../src/node.js";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true; // boolean flag
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(tok);
    }
  }
  return args;
}

function readInput(file) {
  if (!file || file === "-") return fs.readFileSync(0, "utf8"); // stdin
  return fs.readFileSync(file, "utf8");
}

function writeOutput(out, text) {
  if (!out || out === "-") process.stdout.write(text.endsWith("\n") ? text : text + "\n");
  else fs.writeFileSync(out, text);
}

// Resolve the detection tier. --tier wins; legacy --engine ollama maps to 'llm'.
function resolveTier(args) {
  if (args.tier) return args.tier;
  if ((args.engine || "rules") === "ollama") return "llm";
  return "rules";
}

/**
 * Build the detection setup for a tier:
 *   rules -> regex only (no deps)
 *   ner   -> regex + local NER (transformers.js); model loaded eagerly
 *   auto  -> regex + NER if available, otherwise regex only (graceful)
 *   llm   -> regex + local LLM (Ollama)
 * Returns { engine, tier, redactOptions }.
 */
async function buildDetection(args) {
  const tier = resolveTier(args);
  const redactOptions = { tier, formatPreserving: !!args["format-preserving"] };
  let engine = null;

  if (tier === "llm") {
    engine = new OllamaEngine({ baseUrl: args["ollama-url"], model: args.model || "llama3.2" });
    await engine.loadModel();
    redactOptions.llm = { enabled: true };
  }

  if (tier === "ner" || tier === "auto") {
    const labels = args.labels ? String(args.labels).split(",").map((s) => s.trim()) : undefined;
    const ner = new NERDetector({
      backend: args["ner-backend"] || "bert",
      model: args["ner-model"],
      device: args.device,
      threshold: args.threshold ? Number(args.threshold) : undefined,
      labels,
    });
    if (labels) redactOptions.labels = labels;
    redactOptions.ner = { backend: ner.backend, model: ner.model };
    try {
      await ner.load();
      redactOptions.nerDetector = ner; // preload once; reused per request
    } catch (e) {
      if (tier === "ner") throw e; // surface missing dep / model for explicit NER
      console.error(`NER unavailable, falling back to regex only: ${e.message}`);
    }
  }

  return { engine, tier, redactOptions };
}

const HELP = `redactkit — local PII redaction proxy & CLI

Detection tiers (--tier):
  rules   regex only — zero deps, runs anywhere (DEFAULT)
  ner     regex + local NER model (bert-base-NER default; via @huggingface/transformers)
  auto    regex + NER if available, else regex only (graceful)
  llm     regex + local LLM (Ollama)

Usage:
  redactkit serve    [--port 8787] [--host 127.0.0.1] [--upstream https://api.openai.com]
                      [--tier rules|ner|auto|llm] [--ttl 3600] [--format-preserving]
                      [--format openai,anthropic,responses,gemini]  (default: all)
                      [--compress] [--blur-images [--faces] [--ocr-lang eng] [--pixelate]]
                      NER:  [--ner-backend bert|piiranha|gliner] [--ner-model <hf-id>]
                            [--device cpu|wasm|webgpu] [--threshold 0.5] [--labels "person,address"]
                      LLM:  [--model llama3.2] [--ollama-url http://localhost:11434]
  redactkit redact   <file|-> [--out file] [--map mapfile.json] [--tier ...] [--format-preserving]
  redactkit restore  <file|-> --map mapfile.json [--out file]
  redactkit clean    <file|-> [--out file] [--html] [--urls] [--ws] [--linebreaks] [--special] [--entities]
  redactkit compress <file|-> [--out file] [--type json|html|text] [--drop-empty]
  redactkit blur     <image> [--out file] [--text-pii] [--faces] [--pixelate]
                      [--ocr-lang eng] [--tier rules|ner] [--sigma 12] [--compress]
                      (needs optional deps: sharp, tesseract.js; image blur is NOT reversible)

Point your LLM client's base URL at the proxy, e.g. OPENAI_BASE_URL=http://localhost:8787/v1
`;

async function cmdServe(args) {
  const { engine, tier, redactOptions } = await buildDetection(args);
  const upstream = args.upstream || "https://api.openai.com";

  // Optional image sanitization for vision requests.
  let imageSanitizer = null;
  if (args["blur-images"]) {
    imageSanitizer = new ImageSanitizer({
      textPII: true,
      faces: !!args.faces,
      ocr: { lang: args["ocr-lang"] },
      face: { model: args["face-model"] },
    });
  }

  const formats = args.format ? String(args.format).split(",").map((s) => s.trim()) : undefined;

  const server = await startProxy({
    port: args.port ? Number(args.port) : 8787,
    host: args.host || "127.0.0.1",
    upstream,
    engine,
    ttlMs: args.ttl ? Number(args.ttl) * 1000 : undefined,
    redactOptions,
    formats,
    compress: !!args.compress,
    imageSanitizer,
    sanitizeOpts: { tier: redactOptions.tier, pixelate: !!args.pixelate, compress: !!args["image-compress"] },
  });
  const addr = server.address();
  const detail = tier === "llm" ? ` (${args.model || "llama3.2"})` : tier === "ner" || tier === "auto" ? ` (${redactOptions.ner?.backend})` : "";
  console.error(
    `redactkit proxy listening on http://${addr.address}:${addr.port} → ${upstream}` +
      `\n  tier: ${tier}${detail}` +
      `\n  compress: ${!!args.compress}   blur-images: ${!!args["blur-images"]}${args.faces ? " (+faces)" : ""}` +
      `\n  point your client base URL here (append the provider's path, e.g. /v1)`
  );
}

function cmdCompress(args) {
  const text = readInput(args._[0]);
  const { compressed, before, after, ratio, type } = compress(text, {
    type: args.type,
    dropEmpty: !!args["drop-empty"],
  });
  writeOutput(args.out, compressed);
  console.error(`Compressed (${type}): ${before} → ${after} chars (${(ratio * 100).toFixed(0)}% of original).`);
}

async function cmdBlur(args) {
  const inPath = args._[0];
  if (!inPath || inPath === "-") throw new Error("blur requires an image file path");
  const buf = fs.readFileSync(inPath);

  // Default: text-PII on, faces off (faces needs a model). Flags override.
  const anySpecified = args["text-pii"] || args.faces;
  const sanitizer = new ImageSanitizer({
    textPII: anySpecified ? !!args["text-pii"] : true,
    faces: !!args.faces,
    graceful: true,
    ocr: { lang: args["ocr-lang"] },
    face: { model: args["face-model"] },
  });

  const { image, regions } = await sanitizer.sanitize(buf, {
    tier: args.tier || "rules",
    pixelate: !!args.pixelate,
    sigma: args.sigma ? Number(args.sigma) : undefined,
    compress: !!args.compress,
  });

  const out = args.out || inPath.replace(/(\.[^.]+)?$/, ".sanitized$1");
  fs.writeFileSync(out, image);
  await sanitizer.ocr?.dispose?.();
  console.error(`Blurred ${regions.length} sensitive region(s) → ${out}`);
}

async function cmdRedact(args) {
  const { engine, redactOptions } = await buildDetection(args);
  const text = readInput(args._[0]);
  const { redacted, map } = await redact(engine, text, redactOptions);
  if (args.map) fs.writeFileSync(args.map, JSON.stringify(map, null, 2));
  writeOutput(args.out, redacted);
  console.error(`Redacted ${Object.keys(map).length} item(s).${args.map ? ` Map → ${args.map}` : ""}`);
}

async function cmdRestore(args) {
  if (!args.map) throw new Error("restore requires --map <mapfile.json>");
  const text = readInput(args._[0]);
  const map = JSON.parse(fs.readFileSync(args.map, "utf8"));
  writeOutput(args.out, restore(text, map));
}

function cmdClean(args) {
  const text = readInput(args._[0]);
  const cleaned = cleanWithRules(text, {
    removeHtml: !!args.html,
    removeUrls: !!args.urls,
    removeExtraWhitespace: !!args.ws,
    removeLineBreaks: !!args.linebreaks,
    removeSpecialChars: !!args.special,
    decodeHtmlEntities: !!args.entities,
  });
  writeOutput(args.out, cleaned);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);

  if (!command || command === "help" || args.help) {
    process.stdout.write(HELP);
    return;
  }

  switch (command) {
    case "serve":
      return cmdServe(args);
    case "redact":
      return cmdRedact(args);
    case "restore":
      return cmdRestore(args);
    case "clean":
      return cmdClean(args);
    case "compress":
      return cmdCompress(args);
    case "blur":
      return cmdBlur(args);
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exitCode = 1;
});
