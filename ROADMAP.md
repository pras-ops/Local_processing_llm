# Plan: From proof-of-concept → useful product

**Strategic bet:** stop competing as a generic "preprocessor" (commoditized — it's a thin wrapper over WebLLM + regex). Reposition around the one job with validated demand and a real client-side gap: **redact sensitive data locally → send safely to any cloud LLM → restore the answer.** Everything below serves that bet.

---

## ✅ Recently shipped

- **Local server / proxy / CLI** (`redactkit`) — runs headroom-style as a local reverse proxy any app can point at, plus `redact`/`restore`/`clean` commands. Node entry at `redactkit/node`. ([src/server/proxy.js](src/server/proxy.js), [bin/redactkit.js](bin/redactkit.js))
- **Tiered detection pipeline** — `regex (Tier 1) → local NER (Tier 2) → LLM (Tier 3)` behind a `Detector`/router abstraction, selected with `--tier`. Default is zero-dep regex so it runs on any hardware. ([src/detect/](src/detect/))
- **Local NER tier** — `Xenova/bert-base-NER` (Piiranha/GLiNER optional) via transformers.js, fully offline after first download; preferred over the heavier LLM tier.
- **Reversible local map store** with TTL ([src/server/store.js](src/server/store.js)); SSE streaming restore in the proxy.
- **Rule-based compression** — content-type-aware token reduction (JSON minify, HTML strip, whitespace/dedupe), safe & dependency-free; `compress` CLI/`pipeline` step + proxy `--compress`. ([src/compress/](src/compress/))
- **Image sanitization** — blur sensitive data in images: OCR text-PII (tesseract.js) + faces (transformers.js), blurred with sharp; `blur` CLI + proxy `--blur-images`. One-way (not reversible). ([src/image/](src/image/))
- **Multi-provider proxy** — request-body redaction for OpenAI Chat Completions, Anthropic Messages, OpenAI Responses API, and Gemini, selectable via `--format`. Shields coding agents (Claude Code via `ANTHROPIC_BASE_URL`, Codex via `OPENAI_BASE_URL`). ([src/server/proxy.js](src/server/proxy.js))
- **Browser extension (experimental)** — MV3 MAIN-world `fetch` interceptor for claude.ai / chatgpt.com / gemini; Tier-1 redaction in the browser. ([extension/](extension/))

**Next up:** evaluation harness (precision/recall on `ai4privacy`/`presidio-research`), compliance profiles (`--profile hipaa|gdpr|pci`), file/document redaction (PDF/DOCX), and a browser (canvas-based) image path.

---

## Phase 0 — Fix the known issues (≈1 hour, do first)

Clean the slate before building anything new. All low-risk.

| # | Issue | File | Fix |
|---|---|---|---|
| 1 | `chunk()` infinite-loop when `overlap ≥ size` | [chunk.js:21](src/preprocess/chunk.js) | Clamp step: `const step = Math.max(1, size - overlap)` |
| 2 | Error classes defined but unused (dead code) | [errors.js](src/utils/errors.js), [index.js](src/index.js), [engine.js](src/engine.js) | Wire `ModelNotLoadedError`/`InferenceError` into `_ensureLoaded` + engine, *or* delete the file. Recommend wiring in. |
| 3 | README Quick Start calls `chunk()` with clean options | [README.md:70](README.md) | Change to `clean()`; fix the result comment |
| 4 | Broken badges (`USERNAME` placeholder, unpublished npm pkg) | [README.md:3](README.md) | Point at real repo `pras-ops/redactkit`; remove/replace npm badge until published |
| 5 | Outdated browser table (WebGPU shipped everywhere Nov 2025) | [README.md:139](README.md) | Update Firefox/Safari to ✅ — it's now a selling point |
| 6 | Unused `getLogger` imports | [clean.js](src/preprocess/clean.js), [extract.js](src/preprocess/extract.js) | Remove |
| 7 | Missing edge-case test | [tests/unit/chunk.test.js](tests/unit/chunk.test.js) | Add `overlap ≥ size` test so #1 can't regress |

**Exit criteria:** 67+ tests green, build clean, README truthful.

---

## Phase 1 — The pivot: client-side PII redaction (the core value)

This is what turns it from "an afternoon's worth of regex" into a product. New module `src/preprocess/redact.js` with a **reversible** API:

```js
const { redacted, map } = p.redact(text);   // local, instant
//  → send `redacted` to OpenAI/Claude/etc.
const answer = p.restore(response, map);     // placeholders → originals, locally
```

**Detection in two tiers:**
- **Tier 1 — rule-based, no model, instant:** email, phone, SSN, credit card (Luhn-checked), IP, common API-key/secret patterns. This is the reliable ~80% and needs zero download — the real differentiator vs. the heavyweight LLM story.
- **Tier 2 — optional LLM-assisted:** names, addresses, org names (the fuzzy entities regex can't catch). This is where the existing WebLLM path *finally earns its 1 GB* — NER suits a small local model far better than the full extraction it does today.

**Reuse what exists:** `validation.js` verification logic, `clean`/`chunk` become supporting utilities, the logger gives an audit trail (valuable for compliance users).

**Exit criteria:** redact→restore round-trips losslessly on a realistic sample; rule-based path works with no model loaded; demo shows it.

---

## Phase 2 — Make it adoptable (turn it into something people can find and trust)

1. **Reposition the README** around the PII workflow, not "preprocessing." Lead with the redact→send→restore story.
2. **Live demo** — rewrite [examples/basic-demo.html](examples/basic-demo.html) as redact → (mock API call) → restore, runnable with **no model download** for the rule-based path. This is your shop window.
3. **Fill the test gap** — the LLM path is currently mocked out and *untested*. Add at least one real browser-based test (Playwright/headless Chrome) that loads a model and exercises Tier 2.
4. **Reproducible benchmarks** — replace the unsourced perf table with a script anyone can run.
5. **Publish to npm** under a name that says what it does (e.g. `redactkit`). Discoverability is most of "useful in real life."

---

## Phase 3 — Long-run differentiation & stickiness

- **Drop-in `fetch` wrapper / proxy shim** that auto-redacts outgoing LLM calls and auto-restores responses — one-line integration. This is the moat: once it's in someone's request path, it stays.
- **Format-preserving redaction** (keep the *shape* of a phone/card so the model still reasons correctly).
- **Custom entity patterns** + allow/deny lists for enterprise.
- **Framework adapters** (LangChain.js, Vercel AI SDK) — meet developers where they already are.
- **Compliance angle** — the logger already produces an audit trail; lean into "provable, on-device redaction" for healthcare/legal/finance, where the real budget is.

---

## What "useful" looks like (success signals)

- A developer can `npm i` and redact PII before an OpenAI call in **under 10 lines, with no model download**.
- The demo works offline in any modern browser.
- The README claim "data never leaves the device" is *actually true* for the rule-based path.
- Real adoption signal: GitHub issues/stars from people using it for the PII job, not the generic one.

---

## Suggested sequencing

**Phase 0 (now)** → **Phase 1 (the pivot — this is the make-or-break)** → **Phase 2 (ship it)** → **Phase 3 (grow it)**.

If Phase 1 proves the redact/restore round-trip is clean and fast, you have a real project. If it doesn't, you've spent a day finding that out cheaply — before investing in Phases 2–3.
