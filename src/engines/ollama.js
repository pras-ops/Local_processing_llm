import { getLogger } from "../utils/logger.js";
import { ModelNotLoadedError, InferenceError } from "../utils/errors.js";

/**
 * Ollama Engine (Node.js / server-side)
 *
 * Drop-in replacement for the browser WebLLM engine that talks to a locally
 * running Ollama server (https://ollama.com). Implements the same interface the
 * preprocessing functions expect: run(), isLoaded(), getLogger(), loadModel().
 *
 * The model runs entirely on the user's machine, so this preserves the
 * "data never leaves your device" guarantee for the optional Tier 2 (LLM NER)
 * features when running as a local server/CLI instead of in the browser.
 */
export class OllamaEngine {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/+$/, "");
    this.model = options.model || "llama3.2";
    this.loaded = false;
    this.logger = options.logger || getLogger(options.loggerOptions);
    this.streamingEnabled = options.streaming !== false;
    this.fetch = options.fetch || globalThis.fetch;

    if (!this.fetch) {
      throw new Error("global fetch is not available. Use Node.js 18+ or pass options.fetch.");
    }
  }

  /**
   * Verify the Ollama server is reachable and the model is available.
   * Ollama does not "load" a model the way WebLLM downloads one, so this is a
   * connectivity + availability check.
   * @param {string} [model] - Override the model to use.
   * @returns {Promise<void>}
   */
  async loadModel(model) {
    if (model) this.model = model;
    const startTime = Date.now();
    this.logger.log("info", "MODEL", `Connecting to Ollama for model: ${this.model}`, {
      baseUrl: this.baseUrl,
      model: this.model,
    });

    let tags;
    try {
      const res = await this.fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      tags = await res.json();
    } catch (error) {
      throw new InferenceError(
        `Could not reach Ollama at ${this.baseUrl}. Is it running? (start it with \`ollama serve\`)`,
        error
      );
    }

    const available = (tags.models || []).map((m) => m.name);
    const found = available.some((name) => name === this.model || name.startsWith(`${this.model}:`));
    if (!found) {
      throw new InferenceError(
        `Model "${this.model}" is not installed in Ollama. Pull it first: \`ollama pull ${this.model}\`. ` +
          `Installed: ${available.join(", ") || "(none)"}`
      );
    }

    this.loaded = true;
    this.logger.log("info", "MODEL", "Ollama model ready", {
      model: this.model,
      loadTime: `${Date.now() - startTime}ms`,
    });
  }

  /**
   * Run a single-turn chat completion against Ollama.
   * @param {string} prompt
   * @param {Object} options - { temperature, maxTokens }
   * @returns {Promise<string>}
   */
  async run(prompt, options = {}) {
    if (!this.loaded) {
      throw new ModelNotLoadedError("inference");
    }

    const { temperature = 0.7, maxTokens = 512 } = options;
    const startTime = Date.now();
    this.logger.logInferenceStart(prompt, { temperature, maxTokens, model: this.model });

    try {
      const res = await this.fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          options: { temperature, num_predict: maxTokens },
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Ollama returned HTTP ${res.status} ${detail}`.trim());
      }

      const data = await res.json();
      const result = data?.message?.content ?? "";
      const duration = Date.now() - startTime;
      this.logger.logInferenceComplete(result, duration, data?.eval_count ?? Math.ceil(result.length / 4));
      return result;
    } catch (error) {
      this.logger.logError("run", error, { promptLength: prompt.length, model: this.model });
      throw new InferenceError("Failed to run inference", error);
    }
  }

  isLoaded() {
    return this.loaded;
  }

  getLogger() {
    return this.logger;
  }

  setStreaming(enabled) {
    this.streamingEnabled = enabled;
  }
}
