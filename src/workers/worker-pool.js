/**
 * WorkerPool — manages Web Worker instantiation and job dispatching.
 * Falls back to in-thread execution if Web Workers are not available (e.g. in Node.js).
 */
export class WorkerPool {
  constructor(options = {}) {
    this.options = options;
    this.worker = null;
    this.callbacks = new Map();
    this.nextId = 0;
  }

  /**
   * Lazy-initializes the Web Worker
   */
  init() {
    if (this.worker) return;

    if (typeof window !== "undefined" && typeof window.Worker !== "undefined") {
      try {
        // Instantiate the compiled ESM Web Worker
        this.worker = new Worker(
          new URL("../dist/redact-worker.js", import.meta.url),
          { type: "module" }
        );

        this.worker.onmessage = (event) => {
          const { id, status, entities, error } = event.data;
          const cb = this.callbacks.get(id);
          if (cb) {
            this.callbacks.delete(id);
            if (status === "success" || status === "ready") {
              cb.resolve(entities);
            } else {
              cb.reject(new Error(error));
            }
          }
        };
      } catch (e) {
        console.warn("Failed to initialize RedactKit Web Worker, falling back to main thread:", e.message);
      }
    }
  }

  /**
   * Run PII detection off-thread (if worker available) or in-thread (fallback)
   */
  async detect(text, options = {}) {
    this.init();

    if (!this.worker) {
      // Node.js fallback or browser fallback: run NER in-thread
      const { NERDetector } = await import("../detect/ner-detector.js");
      const detector = new NERDetector(options);
      return await detector.detect(text, options);
    }

    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.callbacks.set(id, { resolve, reject });
      this.worker.postMessage({
        id,
        action: "detect",
        text,
        options: {
          backend: options.backend,
          model: options.model,
          device: options.device,
          threshold: options.threshold,
          maxChars: options.maxChars,
        },
      });
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.callbacks.clear();
    }
  }
}
