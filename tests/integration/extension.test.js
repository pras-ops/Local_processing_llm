import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";

// The interceptor is a self-contained IIFE meant for the browser MAIN world.
// We exercise its logic by stubbing window/location and eval-ing it, then driving
// the patched fetch with a fake "native" fetch.
const src = fs.readFileSync(new URL("../../extension/interceptor.js", import.meta.url), "utf8");

describe("browser extension interceptor (MV3 fetch monkeypatch)", () => {
  let captured;
  const savedWindow = globalThis.window;
  const savedLocation = globalThis.location;

  beforeAll(() => {
    captured = {};
    globalThis.location = { host: "claude.ai" };
    globalThis.window = {
      fetch: async (url, init) => {
        captured.url = url;
        captured.body = init?.body;
        return {
          text: async () => "We will email {{EMAIL_1}} and dial {{PHONE_1}}.",
          json: async () => ({ reply: "to {{EMAIL_1}}" }),
        };
      },
    };
    // Indirect eval runs in global scope so it sees Node globals + our window stub.
    (0, eval)(src);
  });

  afterAll(() => {
    globalThis.window = savedWindow;
    globalThis.location = savedLocation;
  });

  it("redacts the outgoing body and restores the response", async () => {
    const resp = await window.fetch("https://claude.ai/api/append_message", {
      body: JSON.stringify({ messages: [{ role: "user", content: "mail a@b.com call 555-019-9999" }] }),
    });

    expect(captured.body).toContain("{{EMAIL_1}}");
    expect(captured.body).toContain("{{PHONE_1}}");
    expect(captured.body).not.toContain("a@b.com");
    expect(await resp.text()).toBe("We will email a@b.com and dial 555-019-9999.");
  });

  it("passes through untouched when there is no PII", async () => {
    const original = JSON.stringify({ messages: [{ role: "user", content: "hello world" }] });
    await window.fetch("https://claude.ai/api/x", { body: original });
    expect(captured.body).toBe(original);
  });

  it("exposes a runtime toggle", () => {
    expect(window.__REDACTKIT__).toBeTruthy();
    expect(typeof window.__REDACTKIT__.enabled).toBe("boolean");
  });
});
