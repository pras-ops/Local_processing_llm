import { describe, it, expect } from "vitest";
import { compress, detectType } from "../../src/compress/compress.js";
import { compressJSON, prune } from "../../src/compress/json-compress.js";

describe("detectType", () => {
  it("detects json, html, and text", () => {
    expect(detectType('{"a":1}')).toBe("json");
    expect(detectType("<div>hi</div>")).toBe("html");
    expect(detectType("just words")).toBe("text");
    expect(detectType("{not valid json")).toBe("text"); // invalid json falls back to text
  });
});

describe("compressJSON", () => {
  it("minifies whitespace and stays valid", () => {
    const input = '{\n  "a": 1,\n  "b": [1, 2, 3]\n}';
    const out = compressJSON(input);
    expect(out).toBe('{"a":1,"b":[1,2,3]}');
    expect(JSON.parse(out)).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it("prunes empty values with dropEmpty", () => {
    const obj = { a: 1, b: null, c: "", d: [], e: {}, f: { g: "", h: 2 } };
    expect(prune(obj)).toEqual({ a: 1, f: { h: 2 } });
    expect(JSON.parse(compressJSON(obj, { dropEmpty: true }))).toEqual({ a: 1, f: { h: 2 } });
  });
});

describe("compress (rule-based)", () => {
  it("collapses whitespace and dedupes adjacent lines in text", () => {
    const text = "hello    world\n\n\n\nhello    world\nhello    world\nbye";
    const { compressed, before, after, ratio, type } = compress(text);
    expect(type).toBe("text");
    expect(compressed).toBe("hello world\n\nhello world\nbye");
    expect(after).toBeLessThan(before);
    expect(ratio).toBeLessThan(1);
  });

  it("strips HTML tags and entities", () => {
    const { compressed, type } = compress("<p>Hello&nbsp;<b>world</b></p>");
    expect(type).toBe("html");
    expect(compressed).not.toContain("<");
    expect(compressed).toContain("Hello world");
  });

  it("minifies JSON and reports a ratio", () => {
    const { compressed, ratio } = compress('{\n  "x": 1\n}');
    expect(compressed).toBe('{"x":1}');
    expect(ratio).toBeLessThan(1);
  });

  it("respects an explicit type override", () => {
    // looks like text, force json handling
    expect(() => compress("not json", { type: "json" })).toThrow();
  });
});
