import { Preprocessor } from "../index.js";
import { restore } from "../preprocess/redact.js";

/**
 * Helper to recursively redact content within a LanguageModelV3Message
 */
async function redactMessage(message, preprocessor, state) {
  if (!message) return message;

  const newMessage = { ...message };

  if (typeof newMessage.content === "string") {
    const { redacted } = await preprocessor.redact(newMessage.content, { state });
    newMessage.content = redacted;
  } else if (Array.isArray(newMessage.content)) {
    newMessage.content = await Promise.all(
      newMessage.content.map(async (part) => {
        if (part.type === "text" && typeof part.text === "string") {
          const { redacted } = await preprocessor.redact(part.text, { state });
          return { ...part, text: redacted };
        }
        return part;
      })
    );
  }

  return newMessage;
}

/**
 * Creates a Vercel AI SDK LanguageModelV3Middleware for PII redaction and restoration.
 *
 * @param {Object} options - Options to configure the Preprocessor
 * @param {Object} [options.preprocessor] - Pre-instantiated Preprocessor instance
 * @returns {import('ai').LanguageModelV3Middleware}
 */
export function redactMiddleware(options = {}) {
  const preprocessor = options.preprocessor || new Preprocessor(options);

  return {
    specificationVersion: "v3",

    async transformParams({ params }) {
      const state = { map: {}, reverseMap: {}, placeholderCounts: {} };

      let redactedPrompt = params.prompt;
      let redactedMessages = params.messages;

      if (params.prompt !== undefined) {
        if (typeof params.prompt === "string") {
          const { redacted } = await preprocessor.redact(params.prompt, { state });
          redactedPrompt = redacted;
        } else if (Array.isArray(params.prompt)) {
          redactedPrompt = await Promise.all(
            params.prompt.map((msg) => redactMessage(msg, preprocessor, state))
          );
        }
      }

      if (params.messages !== undefined && Array.isArray(params.messages)) {
        redactedMessages = await Promise.all(
          params.messages.map((msg) => redactMessage(msg, preprocessor, state))
        );
      }

      return {
        ...params,
        prompt: redactedPrompt,
        messages: redactedMessages,
        providerMetadata: {
          ...params.providerMetadata,
          redactkit: {
            map: state.map,
          },
        },
      };
    },

    async wrapGenerate({ doGenerate, params }) {
      const result = await doGenerate();
      const map = params.providerMetadata?.redactkit?.map;

      if (!map || Object.keys(map).length === 0) {
        return result;
      }

      const newResult = { ...result };

      if (Array.isArray(newResult.content)) {
        newResult.content = newResult.content.map((part) => {
          if (part.type === "text" && typeof part.text === "string") {
            return { ...part, text: restore(part.text, map) };
          }
          return part;
        });
      }

      if (newResult.text && typeof newResult.text === "string") {
        newResult.text = restore(newResult.text, map);
      }

      return newResult;
    },

    async wrapStream({ doStream, params }) {
      const { stream, ...rest } = await doStream();
      const map = params.providerMetadata?.redactkit?.map;

      if (!map || Object.keys(map).length === 0) {
        return { stream, ...rest };
      }

      let buffer = "";

      const transformStream = new TransformStream({
        transform(chunk, controller) {
          if (chunk.type === "text-delta") {
            const textDelta = chunk.delta !== undefined ? chunk.delta : chunk.textDelta;
            if (typeof textDelta !== "string") {
              controller.enqueue(chunk);
              return;
            }

            buffer += textDelta;

            const enqueueRestored = (restoredText) => {
              const newChunk = { ...chunk };
              if (newChunk.delta !== undefined) newChunk.delta = restoredText;
              if (newChunk.textDelta !== undefined) newChunk.textDelta = restoredText;
              controller.enqueue(newChunk);
            };

            while (true) {
              const openIdx = buffer.indexOf("{{");
              if (openIdx === -1) {
                let sendLength = buffer.length;
                if (buffer.endsWith("{")) {
                  sendLength -= 1;
                }

                if (sendLength > 0) {
                  const textToSend = buffer.slice(0, sendLength);
                  enqueueRestored(textToSend);
                  buffer = buffer.slice(sendLength);
                }
                break;
              } else {
                if (openIdx > 0) {
                  const textToSend = buffer.slice(0, openIdx);
                  enqueueRestored(textToSend);
                  buffer = buffer.slice(openIdx);
                }

                const closeIdx = buffer.indexOf("}}");
                if (closeIdx === -1) {
                  break;
                } else {
                  const placeholderLength = closeIdx + 2;
                  const placeholder = buffer.slice(0, placeholderLength);
                  const restoredText = restore(placeholder, map);

                  enqueueRestored(restoredText);
                  buffer = buffer.slice(placeholderLength);
                }
              }
            }
          } else {
            controller.enqueue(chunk);
          }
        },

        flush(controller) {
          if (buffer.length > 0) {
            controller.enqueue({
              type: "text-delta",
              id: "text-flush",
              delta: restore(buffer, map),
              textDelta: restore(buffer, map),
            });
            buffer = "";
          }
        },
      });

      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      };
    },
  };
}
