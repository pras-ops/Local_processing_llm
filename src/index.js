import { LLMEngine } from "./engine.js";
import { clean } from "./preprocess/clean.js";
import { chunk } from "./preprocess/chunk.js";
import { extract } from "./preprocess/extract.js";
import { redact, restore } from "./preprocess/redact.js";
import { compress } from "./compress/compress.js";
import { createShieldedFetch } from "./utils/fetch.js";
import { ModelNotLoadedError } from "./utils/errors.js";

/**
 * RedactKit
 * 
 * Local PII redaction and restoration for cloud LLMs.
 * Supports cleaning, extraction, and custom prompts.
 */
export class Preprocessor {
  constructor(options = {}) {
    // Allow injecting a custom engine (e.g. OllamaEngine for Node server/CLI) via
    // options.engine. Defaults to the browser WebLLM engine for backwards compat.
    this.engine = options.engine || new LLMEngine(options);
    this.isModelLoaded = typeof this.engine.isLoaded === "function" ? this.engine.isLoaded() : false;
    this.logger = this.engine.getLogger();
  }

  /**
   * Load the WebLLM model
   * @param {string} model - Model name (default: "Llama-3.2-1B-Instruct-q4f16_1-MLC")
   * @returns {Promise<void>}
   */
  async loadModel(model) {
    await this.engine.loadModel(model);
    this.isModelLoaded = true;
    this.logger.log('info', 'PREPROCESSOR', 'Model loaded and ready');
  }

