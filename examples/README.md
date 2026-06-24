# Examples

This directory contains interactive examples demonstrating the RedactKit capabilities.

## Available Examples

### 1. [basic-demo.html](./basic-demo.html)
Interactive demo showing:
- Model loading
- Text cleaning
- Information extraction
- Pipeline processing

**How to run:**
```bash
npm run dev
# Open http://localhost:8080/examples/basic-demo.html
```

### 2. [cleaning-example.html](./cleaning-example.html)
Focused on text cleaning features:
- HTML removal
- URL filtering
- Whitespace normalization
- Special character handling

### 3. [extraction-example.html](./extraction-example.html)
Demonstrates data extraction:
- Contact information extraction
- Structured JSON output
- Validation features

## Requirements

- Modern browser with WebGPU support (Chrome/Edge 113+)
- Internet connection for first-time model download
- 2GB+ RAM recommended

## Notes

- First model load takes 1-2 minutes
- Subsequent loads are faster (cached)
- Examples work offline after initial model download
