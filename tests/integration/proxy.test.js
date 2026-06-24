import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";
import { createProxyServer } from "../../src/server/proxy.js";
import { MapStore } from "../../src/server/store.js";

/** Start a server on an ephemeral port and resolve with { server, port }. */
function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function close(server) {
  return new Promise((resolve) => (server ? server.close(resolve) : resolve()));
}

describe("createProxyServer (local PII reverse proxy)", () => {
  let upstream;
  let proxy;

  afterEach(async () => {
    await close(proxy);
    await close(upstream);
    upstream = undefined;
    proxy = undefined;
  });

  it("redacts the outgoing request and restores the JSON response", async () => {
    let receivedBody = null;
    let receivedPath = null;

    upstream = http.createServer((req, res) => {
      receivedPath = req.url;
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        // Upstream only ever sees the placeholder; it echoes it back.
        res.end(JSON.stringify({ choices: [{ message: { content: "I will email {{EMAIL_1}} now." } }] }));
      });
    });
    const { port: upstreamPort } = await listen(upstream);

    proxy = createProxyServer({
      upstream: `http://127.0.0.1:${upstreamPort}`,
      logger: { log() {}, logError() {} },
    });
    const { port: proxyPort } = await listen(proxy);

    const resp = await fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Contact me at john@doe.com" }] }),
    });
    const text = await resp.text();

    // Path was forwarded.
    expect(receivedPath).toBe("/v1/chat/completions");
    // Upstream never saw the real email.
    expect(receivedBody).not.toContain("john@doe.com");
    expect(receivedBody).toContain("{{EMAIL_1}}");
    // Client got the original value back, no leftover placeholder.
    expect(text).toContain("john@doe.com");
    expect(text).not.toContain("{{EMAIL_1}}");
    // Session id header is present.
    expect(resp.headers.get("x-pii-session")).toBeTruthy();
  });

  it("restores placeholders split across streamed chunks", async () => {
    upstream = http.createServer((req, res) => {
      req.on("data", () => {});
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        // Deliberately split "{{EMAIL_1}}" across two writes.
        res.write("data: I will email {{EMA");
        setTimeout(() => {
          res.write("IL_1}} shortly.\n\n");
          res.end();
        }, 10);
      });
    });
    const { port: upstreamPort } = await listen(upstream);

    proxy = createProxyServer({
      upstream: `http://127.0.0.1:${upstreamPort}`,
      store: new MapStore({ ttlMs: 5000 }),
      logger: { log() {}, logError() {} },
    });
    const { port: proxyPort } = await listen(proxy);

    const resp = await fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "my email is jane@acme.org" }] }),
    });
    const text = await resp.text();

    expect(text).toContain("jane@acme.org");
    expect(text).not.toContain("{{EMAIL_1}}");
    expect(text).not.toContain("{{EMA");
  });

  it("redacts NER-detected entities (tier=ner) and restores them", async () => {
    let receivedBody = null;
    upstream = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: "Noted, {{NAME_1}}." } }] }));
      });
    });
    const { port: upstreamPort } = await listen(upstream);

    const nerMock = {
      name: "ner",
      detect: async () => [{ value: "John Carter", type: "NAME", source: "ner", score: 0.95 }],
    };

    proxy = createProxyServer({
      upstream: `http://127.0.0.1:${upstreamPort}`,
      redactOptions: { tier: "ner", nerDetector: nerMock },
      logger: { log() {}, logError() {} },
    });
    const { port: proxyPort } = await listen(proxy);

    const resp = await fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "The patient is John Carter" }] }),
    });
    const text = await resp.text();

    expect(receivedBody).toContain("{{NAME_1}}");
    expect(receivedBody).not.toContain("John Carter");
    expect(text).toContain("John Carter");
    expect(text).not.toContain("{{NAME_1}}");
  });

  it("sanitizes base64 images in vision requests (one-way)", async () => {
    let receivedBody = null;
    upstream = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
      });
    });
    const { port: upstreamPort } = await listen(upstream);

    const sanitized = Buffer.from("SANITIZED-IMAGE");
    const imageSanitizer = { sanitize: async () => ({ image: sanitized, regions: [{ source: "ocr" }] }) };

    proxy = createProxyServer({
      upstream: `http://127.0.0.1:${upstreamPort}`,
      imageSanitizer,
      logger: { log() {}, logError() {} },
    });
    const { port: proxyPort } = await listen(proxy);

    await fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", content: [
            { type: "text", text: "what is in this image of bob@x.com?" },
            { type: "image_url", image_url: { url: "data:image/png;base64,QUJD" } },
          ] },
        ],
      }),
    });

    const sent = JSON.parse(receivedBody);
    const imgPart = sent.messages[0].content.find((p) => p.type === "image_url");
    expect(imgPart.image_url.url).toBe(`data:image/png;base64,${sanitized.toString("base64")}`);
    expect(receivedBody).not.toContain("QUJD"); // original image bytes gone
    expect(receivedBody).toContain("{{EMAIL_1}}"); // text still redacted
  });

  it("compresses outgoing text when compress is enabled", async () => {
    let receivedBody = null;
    upstream = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
      });
    });
    const { port: upstreamPort } = await listen(upstream);

    proxy = createProxyServer({
      upstream: `http://127.0.0.1:${upstreamPort}`,
      compress: true,
      logger: { log() {}, logError() {} },
    });
    const { port: proxyPort } = await listen(proxy);

    await fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello      world\n\n\n\nbye" }] }),
    });

    const sent = JSON.parse(receivedBody);
    expect(sent.messages[0].content).toBe("hello world\n\nbye"); // whitespace collapsed
  });

  it("redacts the OpenAI Responses API shape (input + instructions)", async () => {
    let receivedBody = null;
    upstream = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ output_text: "ok" }));
      });
    });
    const { port: upstreamPort } = await listen(upstream);

    proxy = createProxyServer({ upstream: `http://127.0.0.1:${upstreamPort}`, logger: { log() {}, logError() {} } });
    const { port: proxyPort } = await listen(proxy);

    await fetch(`http://127.0.0.1:${proxyPort}/v1/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-x",
        instructions: "User email is admin@corp.com",
        input: [{ role: "user", content: [{ type: "input_text", text: "ping me at dev@corp.com" }] }],
      }),
    });

    expect(receivedBody).not.toContain("dev@corp.com");
    expect(receivedBody).not.toContain("admin@corp.com");
    expect(receivedBody).toContain("{{EMAIL_1}}");
    expect(receivedBody).toContain("{{EMAIL_2}}");
  });

  it("redacts the Gemini contents[] shape", async () => {
    let receivedBody = null;
    upstream = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{}");
      });
    });
    const { port: upstreamPort } = await listen(upstream);

    proxy = createProxyServer({ upstream: `http://127.0.0.1:${upstreamPort}`, logger: { log() {}, logError() {} } });
    const { port: proxyPort } = await listen(proxy);

    await fetch(`http://127.0.0.1:${proxyPort}/v1beta/models/gemini:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "call 555-019-9999" }] }] }),
    });

    expect(receivedBody).not.toContain("555-019-9999");
    expect(receivedBody).toContain("{{PHONE_1}}");
  });

  it("--format gating: only the selected format is redacted", async () => {
    let receivedBody = null;
    upstream = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{}");
      });
    });
    const { port: upstreamPort } = await listen(upstream);

    // Only process the Gemini format; an OpenAI body should pass through untouched.
    proxy = createProxyServer({
      upstream: `http://127.0.0.1:${upstreamPort}`,
      formats: ["gemini"],
      logger: { log() {}, logError() {} },
    });
    const { port: proxyPort } = await listen(proxy);

    await fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "email a@b.com" }] }),
    });

    expect(receivedBody).toContain("a@b.com"); // openai format NOT processed when only gemini selected
    expect(receivedBody).not.toContain("{{EMAIL_1}}");
  });

  it("passes non-JSON bodies through untouched", async () => {
    let receivedBody = null;
    upstream = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
      });
    });
    const { port: upstreamPort } = await listen(upstream);

    proxy = createProxyServer({
      upstream: `http://127.0.0.1:${upstreamPort}`,
      logger: { log() {}, logError() {} },
    });
    const { port: proxyPort } = await listen(proxy);

    const resp = await fetch(`http://127.0.0.1:${proxyPort}/raw`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "plain john@doe.com body",
    });

    expect(await resp.text()).toBe("ok");
    expect(receivedBody).toBe("plain john@doe.com body");
  });
});
