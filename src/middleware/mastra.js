import { Preprocessor } from "../index.js";
import { restore } from "../preprocess/redact.js";

/**
 * RedactKit processor for Mastra Agent pipeline.
 * Intercepts user inputs to redact PII and restores them in agent output steps.
 */
export class MastraProcessor {
  constructor(options = {}) {
    this.id = "redactkit-processor";
    this.name = "RedactKit Privacy Processor";
    this.preprocessor = options.preprocessor || new Preprocessor(options);

    // Track request mappings by context reference
    this.contextMaps = new WeakMap();

    // Fallback cache for key-based lookup (e.g. threadId, runId)
    this.fallbackMaps = new Map();
  }

  /**
   * Retrieves or initializes the map store for the current request context
   */
  getMapStore(requestContext) {
    if (requestContext && typeof requestContext === "object") {
      if (!this.contextMaps.has(requestContext)) {
        this.contextMaps.set(requestContext, { map: {} });
      }
      return this.contextMaps.get(requestContext);
    }

    const key = (requestContext && (requestContext.runId || requestContext.threadId)) || "default";
    if (!this.fallbackMaps.has(key)) {
      this.fallbackMaps.set(key, { map: {} });
    }

    // Guard against memory growth in the fallback store
    if (this.fallbackMaps.size > 1000) {
      const keys = Array.from(this.fallbackMaps.keys());
      for (let i = 0; i < 200; i++) {
        this.fallbackMaps.delete(keys[i]);
      }
    }

    return this.fallbackMaps.get(key);
  }

  /**
   * Input hook: Runs before messages are sent to the model
   */
  async processInput({ messages, requestContext }) {
    if (!messages || messages.length === 0) return messages;

    const store = this.getMapStore(requestContext);
    const state = {
      map: store.map || {},
      reverseMap: store.reverseMap || {},
      placeholderCounts: store.placeholderCounts || {},
    };

    const redactedMessages = await Promise.all(
      messages.map(async (msg) => {
        const newMsg = { ...msg };
        if (typeof newMsg.content === "string") {
          const { redacted } = await this.preprocessor.redact(newMsg.content, { state });
          newMsg.content = redacted;
        }
        return newMsg;
      })
    );

    // Persist state updates
    store.map = state.map;
    store.reverseMap = state.reverseMap;
    store.placeholderCounts = state.placeholderCounts;

    return redactedMessages;
  }

  /**
   * Output step hook: Runs after every LLM execution step
   */
  async processOutputStep({ messages, requestContext }) {
    if (!messages || messages.length === 0) return messages;

    const store = this.getMapStore(requestContext);
    const map = store.map;

    if (!map || Object.keys(map).length === 0) {
      return messages;
    }

    const newMessages = [...messages];

    // Restore PII in the last assistant message
    for (let i = newMessages.length - 1; i >= 0; i--) {
      const msg = newMessages[i];
      if (msg.role === "assistant" && typeof msg.content === "string") {
        newMessages[i] = {
          ...msg,
          content: restore(msg.content, map),
        };
        break;
      }
    }

    return newMessages;
  }

  /**
   * Final output result hook: Runs at the end of agent execution
   */
  async processOutputResult({ result, requestContext }) {
    if (!result) return result;

    const store = this.getMapStore(requestContext);
    const map = store.map;

    if (!map || Object.keys(map).length === 0) {
      return result;
    }

    if (typeof result === "string") {
      return restore(result, map);
    }

    const newResult = { ...result };
    if (typeof newResult.text === "string") {
      newResult.text = restore(newResult.text, map);
    }

    return newResult;
  }
}
