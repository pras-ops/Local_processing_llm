import { generateText, wrapLanguageModel } from "ai";
import { redactMiddleware } from "../src/middleware/ai-sdk.js";

// A mock LanguageModelV3 that echoes back the prompt it receives
const mockModel = {
  specificationVersion: "v3",
  provider: "mock-provider",
  modelId: "mock-model",
  doGenerate: async (options) => {
    const prompt = options.prompt || "";
    console.log("Model received (Redacted prompt):", JSON.stringify(prompt));
    return {
      content: [
        {
          type: "text",
          text: `Mock LLM Response: Hello {{USER_1}}, I received your prompt "${prompt}" and will email {{EMAIL_1}} accordingly.`
        }
      ],
      finishReason: "stop",
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 20, text: 20, reasoning: 0 },
      },
      rawCall: { rawPrompt: prompt, rawResult: {} },
    };
  },
};

// Wrap the model with RedactKit privacy middleware
const model = wrapLanguageModel({
  model: mockModel,
  middleware: redactMiddleware({
    tier: "rules",
  }),
});

console.log("--- RedactKit Vercel AI SDK Integration Demo ---");
console.log("Original input prompt: 'Hello, my name is John Doe, email me at john.doe@example.com.'\n");

// Call generateText normally
const { text } = await generateText({
  model,
  prompt: "Hello, my name is John Doe, email me at john.doe@example.com.",
});

console.log("\nRestored output response:\n", text);
console.log("-------------------------------------------------");
