# Client-Side LLM Preprocessor 🛡️

[![Build Status](https://github.com/USERNAME/local_processing_llm/actions/workflows/ci.yml/badge.svg)](https://github.com/USERNAME/local_processing_llm/actions)
[![NPM Version](https://img.shields.io/npm/v/client-llm-preprocessor?color=blue)](https://www.npmjs.com/package/client-llm-preprocessor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Client-Side LLM Preprocessor** is a privacy-first JavaScript SDK that enables powerful text preprocessing entirely within the user's browser. It combines high-speed rule-based cleaning with optional high-reasoning LLM-based extraction and semantic cleaning.

---

## 🌟 Key Features

- 🕵️ **Privacy-First**: All data stay on the user's local machine. No API keys, no server-side processing.
- ⚡ **Hybrid Processing**: High-speed rules for noise removal, LLM for semantic intelligence.
- 🏗️ **Structured Extraction**: Extract structured data (JSON) directly from messy text.
- 🧩 **Flexible Chunking**: Intelligent text splitting by length, sentence, or word.
- 🛡️ **Hardened & Tested**: 60+ tests covering extreme inputs, garbage text, and lifecycle chaos.
- 🔌 **Easy Integration**: Built-in WebGPU detection and standardized error handling.

---

## 📑 Table of Contents

- [Quick Start](#🚀-quick-start)
- [Installation](#📦-installation)
- [Core Concepts](#🧩-core-concepts)
- [API Reference](#📖-api-reference)
- [Project Structure](#📂-project-structure)
- [Performance](#📊-performance)
- [Browser Requirements](#🌐-browser-requirements)
- [Contributing](#🤝-contributing)
- [License](#⚖️-license)

---

## 🚀 Quick Start

### 1. Verify Environment
Always check for WebGPU support before attempting to load LLM models:

```javascript
import { Preprocessor } from 'client-llm-preprocessor';

const preprocessor = new Preprocessor();
const isSupported = await preprocessor.checkWebGPU();

if (!isSupported) {
    console.warn("WebGPU not supported. Falling back to rule-based cleaning only.");
}
```

### 2. Fast Rule-Based Cleaning (No Model Needed)
Clean text instantly without any downloads:

```javascript
const text = "<html><body>Contact: hello@example.com   -  Visit https://site.com</body></html>";
const cleaned = preprocessor.chunk(text, {
    removeHtml: true,
    removeUrls: true,
    removeExtraWhitespace: true
});
// Result: "Contact: hello@example.com -"
```

### 3. Smart LLM Extraction (Model Required)
Load a local model to extract structured data:

```javascript
await preprocessor.loadModel('Llama-3.2-1B-Instruct-q4f16_1-MLC');

const resume = "John Doe, Email: john@doe.com, Phone: 123-456-7890...";
const data = await preprocessor.extract(resume, {
    format: 'json',
    fields: ['name', 'email', 'phone']
});
```

---

## 📦 Installation

```bash
npm install client-llm-preprocessor
```

---

## 📂 Project Structure

The project follows a modular and well-documented structure:

```text
local_processing_llm/
├── .github/               # GitHub-specific workflows and templates
├── docs/                  # In-depth technical guides & architecture
├── examples/              # Ready-to-run demo pages
├── src/                   # Source code
│   ├── preprocess/        # Core logic (clean, chunk, extract)
│   ├── utils/             # Helpers (logger, validation, errors)
│   ├── engine.js          # WebLLM wrapper
│   └── index.js           # Package entry point
├── tests/                 # 60+ automated tests
│   ├── unit/              # Pure logic tests
│   ├── integration/       # Workflow & lifecycle tests
│   └── helpers/           # Test utilities & mocks
├── dist/                  # Compiled production build (ESM + Types)
├── package.json           # Meta-data & dependencies
└── README.md              # You are here
```

---

## 📊 Performance

| Input Size | Rule-Based | LLM-Based |
| :--- | :--- | :--- |
| **10 KB** | < 1ms | 1-3 seconds |
| **1 MB** | 12ms | (Requires Chunking) |
| **10 MB** | 180ms | (Sequential Processing) |

> [!TIP]
> For a full breakdown of memory usage and speed benchmarks, see [BENCHMARKS.md](docs/BENCHMARKS.md).

---

## 🌐 Browser Requirements

- **Local Processing**: Any modern browser (Chrome, Firefox, Safari, Edge).
- **LLM Features**: Requires **WebGPU** support.
  - ✅ **Chrome 113+** (Windows, macOS, Linux)
  - ✅ **Edge 113+**
  - ⚠️ **Safari** (Experimental/Partial)
  - ❌ **Firefox** (In progress by Mozilla)

---

## 📖 Useful Documents

- **[Architecture Overview](docs/ARCHITECTURE.md)**: How the engine works.
- **[API Documentation](docs/API.md)**: Full method signatures and options.
- **[Contributing Guide](CONTRIBUTING.md)**: How to help improve the project.
- **[Security Policy](SECURITY.md)**: Reporting vulnerabilities.
- **[Troubleshooting](docs/TESTING_GUIDE.md)**: Solutions for common issues.

---

## ⚖️ License

Distributed under the **MIT License**. See `LICENSE` for more information.
