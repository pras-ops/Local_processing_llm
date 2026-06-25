import { describe, it, expect } from "vitest";
import { WorkerPool } from "../../src/workers/worker-pool.js";
import { Preprocessor } from "../../src/index.js";

describe("Worker Pool & Offloading", () => {
  it("should initialize WorkerPool and fall back to in-thread execution in Node.js", async () => {
    const pool = new WorkerPool();
    expect(pool.worker).toBeNull();

    // In Node.js, window is undefined, so it should run NER in-thread fallback.
    // Let's run detect on a text with person names (requiring NER).
    const text = "My name is John Doe and I work at Google.";
    const entities = await pool.detect(text, {
      tier: "ner",
      ner: {
        task: "ner",
        model: "Xenova/bert-base-NER",
      },
    });

    // Since this runs in Node, it should load transformers.js and return correct entities
    const personEntity = entities.find(e => e.type === "NAME" && e.value === "John Doe");
    const orgEntity = entities.find(e => e.type === "ORGANIZATION" && e.value === "Google");

    expect(personEntity).toBeDefined();
    expect(orgEntity).toBeDefined();
  });

  it("should trigger offloading in Preprocessor when offload: true options are passed", async () => {
    const preprocessor = new Preprocessor({
      offload: true,
    });

    expect(preprocessor.offload).toBe(true);
    expect(preprocessor.workerPool).toBeNull(); // lazily initialized

    const text = "Send details to Alice at Google.";
    const { redacted } = await preprocessor.redact(text, {
      tier: "ner",
      ner: {
        task: "ner",
        model: "Xenova/bert-base-NER",
      },
    });

    expect(preprocessor.workerPool).toBeDefined();
    expect(redacted).toContain("{{NAME_1}}");
    expect(redacted).toContain("{{ORGANIZATION_1}}");
  });
});
