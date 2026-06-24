# RedactKit — browser extension (experimental)

A Manifest V3 extension that redacts PII **locally in your browser** before web chat
apps (claude.ai, chatgpt.com, gemini) send it, and restores the originals in the
reply. It works by injecting a **MAIN-world** content script that monkey-patches
`window.fetch` (the only reliable way to modify request bodies under MV3).

- **Tier 1 (regex) only**, fully on-device, zero network, zero model download.
- Restores **JSON, text, and streaming (SSE)** responses on the fly.
- Toggle live in the page console: `window.__REDACTKIT__.enabled = false`.

## Load it (unpacked)

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this `extension/` folder.
3. Open claude.ai / chatgpt.com — you'll see `[RedactKit] active …` in the console.

## ⚠️ Important caveats

- **Private APIs:** web chat apps use **undocumented request shapes** that can change
  without notice. The interceptor redacts the common prompt-bearing fields
  (`messages[].content`, `prompt`, `input`, Gemini `contents[].parts[].text`)
  best-effort. Treat it as **risk-reduction, not a guarantee** — verify on your target.
- **Tier 1 only:** structured PII (emails, phones, SSNs, cards, IPs, API keys) is
  caught reliably. Names/addresses need NER — for that, use the **local proxy**
  (`redactkit serve --tier ner`) with a tool whose endpoint you can configure.
- **Fragility:** monkey-patching `fetch` can conflict with the site or other
  extensions. It's intentionally conservative (only touches JSON bodies that contain
  detected PII).

## Customize

Edit `manifest.json` `matches` to add/remove sites, and `interceptor.js` to adjust the
detection rules or which body fields are redacted. The detection logic mirrors
`../src/preprocess/redact.js` (Tier 1).
