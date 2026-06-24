import { describe, it, expect } from "vitest";
import { clampRegions, blurRegions } from "../../src/image/blur.js";
import { ImageSanitizer } from "../../src/image/sanitizer.js";

// sharp is an optional dep — skip the real-image tests gracefully if absent.
let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  /* not installed */
}
const withSharp = sharp ? describe : describe.skip;

const W = 80;
const H = 40;

/** Build a two-tone (red | green) PNG so blurring across the seam changes pixels. */
async function twoTonePng() {
  const px = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      if (x < W / 2) px[i] = 255; // red
      else px[i + 1] = 255; // green
    }
  }
  return sharp(px, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

describe("clampRegions", () => {
  it("rounds, clamps to bounds, and drops degenerate boxes", () => {
    const out = clampRegions(
      [
        { x: -5, y: 5.7, w: 200, h: 10 }, // clamps x to 0, width to image
        { x: 10, y: 10, w: 0, h: 10 }, // degenerate -> dropped
      ],
      100,
      100
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ x: 0, y: 5, w: 100 });
  });
});

withSharp("blurRegions (real sharp)", () => {
  it("changes pixels inside the region but preserves dimensions", async () => {
    const input = await twoTonePng();
    const out = await blurRegions(input, [{ x: 30, y: 0, w: 20, h: H }], { sigma: 5 });

    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(W);
    expect(meta.height).toBe(H);

    const inRegion = await sharp(input).extract({ left: 30, top: 0, width: 20, height: H }).raw().toBuffer();
    const outRegion = await sharp(out).extract({ left: 30, top: 0, width: 20, height: H }).raw().toBuffer();
    expect(outRegion.equals(inRegion)).toBe(false); // blurred across the red/green seam
  });

  it("returns the original when there are no regions", async () => {
    const input = await twoTonePng();
    const out = await blurRegions(input, [], {});
    expect(out.equals(input)).toBe(true);
  });
});

withSharp("ImageSanitizer (mocked detectors)", () => {
  it("blurs the region from an injected OCR detector", async () => {
    const input = await twoTonePng();
    const ocrMock = { name: "ocr", detect: async () => [{ x: 30, y: 0, w: 20, h: H, source: "ocr" }] };
    const sanitizer = new ImageSanitizer({ textPII: true, faces: false, ocrDetector: ocrMock });

    const { image, regions } = await sanitizer.sanitize(input, { sigma: 5 });
    expect(regions).toHaveLength(1);
    expect(image.equals(input)).toBe(false);
  });

  it("degrades gracefully when a detector throws", async () => {
    const input = await twoTonePng();
    const failing = { name: "ocr", detect: async () => { throw new Error("tesseract missing"); } };
    const sanitizer = new ImageSanitizer({ textPII: true, faces: false, ocrDetector: failing, graceful: true });

    const { image, regions } = await sanitizer.sanitize(input, {});
    expect(regions).toHaveLength(0);
    expect(image.equals(input)).toBe(true); // nothing blurred, original returned
  });
});
