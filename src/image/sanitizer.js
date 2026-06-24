import { OcrPiiRegionDetector } from "./ocr-region-detector.js";
import { FaceRegionDetector } from "./face-region-detector.js";
import { blurRegions, recompress } from "./blur.js";
import { getLogger } from "../utils/logger.js";

/**
 * ImageSanitizer — blurs sensitive data in images, the privacy counterpart to
 * headroom's image compression.
 *
 * It runs region detectors (OCR text-PII and/or faces), blurs the resulting
 * boxes with sharp, and optionally recompresses to cut bytes/tokens.
 *
 * IMPORTANT: image blur is ONE-WAY (destructive). Unlike text redaction there is
 * no restore — the original pixels are gone. That is the intended privacy
 * behaviour for images. Detected regions are returned as an audit record only.
 */
export class ImageSanitizer {
  constructor(options = {}) {
    this.textPII = options.textPII !== false; // default on
    this.faces = options.faces === true; // default off (needs a model)
    this.graceful = options.graceful !== false; // tolerate missing face model by default
    this.logger = options.logger || getLogger(options.loggerOptions);

    this.ocr = options.ocrDetector || new OcrPiiRegionDetector(options.ocr || {});
    this.faceDetector = options.faceDetector || new FaceRegionDetector(options.face || {});
  }

  /**
   * @param {Buffer} imageBuffer
   * @param {Object} opts - { compress, pixelate, sigma, tier, threshold, ... }
   * @returns {Promise<{ image: Buffer, regions: Array }>}
   */
  async sanitize(imageBuffer, opts = {}) {
    const regions = [];

    if (this.textPII) {
      try {
        regions.push(...(await this.ocr.detect(imageBuffer, opts)));
      } catch (e) {
        if (!this.graceful) throw e;
        this.logger.log("warn", "IMAGE", "OCR text-PII detection unavailable", { error: e.message });
      }
    }

    if (this.faces) {
      try {
        regions.push(...(await this.faceDetector.detect(imageBuffer, opts)));
      } catch (e) {
        if (!this.graceful) throw e;
        this.logger.log("warn", "IMAGE", "Face detection unavailable", { error: e.message });
      }
    }

    let image = imageBuffer;
    if (regions.length) {
      image = await blurRegions(imageBuffer, regions, opts);
      this.logger.log("info", "IMAGE", `Blurred ${regions.length} sensitive region(s)`);
    }
    if (opts.compress) image = await recompress(image, opts);

    return { image, regions };
  }
}
