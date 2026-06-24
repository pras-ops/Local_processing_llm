import http from "node:http";
import { redact, restore } from "../preprocess/redact.js";
import { compress } from "../compress/compress.js";
import { getLogger } from "../utils/logger.js";
import { MapStore } from "./store.js";

// Hop-by-hop / length headers we must not forward verbatim.
const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding", // force identity so we can restore text in the response
  "transfer-encoding",
]);
const STRIP_RESPONSE_HEADERS = new Set([
  "content-length", // length changes after restore
  "content-encoding",
  "transfer-encoding",
  "connection",
]);

/** All provider request formats the proxy knows how to redact. */
export const ALL_FORMATS = ["openai", "anthropic", "responses", "gemini"];

/**
 * Redact PII (and optionally compress) text inside a parsed LLM request body.
 * Format-aware: OpenAI Chat Completions, Anthropic Messages, OpenAI Responses API,
 * and Gemini generateContent. `formats` is a Set selecting which to process
 * (omit/undefined = all). Mutates bodyObj in place; the map lives in `state.map`.
 */
async function redactRequestBody(engine, bodyObj, redactOptions, state, compressOn, formats) {
  const opts = { ...redactOptions, state };
  const on = (f) => !formats || formats.has(f);
  const doText = async (t) => {
    let r = (await redact(engine, t, opts)).redacted;
    if (compressOn) r = compress(r).compressed; // redact -> compress -> forward
    return r;
  };
  // Redact text-bearing parts inside a content array (OpenAI/Anthropic/Responses blocks).
  const TEXT_PART_TYPES = new Set(["text", "input_text", "output_text"]);
  const doParts = async (parts) => {
    for (const part of parts) {
      if (part && TEXT_PART_TYPES.has(part.type) && typeof part.text === "string") {
        part.text = await doText(part.text);
      }
    }
  };

  // OpenAI Chat Completions + Anthropic Messages both use messages[].
  if ((on("openai") || on("anthropic")) && Array.isArray(bodyObj.messages)) {
    for (const msg of bodyObj.messages) {
      if (typeof msg.content === "string") msg.content = await doText(msg.content);
      else if (Array.isArray(msg.content)) await doParts(msg.content);
    }
  }

  // Anthropic system prompt: string OR array of text blocks.
  if (on("anthropic")) {
    if (typeof bodyObj.system === "string") bodyObj.system = await doText(bodyObj.system);
    else if (Array.isArray(bodyObj.system)) await doParts(bodyObj.system);
  }

  // OpenAI Responses API: input (string | array of items) + instructions.
  if (on("responses")) {
    if (typeof bodyObj.input === "string") bodyObj.input = await doText(bodyObj.input);
    else if (Array.isArray(bodyObj.input)) {
      for (const item of bodyObj.input) {
        if (typeof item?.content === "string") item.content = await doText(item.content);
        else if (Array.isArray(item?.content)) await doParts(item.content);
      }
    }
    if (typeof bodyObj.instructions === "string") bodyObj.instructions = await doText(bodyObj.instructions);
  }

  // Gemini generateContent: contents[].parts[].text + systemInstruction.
  if (on("gemini")) {
    const redactGeminiContents = async (arr) => {
      for (const c of arr) {
        if (Array.isArray(c?.parts)) {
          for (const part of c.parts) {
            if (typeof part?.text === "string") part.text = await doText(part.text);
          }
        }
      }
    };
    if (Array.isArray(bodyObj.contents)) await redactGeminiContents(bodyObj.contents);
    const sys = bodyObj.systemInstruction || bodyObj.system_instruction;
    if (sys && Array.isArray(sys.parts)) {
      for (const part of sys.parts) {
        if (typeof part?.text === "string") part.text = await doText(part.text);
      }
    }
  }

  // Legacy OpenAI completions prompt.
  if (on("openai") && typeof bodyObj.prompt === "string") bodyObj.prompt = await doText(bodyObj.prompt);
}

/** Sanitize (blur) base64 images embedded in a vision request body. One-way. */
async function sanitizeImagesInBody(bodyObj, sanitizer, opts = {}) {
  if (!sanitizer || !Array.isArray(bodyObj.messages)) return;

  const sanitizeDataUrl = async (url) => {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(url);
    if (!m) return url;
    const { image } = await sanitizer.sanitize(Buffer.from(m[2], "base64"), opts);
    const mime = opts.compress ? "image/jpeg" : m[1];
    return `data:${mime};base64,${image.toString("base64")}`;
  };

  for (const msg of bodyObj.messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      // OpenAI vision: { type:'image_url', image_url:{ url:'data:image/...;base64,...' } }
      if (part?.type === "image_url" && typeof part.image_url?.url === "string" && part.image_url.url.startsWith("data:image")) {
        part.image_url.url = await sanitizeDataUrl(part.image_url.url);
      }
      // Anthropic vision: { type:'image', source:{ type:'base64', media_type, data } }
      else if (part?.type === "image" && part.source?.type === "base64" && typeof part.source.data === "string") {
        const { image } = await sanitizer.sanitize(Buffer.from(part.source.data, "base64"), opts);
        part.source.data = image.toString("base64");
        if (opts.compress) part.source.media_type = "image/jpeg";
      }
    }
  }
}

/**
 * Pipe an upstream (web) ReadableStream to a Node response, restoring PII
 * placeholders as text flows through. Uses a look-back buffer so a placeholder
 * split across two chunks is never emitted half-restored.
 */
