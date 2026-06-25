// Web Worker for offloading NER detection from the main thread.
import { NERDetector } from "../detect/ner-detector.js";

let detector = null;

self.addEventListener("message", async (event) => {
  const { id, action, text, options } = event.data;

  if (action === "init") {
    try {
      detector = new NERDetector(options);
      await detector.load();
      self.postMessage({ id, status: "ready" });
    } catch (error) {
      self.postMessage({ id, status: "error", error: error.message });
    }
  } else if (action === "detect") {
    try {
      if (!detector) {
        detector = new NERDetector(options);
        await detector.load();
      }
      const entities = await detector.detect(text, options);
      self.postMessage({ id, status: "success", entities });
    } catch (error) {
      self.postMessage({ id, status: "error", error: error.message });
    }
  }
});
