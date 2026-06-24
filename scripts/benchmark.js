import { Preprocessor } from "../src/index.js";
import { performance } from "perf_hooks";

// Generate mock text of a target size (in KB) containing HTML, URLs, whitespace, and PII
function generateMockText(sizeKb) {
  const piiSamples = [
    "Contact John Doe at john.doe@acme.org or call +1 (555) 019-9999.",
    "Visit https://example.com/portal/login to enter Visa card 4111-1111-1111-1111.",
    "Server IP is 192.168.1.100 and SSN is 999-12-3456.",
    "<html><body><div>Some extra HTML noise here with lots of whitespace     </div></body></html>"
  ];

  let output = "";
  const targetBytes = sizeKb * 1024;
  
  while (Buffer.byteLength(output, 'utf8') < targetBytes) {
    const randomSample = piiSamples[Math.floor(Math.random() * piiSamples.length)];
    output += randomSample + "\n";
  }

  return output;
}

async function runBenchmarks() {
  console.log("==================================================");
  console.log("  📊 RedactKit Performance Benchmarks");
  console.log("==================================================");
  console.log("Generating test datasets...");

  const datasets = {
    "10 KB": generateMockText(10),
    "1 MB": generateMockText(1024),
    "5 MB": generateMockText(5 * 1024),
  };

  const preprocessor = new Preprocessor();
  preprocessor.setLogging(false); // disable internal logs for raw performance measurement

  const results = [];

  for (const [label, text] of Object.entries(datasets)) {
    const byteLength = Buffer.byteLength(text, 'utf8');
    const kbSize = (byteLength / 1024).toFixed(2);
    console.log(`\nBenchmarking dataset: ${label} (${kbSize} KB)`);

    // 1. Clean Benchmark
    const t0 = performance.now();
    const cleaned = await preprocessor.clean(text, {
      removeHtml: true,
      removeUrls: true,
      removeExtraWhitespace: true
    });
    const t1 = performance.now();
    const cleanTime = t1 - t0;

    // 2. Chunk Benchmark
    const t2 = performance.now();
    const chunks = preprocessor.chunk(text, { size: 1000, strategy: "character" });
    const t3 = performance.now();
    const chunkTime = t3 - t2;

    // 3. Redact Benchmark (Rules-only)
    const t4 = performance.now();
    const { redacted, map } = await preprocessor.redact(text, {
      llm: { enabled: false }
    });
    const t5 = performance.now();
    const redactTime = t5 - t4;

    results.push({
      "Dataset Size": label,
      "Clean (ms)": cleanTime.toFixed(2),
      "Chunk (ms)": chunkTime.toFixed(2),
      "Redact PII (ms)": redactTime.toFixed(2),
      "PII Tokens Found": Object.keys(map).length
    });
  }

  console.log("\nBenchmark Results Table:");
  console.table(results);
  console.log("==================================================");
  console.log("Note: Benchmarks run in Node.js context (V8).");
  console.log("Rule-based redactions run with 0 dependencies.");
  console.log("==================================================");
}

runBenchmarks().catch(console.error);