async function pipeWithRestore(upstreamBody, res, map) {
  if (!upstreamBody) {
    res.end();
    return;
  }
  let buffer = "";
  const decoder = new TextDecoder();

  for await (const chunk of upstreamBody) {
    buffer += decoder.decode(chunk, { stream: true });

    // Hold back a trailing fragment if it looks like an unfinished placeholder.
    let lastBrace = buffer.lastIndexOf("{");
    if (lastBrace > 0 && buffer[lastBrace - 1] === "{") lastBrace -= 1;

    let emitStr = buffer;
    let keepStr = "";
    if (lastBrace !== -1 && lastBrace > buffer.length - 60) {
      const remaining = buffer.substring(lastBrace);
      if (!remaining.includes("}}")) {
        emitStr = buffer.substring(0, lastBrace);
        keepStr = remaining;
      }
    }

    if (emitStr) res.write(restore(emitStr, map));
    buffer = keepStr;
  }

  if (buffer) res.write(restore(buffer, map));
  res.end();
}

/**
 * Create a local PII-shielding reverse proxy.
 *
 * Point your LLM client's base URL at this server (e.g. http://localhost:8787).
 * Outgoing prompts are redacted before leaving the machine; responses are
 * restored locally. Redaction maps stay in a local MapStore (never persisted,
 * never sent upstream).
 *
 * @param {Object} options
 * @param {string} [options.upstream="https://api.openai.com"] - Provider base URL.
 * @param {Object} [options.engine] - Optional Tier 2 engine (e.g. OllamaEngine).
 * @param {Object} [options.redactOptions] - Passed through to redact().
 * @param {MapStore} [options.store] - Map store (created if omitted).
 * @param {number} [options.ttlMs] - TTL for stored maps.
 * @param {Function} [options.fetch] - fetch impl (defaults to global fetch).
 * @param {string[]} [options.formats] - Provider request formats to redact (see ALL_FORMATS); default all.
 * @param {boolean} [options.compress] - Compress text after redaction.
 * @param {Object} [options.imageSanitizer] - ImageSanitizer for vision requests (one-way blur).
 * @param {Object} [options.logger]
 * @returns {http.Server}
 */
export function createProxyServer(options = {}) {
  const upstream = (options.upstream || "https://api.openai.com").replace(/\/+$/, "");
  const engine = options.engine || null;
  const logger = options.logger || getLogger(options.loggerOptions);
  const store = options.store || new MapStore({ ttlMs: options.ttlMs });
  const doFetch = options.fetch || globalThis.fetch;
  const compressOn = !!options.compress;
  const imageSanitizer = options.imageSanitizer || null;
  const sanitizeOpts = options.sanitizeOpts || {};
  // Which provider request formats to redact (default: all).
  const formats = Array.isArray(options.formats) && options.formats.length ? new Set(options.formats) : null;

  // Detection options (incl. `tier`, `ner`, `nerDetector`, `llm`) flow straight
  // through to redact(). For backwards compat: if no explicit tier is set but a
  // loaded LLM engine was supplied, default to the LLM tier.
  const baseRedactOptions = { ...options.redactOptions };
  if (!baseRedactOptions.tier && engine && typeof engine.isLoaded === "function" && engine.isLoaded()) {
    baseRedactOptions.llm = { enabled: true, ...baseRedactOptions.llm };
  }
  const activeTier = baseRedactOptions.tier || (baseRedactOptions.llm?.enabled ? "llm" : "rules");

  if (!doFetch) {
    throw new Error("global fetch is not available. Use Node.js 18+ or pass options.fetch.");
  }

  const server = http.createServer(async (req, res) => {
    try {
      // Health / introspection endpoint.
      if (req.url === "/__pii/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, upstream, tier: activeTier }));
        return;
      }

      // Read the full request body.
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const rawBody = Buffer.concat(chunks).toString("utf8");

      const state = { map: {}, reverseMap: {}, placeholderCounts: {} };
      let outgoingBody = rawBody;

      const contentType = req.headers["content-type"] || "";
      if (rawBody && contentType.includes("application/json")) {
        try {
          const bodyObj = JSON.parse(rawBody);
          await redactRequestBody(engine, bodyObj, baseRedactOptions, state, compressOn, formats);
          if (imageSanitizer) await sanitizeImagesInBody(bodyObj, imageSanitizer, sanitizeOpts);
          outgoingBody = JSON.stringify(bodyObj);
        } catch (e) {
          logger.log("warn", "PROXY", "Body was not redactable JSON; forwarding as-is", { error: e.message });
        }
      }

      // Build forwarded headers.
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (!STRIP_REQUEST_HEADERS.has(k.toLowerCase())) headers[k] = v;
      }
      headers["accept-encoding"] = "identity";

      const target = `${upstream}${req.url}`;
      const hasBody = req.method !== "GET" && req.method !== "HEAD";

      const upstreamRes = await doFetch(target, {
        method: req.method,
        headers,
        body: hasBody ? outgoingBody : undefined,
      });

      // Persist the map locally so it could be retrieved within the TTL.
      const sessionId = store.put(state.map);

      // Mirror status + headers (minus length/encoding which we change).
      const resHeaders = { "x-pii-session": sessionId };
      upstreamRes.headers.forEach((value, key) => {
        if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) resHeaders[key] = value;
      });
      res.writeHead(upstreamRes.status, resHeaders);

      await pipeWithRestore(upstreamRes.body, res, state.map);
    } catch (error) {
      logger.logError("proxy", error, { url: req.url, method: req.method });
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
      }
      res.end(JSON.stringify({ error: "redactkit proxy error", message: error.message }));
    }
  });

  server.on("close", () => store.dispose?.());
  return server;
}

/**
 * Convenience: create the proxy and start listening.
 * @returns {Promise<http.Server>}
 */
export function startProxy(options = {}) {
  const port = options.port ?? 8787;
  const host = options.host ?? "127.0.0.1";
  const server = createProxyServer(options);
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve(server));
  });
}
