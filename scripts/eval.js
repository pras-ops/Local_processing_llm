import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Preprocessor } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, "../tests/data/eval-slice.json");

async function evaluate(tier) {
  const dataset = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const preprocessor = new Preprocessor();

  let totalTP = 0;
  let totalFP = 0;
  let totalFN = 0;

  const typeStats = {};

  console.log(`\nEvaluating tier: ${tier}...`);

  for (const example of dataset) {
    // Run redact to get the map (which holds placeholders -> original values)
    // We can extract detected entities from the map.
    const { map } = await preprocessor.redact(example.text, {
      tier,
      // If evaluating NER tier, let's configure the labels/options.
      ner: {
        task: "ner",
        model: "Xenova/bert-base-NER",
      },
    });

    const detected = [];
    for (const [placeholder, value] of Object.entries(map)) {
      // placeholder has format {{TYPE_1}} or similar
      const match = placeholder.match(/^\{\{([A-Z_]+)_\d+\}\}$|^\{\{([A-Z_]+)_\d+:(.+)\}\}$/);
      if (match) {
        const type = match[1] || match[2];
        detected.push({ value, type });
      }
    }

    const groundTruth = example.entities;

    // Track matching for this example
    const matchedGT = new Set();
    const matchedDetected = new Set();

    // Calculate TP
    for (let i = 0; i < detected.length; i++) {
      const d = detected[i];
      for (let j = 0; j < groundTruth.length; j++) {
        if (matchedGT.has(j)) continue;
        const gt = groundTruth[j];

        // Exact match of value and type (case-insensitive for type, exact/normalized for value)
        if (
          d.value.toLowerCase().trim() === gt.value.toLowerCase().trim() &&
          d.type.toUpperCase() === gt.type.toUpperCase()
        ) {
          matchedGT.add(j);
          matchedDetected.add(i);
          totalTP++;

          // Update type stats
          const type = gt.type;
          if (!typeStats[type]) typeStats[type] = { tp: 0, fp: 0, fn: 0 };
          typeStats[type].tp++;
          break;
        }
      }
    }

    // Calculate FP (detected but not in GT)
    for (let i = 0; i < detected.length; i++) {
      if (matchedDetected.has(i)) continue;
      const d = detected[i];
      totalFP++;

      const type = d.type;
      if (!typeStats[type]) typeStats[type] = { tp: 0, fp: 0, fn: 0 };
      typeStats[type].fp++;
    }

    // Calculate FN (in GT but not detected)
    for (let j = 0; j < groundTruth.length; j++) {
      if (matchedGT.has(j)) continue;
      const gt = groundTruth[j];
      totalFN++;

      const type = gt.type;
      if (!typeStats[type]) typeStats[type] = { tp: 0, fp: 0, fn: 0 };
      typeStats[type].fn++;
    }
  }

  // Calculate overall metrics
  const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  console.log(`\nResults for ${tier}:`);
  console.log(`------------------------------------`);
  console.log(`Precision : ${(precision * 100).toFixed(2)}%`);
  console.log(`Recall    : ${(recall * 100).toFixed(2)}%`);
  console.log(`F1-Score  : ${(f1 * 100).toFixed(2)}%`);
  console.log(`TP: ${totalTP}, FP: ${totalFP}, FN: ${totalFN}`);

  // Detailed breakdown per entity type
  console.log(`\n| Entity Type | Precision | Recall | F1-Score | TP | FP | FN |`);
  console.log(`|---|---|---|---|---|---|---|`);
  for (const [type, stats] of Object.entries(typeStats)) {
    const p = stats.tp + stats.fp > 0 ? stats.tp / (stats.tp + stats.fp) : 0;
    const r = stats.tp + stats.fn > 0 ? stats.tp / (stats.tp + stats.fn) : 0;
    const f = p + r > 0 ? (2 * p * r) / (p + r) : 0;

    console.log(
      `| ${type} | ${(p * 100).toFixed(1)}% | ${(r * 100).toFixed(1)}% | ${(f * 100).toFixed(1)}% | ${
        stats.tp
      } | ${stats.fp} | ${stats.fn} |`
    );
  }

  return { precision, recall, f1, totalTP, totalFP, totalFN, typeStats };
}

async function run() {
  console.log("Starting RedactKit Accuracy Evaluation Suite...");
  console.log(`Loading evaluation dataset from: ${DATA_PATH}`);

  // Evaluate rules tier
  const rulesResult = await evaluate("rules");

  // If we want to run NER, we can try. Since loading NER requires downloading bert-base-NER
  // and running transformers.js, we only attempt if '--ner' flag is present to avoid slow test runs by default.
  const runNer = process.argv.includes("--ner");
  if (runNer) {
    try {
      await evaluate("ner");
    } catch (e) {
      console.error("\nError evaluating NER tier:", e.message);
    }
  } else {
    console.log("\nSkipping NER evaluation (pass --ner flag to run NER evaluation)");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