  /**
   * Check if WebGPU is supported in the current environment
   * @returns {Promise<boolean>}
   */
  async checkWebGPU() {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      return false;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get the logger instance for accessing internal logs
   * @returns {InternalLogger}
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Enable/disable internal logging
   */
  setLogging(enabled, verbose = false) {
    this.logger.setEnabled(enabled);
    this.logger.setVerbose(verbose);
    this.logger.log('info', 'PREPROCESSOR', `Logging ${enabled ? 'enabled' : 'disabled'}`, { verbose });
  }

  /**
   * Ensure model is loaded
   * @private
   */
  _ensureLoaded() {
    if (!this.isModelLoaded && !this.engine.isLoaded()) {
      throw new ModelNotLoadedError("preprocessing functions");
    }
  }

  /**
   * Clean text
   * Works with or without LLM model loaded
   * Uses rule-based cleaning if model not loaded, LLM if available
   * All options are opt-in (default: false) - user chooses what to remove
   * @param {string} text - Text to clean
   * @param {Object} options - Cleaning options (all optional, default: false)
   * @param {boolean} options.removeHtml - Remove HTML tags (default: false)
   * @param {boolean} options.removeUrls - Remove URLs (default: false)
   * @param {boolean} options.removeExtraWhitespace - Remove extra whitespace (default: false)
   * @param {boolean} options.removeLineBreaks - Remove line breaks (default: false)
   * @param {boolean} options.removeSpecialChars - Remove special characters (default: false)
   * @param {boolean} options.decodeHtmlEntities - Decode HTML entities like &amp; (default: false)
   * @param {string} options.customInstructions - Additional cleaning instructions (requires LLM)
   * @param {boolean} options.useLLM - Force LLM usage (requires model loaded)
   * @returns {Promise<string>|string}
   * 
   * @example
   * // No options - returns text as-is
   * await p.clean(text);
   * 
   * // User chooses what to remove
   * await p.clean(text, { removeHtml: true, removeExtraWhitespace: true });
   * 
   * // Use LLM for semantic cleaning
   * await p.clean(text, { useLLM: true, customInstructions: "Remove all dates" });
   */
  async clean(text, options = {}) {
    // Don't require model - can work without it
    // Only require if explicitly using LLM or custom instructions
    if (options.useLLM === true || options.customInstructions) {
      this._ensureLoaded();
    }

    return await clean(this.engine, text, options);
  }

  /**
   * Extract information from text
   * @param {string} text - Text to extract from
   * @param {Object} options - Extraction options
   * @returns {Promise<string>}
   */
  async extract(text, options = {}) {
    this._ensureLoaded();
    return await extract(this.engine, text, options);
  }

  /**
   * Chunk text into smaller pieces (non-LLM, fast operation)
   * Works immediately, no model needed
   * @param {string} text - Text to chunk
   * @param {Object} options - Chunking options
   * @returns {string[]}
   */
  chunk(text, options = {}) {
    // No model check needed - chunk is pure string operation
    return chunk(text, options);
  }

  /**
   * Redact sensitive PII data locally
   * Works with or without LLM model loaded
   * @param {string} text - Input text to redact
   * @param {Object} options - Redaction configurations
   * @returns {Promise<{redacted: string, map: Object}>}
   */
  async redact(text, options = {}) {
    if (options?.llm?.enabled === true) {
      this._ensureLoaded();
    }
    return await redact(this.engine, text, options);
  }

  /**
   * Restore redacted placeholders in a response with their original values
   * @param {string} text - Response text containing placeholders
   * @param {Object} map - Bidirectional map returned from redact()
   * @returns {string}
   */
  restore(text, map) {
    return restore(text, map);
  }

  /**
   * Create a shielded fetch wrapper
   * @param {Object} options - Wrapper configurations
   * @returns {Function}
   */
  createShieldedFetch(options = {}) {
    return createShieldedFetch(this, options);
  }

  /**
   * Run a custom prompt on text
   * @param {string} text - Input text
   * @param {string|Object} instruction - Custom instruction or config object
   * @param {Object} options - Generation options
   * @returns {Promise<string>}
   */
  async prompt(text, instruction, options = {}) {
    this._ensureLoaded();

    let promptText;
    let genOptions = { ...options };

    if (typeof instruction === "string") {
      promptText = `${instruction}\n\n${text}`;
    } else if (typeof instruction === "object") {
      // Advanced prompt configuration
      const { instruction: inst, format, temperature, maxTokens } = instruction;

      promptText = inst;
      if (format) {
        if (typeof format === "object") {
          promptText += `\n\nReturn the result in JSON format with these fields: ${JSON.stringify(format)}`;
        } else {
          promptText += `\n\nFormat: ${format}`;
        }
      }
      promptText += `\n\n${text}`;

      if (temperature !== undefined) genOptions.temperature = temperature;
      if (maxTokens !== undefined) genOptions.maxTokens = maxTokens;
    } else {
      throw new Error("Instruction must be a string or object");
    }

    return await this.engine.run(promptText, genOptions);
  }

  /**
   * Enforce correct pipeline ordering
   * Always ensures: clean → extract (if both present)
   * @private
   */
  _enforcePipelineOrder(pipeline) {
    const ordered = [...pipeline];
    const cleanIndex = ordered.findIndex(step =>
      step === "clean" || (typeof step === "object" && step.clean !== undefined)
    );
    const extractIndex = ordered.findIndex(step =>
      step === "extract" || (typeof step === "object" && step.extract !== undefined)
    );

    // If both clean and extract exist, ensure clean comes first
    if (cleanIndex !== -1 && extractIndex !== -1 && cleanIndex > extractIndex) {
      this.logger.log('warn', 'PIPELINE', 'Reordering pipeline: clean must come before extract', {
        originalOrder: ordered.map(s => typeof s === 'string' ? s : Object.keys(s)[0]),
        reordered: true
      });

      // Move clean before extract
      const cleanStep = ordered.splice(cleanIndex, 1)[0];
      const newExtractIndex = ordered.findIndex(step =>
        step === "extract" || (typeof step === "object" && step.extract !== undefined)
      );
      ordered.splice(newExtractIndex, 0, cleanStep);
    }

    return ordered;
  }

  /**
   * Process text with multiple operations in a pipeline
   * Automatically enforces correct ordering (clean → extract)
   * @param {string} text - Input text
   * @param {Array} pipeline - Array of operations to apply
   * @returns {Promise<string|string[]>}
   * 
   * @example
   * await p.pipeline(text, [
   *   "extract",  // Will be reordered to run after clean
   *   "clean",
   *   { prompt: "Rewrite in pirate style" }
   * ]);
   */
  async pipeline(text, pipeline) {
    this._ensureLoaded();

    if (!Array.isArray(pipeline) || pipeline.length === 0) {
      throw new Error("Pipeline must be a non-empty array");
    }

    // Enforce correct ordering
    const orderedPipeline = this._enforcePipelineOrder(pipeline);

    this.logger.log('info', 'PIPELINE', 'Starting pipeline execution', {
      stepCount: orderedPipeline.length,
      steps: orderedPipeline.map(s => typeof s === 'string' ? s : Object.keys(s)[0])
    });

    let result = text;
    const startTime = Date.now();

    for (let i = 0; i < orderedPipeline.length; i++) {
      const step = orderedPipeline[i];
      const stepStartTime = Date.now();
      const stepName = typeof step === 'string' ? step : Object.keys(step)[0] || 'unknown';

      try {
        if (typeof step === "string") {
          // Built-in operation name
          switch (step) {
            case "clean":
              result = await this.clean(result);
              break;
            case "extract":
              result = await this.extract(result);
              break;
            case "chunk":
              result = this.chunk(result);
              break;
            case "compress":
              result = compress(result).compressed;
              break;
            default:
              throw new Error(`Unknown operation: ${step}`);
          }
        } else if (typeof step === "object") {
          // Custom operation with options
          if (step.prompt) {
            result = await this.prompt(result, step.prompt, step.options || {});
          } else if (step.clean) {
            result = await this.clean(result, step.clean);
          } else if (step.extract) {
            result = await this.extract(result, step.extract);
          } else if (step.chunk) {
            result = this.chunk(result, step.chunk);
          } else if (step.compress) {
            result = compress(result, typeof step.compress === "object" ? step.compress : {}).compressed;
          } else {
            throw new Error(`Unknown operation object: ${JSON.stringify(step)}`);
          }
        } else {
          throw new Error(`Invalid pipeline step: ${step}`);
        }

        // If chunking was applied, result is now an array
        if (Array.isArray(result)) {
          this.logger.log('info', 'PIPELINE', 'Chunking applied, stopping pipeline', {
            chunks: result.length
          });
          break; // Can't process arrays further
        }

        const stepDuration = Date.now() - stepStartTime;
        this.logger.logPipelineStep(i, stepName, text, result, stepDuration);
      } catch (error) {
        this.logger.logError(`pipeline step ${i + 1} (${stepName})`, error, {
          step,
          inputLength: typeof text === 'string' ? text.length : 'N/A'
        });
        throw error;
      }
    }

    const totalDuration = Date.now() - startTime;
    this.logger.logPerformance('pipeline', {
      totalSteps: orderedPipeline.length,
      duration: `${totalDuration}ms`,
      averageStepTime: `${(totalDuration / orderedPipeline.length).toFixed(2)}ms`
    });

    return result;
  }

  /**
   * Process text with a simple configuration object
   * @param {string} text - Input text
   * @param {Object} config - Processing configuration
   * @returns {Promise<string>}
   * 
   * @example
   * await p.process(text, {
   *   clean: true,
   *   extract: { format: "json", fields: ["name", "email"] },
   *   customPrompt: "Convert to bullet points"
   * });
   */
  async process(text, config = {}) {
    this._ensureLoaded();

    let result = text;

    // Apply operations in order
    if (config.clean) {
      result = await this.clean(
        result,
        typeof config.clean === "object" ? config.clean : {}
      );
    }

    if (config.extract) {
      result = await this.extract(
        result,
        typeof config.extract === "object" ? config.extract : {}
      );
    }

    if (config.customPrompt) {
      result = await this.prompt(result, config.customPrompt, config.promptOptions || {});
    }

    if (config.chunk) {
      result = this.chunk(
        result,
        typeof config.chunk === "object" ? config.chunk : {}
      );
    }

    if (config.compress) {
      result = compress(result, typeof config.compress === "object" ? config.compress : {}).compressed;
    }

    return result;
  }
}

// Export individual functions for advanced users
export { LLMEngine } from "./engine.js";
export { clean } from "./preprocess/clean.js";
export { cleanWithRules } from "./preprocess/clean-rules.js";
export { chunk } from "./preprocess/chunk.js";
export { extract } from "./preprocess/extract.js";
export { redact, restore } from "./preprocess/redact.js";
export { compress } from "./compress/compress.js";
export { createShieldedFetch } from "./utils/fetch.js";

