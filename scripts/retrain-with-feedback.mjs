import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const FEEDBACK_DIR = path.join(process.cwd(), "datasets", "feedback");
const ALPHA_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_kaggle_v2");
const FSL_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_105");
const UNIFIED_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_unified");

const correctionsFile = path.join(FEEDBACK_DIR, "corrections.jsonl");
const feedbackMerged = path.join(UNIFIED_DIR, "feedback.json");

if (!fs.existsSync(correctionsFile)) {
  console.log("No feedback corrections found. Nothing to retrain on.");
  process.exit(0);
}

const lines = fs.readFileSync(correctionsFile, "utf8").trim().split("\n").filter(Boolean);
console.log(`Found ${lines.length} feedback corrections`);

const alphaLabels = JSON.parse(fs.readFileSync(path.join(ALPHA_DIR, "labels.json"), "utf8"));
const fslLabels = JSON.parse(fs.readFileSync(path.join(FSL_DIR, "labels.json"), "utf8"));
const allLabels = [...alphaLabels.labels, ...fslLabels.labels];
const labelToId = {};
allLabels.forEach((l, i) => { labelToId[l.toUpperCase()] = i; });

const valid = lines.map((l) => JSON.parse(l)).filter((c) => labelToId[c.label] !== undefined);
console.log(`${valid.length} valid corrections`);

if (valid.length < 5) {
  console.log("Need at least 5 valid corrections to retrain. Skipping.");
  process.exit(0);
}

fs.writeFileSync(feedbackMerged, JSON.stringify({
  samples: valid.map((c) => ({
    label: c.label, labelId: labelToId[c.label],
    sequence: c.sequence,
    sequenceLength: c.sequenceLength || Math.floor(c.sequence.length / 126),
    featureDimension: 126,
    source: "user-correction",
    timestamp: c.timestamp,
  })),
  totalSamples: valid.length,
}, null, 2));

console.log(`\nRunning full retrain pipeline with ${valid.length} feedback samples...\n`);

const scripts = [
  { name: "Training v2", cmd: "node scripts/train-unified-bilstm-v2.mjs" },
  { name: "Exporting to TF.js", cmd: "node scripts/export-unified-bilstm-tfjs.mjs" },
];

for (const { name, cmd } of scripts) {
  console.log(`\n=== ${name} ===`);
  try {
    execSync(cmd, { cwd: process.cwd(), stdio: "inherit", timeout: 3600000 });
  } catch (err) {
    console.error(`${name} failed: ${err.message}`);
    process.exit(1);
  }
}

console.log("\n=== Retrain complete! ===");
console.log(`Model updated with ${valid.length} feedback corrections.`);
