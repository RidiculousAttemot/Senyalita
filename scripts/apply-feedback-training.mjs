import fs from "fs";
import path from "path";

const FEEDBACK_DIR = path.join(process.cwd(), "datasets", "feedback");
const ALPHA_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_kaggle_v2");
const FSL_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_105");

const correctionsFile = path.join(FEEDBACK_DIR, "corrections.jsonl");
if (!fs.existsSync(correctionsFile)) {
  console.log("No feedback corrections found. Nothing to merge.");
  process.exit(0);
}

const lines = fs.readFileSync(correctionsFile, "utf8").trim().split("\n").filter(Boolean);
const corrections = lines.map((l) => JSON.parse(l));
console.log(`Found ${corrections.length} feedback corrections`);

const alphaLabels = JSON.parse(fs.readFileSync(path.join(ALPHA_DIR, "labels.json"), "utf8"));
const fslLabels = JSON.parse(fs.readFileSync(path.join(FSL_DIR, "labels.json"), "utf8"));
const allLabels = [...alphaLabels.labels, ...fslLabels.labels];
const labelToId = {};
allLabels.forEach((l, i) => { labelToId[l.toUpperCase()] = i; });

const valid = corrections.filter((c) => labelToId[c.label] !== undefined);
console.log(`${valid.length} valid corrections (${corrections.length - valid.length} skipped - unknown labels)`);

if (valid.length === 0) {
  console.log("No valid corrections to merge.");
  process.exit(0);
}

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;

const feedbackSamples = [];
for (const c of valid) {
  const featureLen = c.sequence?.length || 0;
  const frames = Math.floor(featureLen / FEATURE_DIMENSION);
  if (frames < 5) continue;

  const seq = new Array(SEQUENCE_LENGTH).fill(null).map(() => new Float32Array(FEATURE_DIMENSION));
  for (let i = 0; i < Math.min(frames, SEQUENCE_LENGTH); i++) {
    const src = i * FEATURE_DIMENSION;
    for (let j = 0; j < FEATURE_DIMENSION; j++) {
      seq[i][j] = c.sequence[src + j] || 0;
    }
  }

  feedbackSamples.push({
    label: c.label,
    labelId: labelToId[c.label],
    sequence: seq.map((f) => Array.from(f)),
    originalFrameCount: Math.min(frames, SEQUENCE_LENGTH),
  });
}

const outPath = path.join(FEEDBACK_DIR, "training_data.json");
const out = { samples: feedbackSamples, totalSamples: feedbackSamples.length };
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Saved ${feedbackSamples.length} training samples to ${outPath}`);
console.log("Run the following to retrain with feedback:");
console.log(`  $env:TRAINING_FEEDBACK_PATH = "${outPath}"`);
console.log("  node scripts/train-unified-bilstm-v2.mjs");
console.log("  node scripts/export-unified-bilstm-tfjs.mjs");
