# 📊 Performance Benchmarks

This document provides a performance baseline for RedactKit running on modern hardware.

You can reproduce these benchmarks locally using:
```bash
node scripts/benchmark.js
```

## ⚡ Rule-Based Processing (Non-LLM)

Rule-based cleaning, chunking, and PII redaction are extremely fast and work on any hardware.

| Input Size | Clean (HTML + URLs) | Chunking (1000 char) | Redact PII (Rules) |
| :--- | :--- | :--- | :--- |
| **10 KB** | < 1ms | < 1ms | ~1ms |
| **1 MB** | ~4ms | < 1ms | ~15ms |
| **5 MB** | ~25ms | < 1ms | ~67ms |

## 🧠 LLM-Based Processing

LLM operations require WebGPU and model loading.

### 1. Model Lifecycle
*   **Initial Model Download**: 1-5 minutes (depends on internet)
*   **Model Loading (from Cache)**: 2-5 seconds
*   **Memory Usage**: ~1.5GB - 3.5GB VRAM (depending on model)

### 2. Inference Speed (Llama-3.2-1B-Instruct)
*   **Prompt Construction**: < 1ms
*   **Extraction (Short text)**: 1-3 seconds
*   **Cleaning (Semantic)**: 3-8 seconds
*   **Pipeline (Clean + Extract)**: 5-12 seconds

## 🐢 Known Bottlenecks

1.  **UI Blocking**: Since this SDK currently runs on the main thread, the browser UI will freeze during LLM inference. We recommend showing a "Processing..." overlay to the user.
2.  **VRAM Limits**: On machines with less than 4GB VRAM, larger models may fail to load or be extremely slow.
3.  **Large Context**: Processing chunks larger than 2,000 tokens may significantly degrade performance or exceed GPU memory.

## 📈 Optimization Tips

*   **Pre-Clean**: Always use rule-based cleaning *before* LLM extraction to reduce token count.
*   **Chunking**: For documents over 5,000 characters, use the `.chunk()` method and process pieces sequentially or pick relevant sections.
*   **Model Choice**: Use 1B parameter models for extraction and 3B+ only when high reasoning is required.

## 💰 Token Efficiency (Experimental)

> [!NOTE]
> This is an experimental observation. Actual savings depend on the complexity of the input text and the target data.

By processing raw text client-side, you can significantly reduce the payload sent to external APIs.

| Input (Raw HTML) | Operation | Output (JSON) | Token Reduction |
| :--- | :--- | :--- | :--- |
| **20 KB** (~5,000 tokens) | Extract Contact Info | **200 bytes** (~50 tokens) | **~99%** |
| **5 KB** (~1,200 tokens) | Summarize / Clean | **500 bytes** (~120 tokens) | **~90%** |

**Concept**: Instead of paying to stream 5,000 tokens of noise to a paid API, you use the local browser model to distill it down to the 50 tokens that matter.
