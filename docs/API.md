# API Reference

This document provides a detailed reference for all public methods available in the `Preprocessor` class.

## `Preprocessor` Class

The main entry point for the SDK.

### `constructor(options = {})`
- `options.engine`: Custom engine instance (optional).
- `options.logger`: Custom logger configuration (optional).

---

### `async checkWebGPU()`
Checks if the current environment supports WebGPU.
- **Returns**: `Promise<boolean>`

---

### `async loadModel(modelName, options = {})`
Loads an LLM model into memory.
- `modelName`: String identifier for the model (e.g., `'Llama-3.2-1B-Instruct-q4f16_1-MLC'`).
- `options`: MLC-AI configuration options.
- **Throws**: `ConfigurationError` if model loading fails.

---

### `async clean(text, options = {})`
Cleans text using rules or LLM.
- `text`: The string to clean.
- `options`:
    - `removeHtml` (bool): Default `false`.
    - `removeUrls` (bool): Default `false`.
    - `removeExtraWhitespace` (bool): Default `false`.
    - `removeLineBreaks` (bool): Default `false`.
    - `removeSpecialChars` (bool): Default `false`.
    - `decodeHtmlEntities` (bool): Default `false`.
    - `useLLM` (bool): Force LLM cleaning.
    - `customInstructions` (string): Specific semantic instructions for LLM.

---

### `async extract(text, options = {})`
Extracts structured information from text.
- `text`: The source text.
- `options`:
    - `format`: `'json'` (only format supported currently).
    - `fields`: Array of field names to extract.
    - `strict`: (bool) If true, throws error on validation failure.
- **Returns**: `Promise<Object>` (Extracted JSON data).

---

### `chunk(text, options = {})`
Splits text into smaller segments.
- `text`: The source text.
- `options`:
    - `size`: Max characters per chunk (default `500`).
    - `overlap`: Characters to overlap between chunks (default `0`).
    - `strategy`: `'character'`, `'sentence'`, or `'word'`.
- **Returns**: `string[]`

---

### `async pipeline(text, steps = [])`
Runs multiple operations in sequence.
- `text`: Initial input.
- `steps`: Array of strings or objects (e.g., `['clean', { chunk: { size: 100 } }]`).
- **Returns**: Result of the final step.

---

### `getLogger()`
Access the internal logger to retrieve logs or performance stats.
- **Returns**: `InternalLogger`
