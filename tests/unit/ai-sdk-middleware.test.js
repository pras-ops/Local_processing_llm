import { describe, it, expect } from "vitest";
import { generateText, streamText, wrapLanguageModel } from "ai";
import { redactMiddleware } from "../../src/middleware/ai-sdk.js";

describe("Vercel AI SDK Middleware", () => {
  it("should redact input prompt and restore output response in wrapGenerate", async () => {
    let receivedPrompt = "";

    const mockModel = {
      specificationVersion: "v3",
      provider: "mock",
      modelId: "mock-model",
      doGenerate: async (options) => {
        // Capture what the model actually receives
        receivedPrompt = JSON.stringify(options.prompt);
        return {
          content: [
            {
              type: "text",
              text: "Mock response containing {{EMAIL_1}} and some other text.",
            },
          ],
          finishReason: "stop",
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 20, text: 20, reasoning: 0 },
          },
          rawCall: { rawPrompt: options.prompt, rawResult: {} },
        };
      },
    };

    const model = wrapLanguageModel({
      model: mockModel,
      middleware: redactMiddleware({
        tier: "rules",
      }),
    });

    const { text } = await generateText({
      model,
      prompt: "Hello, contact me at john.doe@example.com.",
    });

    // Verification 1: The model should receive redacted prompt
    expect(receivedPrompt).toContain("{{EMAIL_1}}");
    expect(receivedPrompt).not.toContain("john.doe@example.com");

    // Verification 2: The final output should have restored PII
    expect(text).toContain("john.doe@example.com");
    expect(text).not.toContain("{{EMAIL_1}}");
  });

  it("should redact input prompt and restore output response in wrapStream", async () => {
    let receivedPrompt = "";

    const mockModel = {
      specificationVersion: "v3",
      provider: "mock",
      modelId: "mock-model",
      doStream: async (options) => {
        receivedPrompt = JSON.stringify(options.prompt);

        // Generate chunks representing "Mock stream response containing {{EMAIL_1}}!"
        const chunks = [
          { type: "text-delta", id: "text-1", delta: "Mock stream " },
          { type: "text-delta", id: "text-1", delta: "response containing " },
          { type: "text-delta", id: "text-1", delta: "{{EM" },
          { type: "text-delta", id: "text-1", delta: "AIL" },
          { type: "text-delta", id: "text-1", delta: "_1" },
          { type: "text-delta", id: "text-1", delta: "}}!" },
        ];

        const readableStream = new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        });

        return {
          stream: readableStream,
          rawCall: { rawPrompt: options.prompt, rawResult: {} },
        };
      },
    };

    const model = wrapLanguageModel({
      model: mockModel,
      middleware: redactMiddleware({
        tier: "rules",
      }),
    });

    const { textStream } = await streamText({
      model,
      prompt: "Hello, contact me at john.doe@example.com.",
    });

    let fullText = "";
    for await (const textDelta of textStream) {
      fullText += textDelta;
    }

    // Verification 1: The model should receive redacted prompt
    expect(receivedPrompt).toContain("{{EMAIL_1}}");
    expect(receivedPrompt).not.toContain("john.doe@example.com");

    // Verification 2: The final streamed text should have restored PII
    expect(fullText).toBe("Mock stream response containing john.doe@example.com!");
  });
});
