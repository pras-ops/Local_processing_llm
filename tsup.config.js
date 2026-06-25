import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.js',
    },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    splitting: false,
    sourcemap: false,
    clean: true,
    bundle: true,
    // Keep heavy/optional deps external (not bundled). Users install them
    // separately: @mlc-ai/web-llm for the LLM tier, @huggingface/transformers
    // for the local NER tier. Both are lazy-imported at runtime.
    external: ['@mlc-ai/web-llm', '@huggingface/transformers'],
    platform: 'browser',
    target: 'es2020',
  },
  {
    entry: {
      node: 'src/node.js',
    },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    splitting: false,
    sourcemap: false,
    clean: false,
    bundle: true,
    external: [
      '@mlc-ai/web-llm',
      '@huggingface/transformers',
      'sharp',
      'tesseract.js',
      'fs',
      'path',
      'http',
      'url'
    ],
    platform: 'node',
    target: 'node18',
  },
  {
    entry: {
      'ai-sdk': 'src/middleware/ai-sdk.js',
    },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    splitting: false,
    sourcemap: false,
    clean: false,
    bundle: true,
    external: ['ai', '@ai-sdk/provider', 'fs', 'path'],
    platform: 'node',
    target: 'node18',
  },
  {
    entry: {
      'mastra': 'src/middleware/mastra.js',
    },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    splitting: false,
    sourcemap: false,
    clean: false,
    bundle: true,
    external: ['@mastra/core', 'fs', 'path'],
    platform: 'node',
    target: 'node18',
  },
  {
    entry: {
      'redact-worker': 'src/workers/redact-worker.js',
    },
    format: ['esm'],
    dts: false, // workers don't need dts
    outDir: 'dist',
    splitting: false,
    sourcemap: false,
    clean: false,
    bundle: true,
    external: ['@huggingface/transformers'],
    platform: 'browser',
    target: 'es2020',
  }
]);

