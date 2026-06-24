/**
 * MapStore — local, in-memory store for redaction maps with a TTL.
 *
 * This is the privacy-layer analog of headroom's reversible cache (CCR): the
 * mapping from placeholders ({{EMAIL_1}}) back to the original PII is kept ONLY
 * on the local machine for a configurable time-to-live, so responses can be
 * restored without ever sending originals to a third party. Nothing here is
 * written to disk or transmitted; when the TTL expires the originals are gone.
 */
export class MapStore {
  /**
   * @param {Object} options
   * @param {number} [options.ttlMs=3600000] - How long to retain a map (ms).
   * @param {number} [options.sweepMs=60000] - How often to purge expired maps (ms).
   */
  constructor(options = {}) {
    this.ttlMs = options.ttlMs ?? 60 * 60 * 1000; // 1 hour
    this.entries = new Map(); // id -> { map, expiresAt }
    const sweepMs = options.sweepMs ?? 60 * 1000;
    this.timer = setInterval(() => this.sweep(), sweepMs);
    // Don't keep the Node process alive just for the sweep timer.
    if (this.timer.unref) this.timer.unref();
  }

  /** Store a map under a fresh id and return the id. */
  put(map, id = randomId()) {
    this.entries.set(id, { map, expiresAt: Date.now() + this.ttlMs });
    return id;
  }

  /** Retrieve a map by id, or null if missing/expired. */
  get(id) {
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(id);
      return null;
    }
    return entry.map;
  }

  /** Forget a map immediately (e.g. once a conversation ends). */
  delete(id) {
    return this.entries.delete(id);
  }

  /** Remove all expired entries. */
  sweep() {
    const now = Date.now();
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt < now) this.entries.delete(id);
    }
  }

  /** Stop the background sweep timer. */
  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.entries.clear();
  }
}

function randomId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}
