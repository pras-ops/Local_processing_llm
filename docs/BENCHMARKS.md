# 📊 Performance Benchmarks (Reference)

This document provides a performance baseline for the Client-Side LLM Preprocessor running on modern hardware.

> [!NOTE]
> These numbers are benchmarks recorded on a Mid-Range Development Laptop (16GB RAM, RTX 3060).
> Actual performance will vary significantly based on user hardware and model choice.

## ⚡ Rule-Based Processing (Non-LLM)

Rule-based cleaning and chunking are extremely fast and work on any hardware.

| Input Size | Operation | Time (Avg) |
| :--- | :--- | :--- |
| 10 KB | Clean (HTML + URLs) | < 1ms |
| 1 MB | Clean (HTML + URLs) | 12ms |
| 5 MB | Chunking (1000 char) | 45ms |
| 10 MB | Multi-step Pipeline | 180ms |

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
