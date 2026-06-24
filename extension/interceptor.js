/**
 * RedactKit — MAIN-world fetch interceptor (Manifest V3).
 *
 * Runs in the page's MAIN world (Chrome 111+) so it can monkey-patch window.fetch
 * BEFORE the web app uses it. Outgoing JSON request bodies have their prompt text
 * redacted (Tier-1 regex, 100% local); responses (JSON / text / SSE streams) are
 * restored back to the original values on your machine.
 *
 * This is SELF-CONTAINED on purpose (no imports) so it can be loaded unpacked.
 * It mirrors src/preprocess/redact.js (Tier 1). NER/LLM tiers aren't included here
 * (they'd need bundling a model runtime) — use the local proxy for those.
 *
 * NOTE: web chat apps (claude.ai, chatgpt.com, gemini) use PRIVATE, undocumented
 * request shapes that can change. This redacts the common prompt-bearing fields
 * best-effort. Treat it as strong risk-reduction, not a guarantee.
 *
 * Toggle at runtime in the page console: window.__REDACTKIT__.enabled = false
 */
(function () {
  "use strict";
  if (window.__REDACTKIT__) return; // already installed

  const state = { enabled: true, redacted: 0 };
  window.__REDACTKIT__ = state;

  // ---- Tier 1 detection (mirror of regex-detector.js) ----
  function luhn(num) {
    const d = num.replace(/\D/g, "");
    if (d.length < 13 || d.length > 19) return false;
    let sum = 0, dbl = false;
    for (let i = d.length - 1; i >= 0; i--) {
      let v = +d[i];
      if (dbl) { v *= 2; if (v > 9) v -= 9; }
      sum += v; dbl = !dbl;
    }
    return sum % 10 === 0;
  }
  const collect = (re, t) => { const o = []; let m; while ((m = re.exec(t))) o.push(m[0]); return o; };
  const uniqLongest = (a) => [...new Set(a)].sort((x, y) => y.length - x.length);

  function detect(text) {
    const ents = [];
    const push = (v, type) => ents.push({ v, type });
    // credit cards (Luhn)
    for (const v of uniqLongest(collect(/\b\d(?:[ -]?\d){12,18}\b/g, text).filter(luhn))) push(v, "CREDIT_CARD");
    for (const v of [...new Set(collect(/\b\d{3}-\d{2}-\d{4}\b/g, text))]) push(v, "SSN");
    for (const v of uniqLongest([
      ...collect(/\bsk-[a-zA-Z0-9]{48}\b/g, text),
      ...collect(/\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]\b/g, text),
      ...collect(/\bAKIA[A-Z0-9]{16}\b/g, text),
    ])) push(v, "API_KEY");
    for (const v of uniqLongest(collect(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, text))) push(v, "EMAIL");
    for (const v of uniqLongest(collect(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, text))) push(v, "IP_ADDRESS");
    for (const v of uniqLongest(collect(/(?:\+?\b\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, text))) push(v, "PHONE");
    return ents;
  }

  function redactText(text, store) {
    if (typeof text !== "string" || !text) return text;
    let out = text;
    for (const { v, type } of detect(text)) {
      if (store.reverse[v]) { out = out.split(v).join(store.reverse[v]); continue; }
      store.counts[type] = (store.counts[type] || 0) + 1;
      const ph = `{{${type}_${store.counts[type]}}}`;
      store.map[ph] = v;
      store.reverse[v] = ph;
      out = out.split(v).join(ph);
      state.redacted++;
    }
    return out;
  }

  function restoreText(text, map) {
    if (typeof text !== "string" || !text || !map) return text;
    let out = text;
    for (const ph of Object.keys(map).sort((a, b) => b.length - a.length)) {
      out = out.split(ph).join(map[ph]);
    }
    return out;
  }

  // ---- redact known prompt-bearing fields in a parsed request body ----
  function redactBody(body, store) {
    const TEXT_TYPES = new Set(["text", "input_text"]);
    const parts = (arr) => arr.forEach((p) => { if (p && TEXT_TYPES.has(p.type) && typeof p.text === "string") p.text = redactText(p.text, store); });

    if (Array.isArray(body.messages)) {
      for (const m of body.messages) {
        if (typeof m.content === "string") m.content = redactText(m.content, store);
        else if (Array.isArray(m.content)) parts(m.content);
      }
    }
    if (typeof body.prompt === "string") body.prompt = redactText(body.prompt, store);
    if (typeof body.input === "string") body.input = redactText(body.input, store);
    else if (Array.isArray(body.input)) body.input.forEach((it) => {
      if (typeof it?.content === "string") it.content = redactText(it.content, store);
      else if (Array.isArray(it?.content)) parts(it.content);
    });
    if (Array.isArray(body.contents)) body.contents.forEach((c) => {
      if (Array.isArray(c?.parts)) c.parts.forEach((p) => { if (typeof p?.text === "string") p.text = redactText(p.text, store); });
    });
    return body;
  }

  // ---- patch fetch ----
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function (input, init = {}) {
    try {
      if (!state.enabled || !init || typeof init.body !== "string") return nativeFetch(input, init);

      let body;
      try { body = JSON.parse(init.body); } catch { return nativeFetch(input, init); }

      const store = { map: {}, reverse: {}, counts: {} };
      const before = state.redacted;
      const redactedBody = redactBody(body, store);
      if (state.redacted === before) return nativeFetch(input, init); // nothing sensitive

      const resp = await nativeFetch(input, { ...init, body: JSON.stringify(redactedBody) });
      const map = store.map;

      // restore non-stream readers
      if (resp.text) { const t = resp.text.bind(resp); resp.text = async () => restoreText(await t(), map); }
      if (resp.json) {
        const j = resp.json.bind(resp);
        resp.json = async () => JSON.parse(restoreText(JSON.stringify(await j()), map));
      }

      // restore streaming bodies (SSE) with placeholder-safe look-back
      if (resp.body && typeof resp.body.getReader === "function") {
        const reader = resp.body.getReader();
        const dec = new TextDecoder(), enc = new TextEncoder();
        let buf = "";
        const stream = new ReadableStream({
          async start(ctrl) {
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) { if (buf) ctrl.enqueue(enc.encode(restoreText(buf, map))); ctrl.close(); break; }
                buf += dec.decode(value, { stream: true });
                let lb = buf.lastIndexOf("{");
                if (lb > 0 && buf[lb - 1] === "{") lb--;
                let emit = buf, keep = "";
                if (lb !== -1 && lb > buf.length - 60 && !buf.slice(lb).includes("}}")) { emit = buf.slice(0, lb); keep = buf.slice(lb); }
                if (emit) ctrl.enqueue(enc.encode(restoreText(emit, map)));
                buf = keep;
              }
            } catch (e) { ctrl.error(e); }
          },
        });
        Object.defineProperty(resp, "body", { get: () => stream, configurable: true });
      }
      return resp;
    } catch {
      return nativeFetch(input, init);
    }
  };

  console.log("[RedactKit] active on " + location.host + " — toggle: window.__REDACTKIT__.enabled");
})();
