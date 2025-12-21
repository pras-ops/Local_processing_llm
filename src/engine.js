import * as webllm from "@mlc-ai/web-llm";
import { getLogger } from "./utils/logger.js";

/**
 * WebLLM Engine Wrapper
 * Handles model loading and inference with detailed internal logging
 */
export class LLMEngine {
  constructor(options = {}) {
    this.engine = null;
    this.model = null;
    this.logger = options.logger || getLogger(options.loggerOptions);
    this.streamingEnabled = options.streaming !== false; // Try streaming by default
  }

  /**
   * Load a WebLLM model
   * @param {string} model - Model name (default: "Llama-3.2-1B-Instruct-q4f16_1")
   * @returns {Promise<void>}
   */
  async loadModel(model = "Llama-3.2-1B-Instruct-q4f16_1") {
    if (this.engine && this.model === model) {
      this.logger.log('info', 'MODEL', 'Model already loaded, skipping');
      return;
    }

    const startTime = Date.now();
    this.logger.log('info', 'MODEL', `Loading model: ${model}`, { model });

    try {
      this.engine = await webllm.CreateWebLLMEngine(model, {
        initProgressCallback: (report) => {
          if (report.progress) {
            const progress = (report.progress * 100).toFixed(1);
            this.logger.log('info', 'MODEL', `Loading progress: ${progress}%`, {
              progress: parseFloat(progress),
              report
            });
          }
        },
      });

      this.model = model;
      const loadTime = Date.now() - startTime;
      this.logger.log('info', 'MODEL', 'Model loaded successfully', {
        model,
        loadTime: `${loadTime}ms`
      });
    } catch (error) {
      this.logger.logError('loadModel', error, { model });
      throw new Error(`Failed to load model: ${error.message}`);
    }
  }

  /**
   * Run inference with the loaded model
   * Captures detailed internal state including token-by-token generation
   * @param {string} prompt - The prompt to send to the model
   * @param {Object} options - Generation options
   * @returns {Promise<string>}
   */
  async run(prompt, options = {}) {
    if (!this.engine) {
      throw new Error("Model not loaded. Call loadModel() first.");
    }

    const {
      temperature = 0.7,
      maxTokens = 512,
      stopSequences = [],
      stream = this.streamingEnabled, // Try streaming for token-by-token logging
    } = options;

    const startTime = Date.now();
    this.logger.logInferenceStart(prompt, { temperature, maxTokens, stopSequences, stream });

    try {
      let fullResponse = '';
      let tokenCount = 0;
      const tokens = [];

      // Try streaming first for token-by-token visibility
      if (stream && this.engine.chat?.completions?.createStream) {
        this.logger.log('info', 'INFERENCE', 'Using streaming mode for token-by-token logging');

        try {
          const stream = await this.engine.chat.completions.createStream({
            messages: [{ role: "user", content: prompt }],
            temperature,
            max_tokens: maxTokens,
            stop: stopSequences.length > 0 ? stopSequences : undefined,
          });

          // Capture each token as it's generated
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullResponse += delta;
              tokenCount++;
              tokens.push(delta);

              // Log each token (if verbose)
              this.logger.logTokenGeneration(delta, fullResponse, tokenCount);
            }
          }

          this.logger.log('info', 'INFERENCE', 'Streaming completed', {
            totalTokens: tokenCount,
            responseLength: fullResponse.length
          });
        } catch (streamError) {
          // Fallback to non-streaming if streaming fails
          this.logger.log('warn', 'INFERENCE', 'Streaming failed, falling back to non-streaming', {
            error: streamError.message
          });
          return await this.runNonStreaming(prompt, options, startTime);
        }
      } else {
        // Non-streaming mode
        return await this.runNonStreaming(prompt, options, startTime);
      }

      const duration = Date.now() - startTime;
      this.logger.logInferenceComplete(fullResponse, duration, tokenCount);

      // Log token sequence for analysis
      this.logger.log('debug', 'INFERENCE', 'Token sequence captured', {
        tokenCount,
        tokens: tokens.slice(0, 20), // First 20 tokens
        fullSequenceLength: tokens.length
      });

      return fullResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logError('run', error, {
        promptLength: prompt.length,
        duration: `${duration}ms`,
        options
      });
      throw new Error(`Inference failed: ${error.message}`);
    }
  }

  /**
   * Non-streaming inference (fallback)
   * @private
   */
  async runNonStreaming(prompt, options, startTime) {
    const {
      temperature = 0.7,
      maxTokens = 512,
      stopSequences = [],
    } = options;

    this.logger.log('info', 'INFERENCE', 'Using non-streaming mode');

    const response = await this.engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
      stop: stopSequences.length > 0 ? stopSequences : undefined,
    });

    const result = response.choices[0].message.content;
    const duration = Date.now() - (startTime || Date.now());
    const estimatedTokens = Math.ceil(result.length / 4); // Rough estimate: ~4 chars per token

    this.logger.logInferenceComplete(result, duration, estimatedTokens);

    return result;
  }

  /**
   * Check if model is loaded
   * @returns {boolean}
   */
  isLoaded() {
    return this.engine !== null;
  }

  /**
   * Get the logger instance
   * @returns {InternalLogger}
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Enable/disable streaming for token-by-token logging
   */
  setStreaming(enabled) {
    this.streamingEnabled = enabled;
    this.logger.log('info', 'ENGINE', `Streaming ${enabled ? 'enabled' : 'disabled'}`);
  }
}

