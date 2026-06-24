import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.js'],
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
});

