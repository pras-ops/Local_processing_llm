import { validateJSON } from "../utils/validation.js";
import { ModelNotLoadedError } from "../utils/errors.js";

/**
 * LLMDetector — Tier 3 (optional) PII detection via a local LLM.
 *
 * Wraps the existing engine path (Ollama in Node, WebLLM in browser): it prompts
 * the model to return entities as JSON, then validates and converts them to
 * `{ value, type, source:'llm' }` candidates. This is the most expensive tier and
 * is only used when explicitly enabled.
 */
const NER_PROMPT = (text) => `Identify all names of people, physical addresses (street addresses, cities, locations, zip codes), and organization names (companies, brands, groups) in the following text.
Return the result strictly as a JSON object with this format:
{
  "names": ["name1", "name2"],
  "addresses": ["address1", "address2"],
  "organizations": ["org1", "org2"]
}
Do not include any extra commentary. If none are found, return empty lists.

Text:
${text}`;

export class LLMDetector {
  /**
   * @param {Object} engine - object with run(prompt, opts), isLoaded(), getLogger()
   * @param {Object} llmOptions - { names, addresses, organizations }
   */
  constructor(engine, llmOptions = {}) {
    this.name = "llm";
    this.engine = engine;
    this.options = { names: true, addresses: true, organizations: true, ...llmOptions };
  }

  async detect(text, opts = {}) {
    if (!this.engine || !this.engine.isLoaded()) {
      throw new ModelNotLoadedError("LLM-assisted PII redaction");
    }
    if (!text) return [];

    const logger = this.engine.getLogger?.();
    logger?.log("info", "REDACT", "Running LLM-assisted entity detection (Tier 3)");

    const raw = await this.engine.run(NER_PROMPT(text), { temperature: 0.1 });
    const validation = validateJSON(raw, []);
    if (!validation.isValid || !validation.data) {
      logger?.log("warn", "REDACT", "LLM entity detection returned invalid JSON", { rawResponse: raw });
      return [];
    }

    const data = validation.data;
    const entities = [];
    const add = (list, type, minLen) => {
      if (!Array.isArray(list)) return;
      for (const val of list) {
        if (typeof val === "string" && val.trim().length > minLen) {
          entities.push({ value: val.trim(), type, source: "llm" });
        }
      }
    };

    if (this.options.names) add(data.names, "NAME", 1);
    if (this.options.addresses) add(data.addresses, "ADDRESS", 2);
    if (this.options.organizations) add(data.organizations, "ORGANIZATION", 1);

    return entities;
  }
}
