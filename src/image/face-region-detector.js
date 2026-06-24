import { getLogger } from "../utils/logger.js";

/**
 * FaceRegionDetector — finds people/faces to blur.
 *
 * Uses the local object-detection pipeline from transformers.js (already a
 * project dependency), so no new model runtime is needed. The default model
 * detects "person"; a face-specific ONNX model can be supplied via `model`.
 * Runs fully on-device; the model is cached after first download.
 *
 * This tier is optional and degrades gracefully (see ImageSanitizer) when the
 * dependency/model isn't available.
 */
const DEFAULT_MODEL = "Xenova/detr-resnet-50";
const FACE_LABELS = new Set(["face", "person", "head"]);

function boxFromDetection(box) {
  // transformers.js object-detection returns pixel coords {xmin,ymin,xmax,ymax}
  return {
    x: box.xmin,
    y: box.ymin,
    w: box.xmax - box.xmin,
    h: box.ymax - box.ymin,
    source: "face",
  };
}

export class FaceRegionDetector {
  constructor(options = {}) {
    this.name = "face";
    this.model = options.model || DEFAULT_MODEL;
    this.threshold = options.threshold ?? 0.5;
    this.device = options.device;
    this.logger = options.logger || getLogger(options.loggerOptions);
    this.pipe = null;
    this.RawImage = null;
  }

  async load() {
    if (this.pipe) return;
    let t;
    try {
      t = await import("@huggingface/transformers");
    } catch (e) {
      throw new Error(
        "Face detection needs the optional dependency '@huggingface/transformers'. Install it: npm i @huggingface/transformers"
      );
    }
    this.RawImage = t.RawImage;
    const opts = {};
    if (this.device) opts.device = this.device;
    this.logger.log("info", "FACE", `Loading object-detection model: ${this.model}`);
    this.pipe = await t.pipeline("object-detection", this.model, opts);
  }

  /**
   * @param {Buffer} imageBuffer
   * @returns {Promise<Array<{x,y,w,h,source}>>}
   */
  async detect(imageBuffer, opts = {}) {
    if (!this.pipe) await this.load();
    const image = await this.RawImage.fromBlob(new Blob([imageBuffer]));
    const dets = await this.pipe(image, { threshold: opts.threshold ?? this.threshold });
    return dets
      .filter((d) => FACE_LABELS.has(String(d.label).toLowerCase()))
      .map((d) => boxFromDetection(d.box));
  }
}

export { DEFAULT_MODEL };
