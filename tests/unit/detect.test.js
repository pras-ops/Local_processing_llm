import { describe, it, expect } from "vitest";
import { RegexDetector } from "../../src/detect/regex-detector.js";
import { mergeSpans, dedupeSemantic } from "../../src/detect/router.js";
import { chunkWithOffsets, groupEntities } from "../../src/detect/ner-detector.js";
import { redact, restore } from "../../src/preprocess/redact.js";

describe("RegexDetector (Tier 1)", () => {
  it("returns email entities longest-first in canonical order", () => {
    const text = "Send questions to support@example.com and contact admin@domain.org.";
    const entities = new RegexDetector().detect(text, { rules: { email: true } });
    expect(entities.map((e) => e.value)).toEqual(["support@example.com", "admin@domain.org"]);
    expect(entities.every((e) => e.type === "EMAIL" && e.source === "regex")).toBe(true);
  });

  it("validates credit cards with Luhn and skips invalid ones", () => {
    const text = "good 4111-1111-1111-1111 bad 4111-1111-1111-1112";
    const entities = new RegexDetector().detect(text, { rules: { creditCard: true } });
    expect(entities.map((e) => e.value)).toEqual(["4111-1111-1111-1111"]);
  });

  it("emits deny-list and custom-pattern entities", () => {
    const entities = new RegexDetector().detect("order ORD-12345 secret SECRET_X", {
      rules: {},
      customPatterns: [{ name: "ORDER_NUM", regex: /ORD-\d+/g }],
      denyList: ["SECRET_X"],
    });
    const byType = Object.fromEntries(entities.map((e) => [e.type, e.value]));
    expect(byType.CUSTOM_DENIED).toBe("SECRET_X");
    expect(byType.ORDER_NUM).toBe("ORD-12345");
  });
});

describe("router utilities", () => {
  it("mergeSpans keeps the strongest, drops overlaps", () => {
    const spans = [
      { start: 0, end: 10, score: 0.5 },
      { start: 5, end: 8, score: 0.9 }, // overlaps the first
      { start: 12, end: 20, score: 0.7 },
    ];
    const merged = mergeSpans(spans);
    expect(merged.map((s) => [s.start, s.end])).toEqual([
      [0, 10],
      [12, 20],
    ]);
  });

  it("dedupeSemantic dedupes by value (highest score) and sorts longest-first", () => {
    const out = dedupeSemantic([
      { value: "John", type: "NAME", score: 0.5 },
      { value: "John Smith", type: "NAME", score: 0.9 },
      { value: "John", type: "NAME", score: 0.8 },
    ]);
    expect(out.map((e) => e.value)).toEqual(["John Smith", "John"]);
    expect(out.find((e) => e.value === "John").score).toBe(0.8);
  });
});

describe("NER helpers", () => {
  it("chunkWithOffsets splits long text on whitespace with correct offsets", () => {
    const text = "a".repeat(50) + " " + "b".repeat(50);
    const chunks = chunkWithOffsets(text, 60);
    expect(chunks.length).toBeGreaterThan(1);
    // each chunk maps back to the original text at its offset
    for (const { chunk, offset } of chunks) {
      expect(text.slice(offset, offset + chunk.length)).toBe(chunk);
    }
  });

  it("groupEntities merges BIO word-pieces into phrases", () => {
    const tokens = [
      { entity: "B-PER", score: 1, word: "Sarah" },
      { entity: "I-PER", score: 1, word: "Johnson" },
      { entity: "B-LOC", score: 0.9, word: "Boston" },
      { entity: "B-PER", score: 0.9, word: "John" },
      { entity: "I-PER", score: 0.9, word: "##son" }, // BERT subword
    ];
    const groups = groupEntities(tokens);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ label: "NAME", phrase: "Sarah Johnson" });
    expect(groups[1]).toMatchObject({ label: "ADDRESS", phrase: "Boston" });
    expect(groups[2]).toMatchObject({ label: "NAME", phrase: "Johnson" });
  });
});

describe("redact() tiered integration", () => {
  it("tier=ner combines regex + injected NER detector and restores", async () => {
    const nerMock = {
      name: "ner",
      detect: async () => [{ value: "John Carter", type: "NAME", source: "ner", score: 0.95 }],
    };
    const text = "Hello John Carter, email me at a@b.com";
    const { redacted, map } = await redact(null, text, {
      tier: "ner",
      nerDetector: nerMock,
      rules: { email: true },
    });

    expect(redacted).toContain("{{NAME_1}}");
    expect(redacted).toContain("{{EMAIL_1}}");
    expect(redacted).not.toContain("John Carter");
    expect(map["{{NAME_1}}"]).toBe("John Carter");
    expect(restore(redacted, map)).toBe(text);
  });

  it("tier=auto degrades to regex-only when the NER detector fails", async () => {
    const failing = {
      name: "ner",
      getLogger: () => ({ log() {} }),
      detect: async () => {
        throw new Error("transformers not installed");
      },
    };
    const { redacted, map } = await redact(null, "reach me at a@b.com", {
      tier: "auto",
      nerDetector: failing,
      rules: { email: true },
    });
    expect(redacted).toContain("{{EMAIL_1}}");
    expect(map["{{EMAIL_1}}"]).toBe("a@b.com");
  });
});
