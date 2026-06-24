/**
 * sharp-based image helpers: blur/pixelate specific regions and recompress.
 *
 * sharp is an OPTIONAL dependency, imported lazily so non-image features stay
 * dependency-free. Region blurring works by extracting each box, blurring (or
 * pixelating) it, and compositing it back over the original.
 */

async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch (e) {
    throw new Error("Image features need the optional dependency 'sharp'. Install it: npm i sharp");
  }
}

/** Normalize regions: integer coords, clamped to the image, drop degenerate boxes. */
export function clampRegions(regions, width, height) {
  const out = [];
  for (const r of regions) {
    const x = Math.max(0, Math.floor(r.x));
    const y = Math.max(0, Math.floor(r.y));
    const w = Math.min(Math.ceil(r.w), width - x);
    const h = Math.min(Math.ceil(r.h), height - y);
    if (w >= 1 && h >= 1) out.push({ ...r, x, y, w, h });
  }
  return out;
}

/**
 * Blur (or pixelate) the given regions of an image.
 * @param {Buffer} imageBuffer
 * @param {Array<{x,y,w,h}>} regions
 * @param {Object} opts - { sigma=12, pixelate=false, sharp? }
 * @returns {Promise<Buffer>}
 */
export async function blurRegions(imageBuffer, regions, opts = {}) {
  const sharp = opts.sharp || (await loadSharp());
  const base = sharp(imageBuffer);
  const meta = await base.metadata();
  const boxes = clampRegions(regions, meta.width, meta.height);
  if (boxes.length === 0) return imageBuffer;

  const overlays = [];
  for (const r of boxes) {
    let patch = sharp(imageBuffer).extract({ left: r.x, top: r.y, width: r.w, height: r.h });
    if (opts.pixelate) {
      const small = Math.max(1, Math.round(Math.min(r.w, r.h) / 10));
      patch = patch.resize(small, small, { fit: "fill" }).resize(r.w, r.h, { kernel: "nearest" });
    } else {
      patch = patch.blur(opts.sigma ?? 12);
    }
    overlays.push({ input: await patch.toBuffer(), left: r.x, top: r.y });
  }
  return base.composite(overlays).toBuffer();
}

/**
 * Recompress an image (resize + re-encode) to cut bytes/tokens.
 * @param {Buffer} buf
 * @param {Object} opts - { maxWidth=1024, quality=70, sharp? }
 * @returns {Promise<Buffer>}
 */
export async function recompress(buf, opts = {}) {
  const sharp = opts.sharp || (await loadSharp());
  return sharp(buf)
    .resize({ width: opts.maxWidth ?? 1024, withoutEnlargement: true })
    .jpeg({ quality: opts.quality ?? 70 })
    .toBuffer();
}
