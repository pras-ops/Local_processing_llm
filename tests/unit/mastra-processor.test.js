import { describe, it, expect } from "vitest";
import { MastraProcessor } from "../../src/middleware/mastra.js";

describe("Mastra Agent Processor", () => {
  it("should redact input messages and restore them in output step and result", async () => {
    const processor = new MastraProcessor({
      tier: "rules",
    });

    const requestContext = {
      runId: "test-run-123",
      threadId: "test-thread-456",
    };

    const messages = [
      {
        role: "user",
        content: "Hello, my email is test.user@example.com.",
      },
    ];

    // 1. Process Input
    const redactedMessages = await processor.processInput({
      messages,
      requestContext,
    });

    expect(redactedMessages[0].content).toContain("{{EMAIL_1}}");
    expect(redactedMessages[0].content).not.toContain("test.user@example.com");

    // Check that map is stored in context
    const store = processor.getMapStore(requestContext);
    expect(store.map["{{EMAIL_1}}"]).toBe("test.user@example.com");

    // 2. Process Output Step
    const outputMessages = [
      ...redactedMessages,
      {
        role: "assistant",
        content: "Okay, I received your email: {{EMAIL_1}}.",
      },
    ];

    const restoredMessages = await processor.processOutputStep({
      messages: outputMessages,
      requestContext,
    });

    expect(restoredMessages[restoredMessages.length - 1].content).toContain("test.user@example.com");
    expect(restoredMessages[restoredMessages.length - 1].content).not.toContain("{{EMAIL_1}}");

    // 3. Process Output Result
    const finalResult = {
      text: "Final confirmation: {{EMAIL_1}} is set.",
    };

    const restoredResult = await processor.processOutputResult({
      result: finalResult,
      requestContext,
    });

    expect(restoredResult.text).toBe("Final confirmation: test.user@example.com is set.");
  });

  it("should support independent maps for different request contexts", async () => {
    const processor = new MastraProcessor({
      tier: "rules",
    });

    const contextA = { runId: "req-a" };
    const contextB = { runId: "req-b" };

    const messagesA = [{ role: "user", content: "Email A: alice@example.com" }];
    const messagesB = [{ role: "user", content: "Email B: bob@example.com" }];

    await processor.processInput({ messages: messagesA, requestContext: contextA });
    await processor.processInput({ messages: messagesB, requestContext: contextB });

    const storeA = processor.getMapStore(contextA);
    const storeB = processor.getMapStore(contextB);

    expect(storeA.map["{{EMAIL_1}}"]).toBe("alice@example.com");
    expect(storeB.map["{{EMAIL_1}}"]).toBe("bob@example.com");
  });
});
