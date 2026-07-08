import fs from "fs";
import path from "path";

const FEEDBACK_DIR = path.join(process.cwd(), "datasets", "feedback");
const ALPHA_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_kaggle_v2");
const FSL_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_105");
const OUTPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_unified");

const correctionsFile = path.join(FEEDBACK_DIR, "corrections.jsonl");
if (!fs.existsSync(correctionsFile)) {
  console.log("No corrections found at", correctionsFile);
  process.exit(0);
}

const lines = fs.readFileSync(correctionsFile, "utf8").trim().split("\n").filter(Boolean);
const corrections = lines.map((l) => JSON.parse(l));

console.log(`Loaded ${corrections.length} correction samples`);

const alphaLabels = JSON.parse(fs.readFileSync(path.join(ALPHA_DIR, "labels.json"), "utf8"));
const fslLabels = JSON.parse(fs.readFileSync(path.join(FSL_DIR, "labels.json"), "utf8"));

const allLabels = [...alphaLabels.labels, ...fslLabels.labels];
const labelToId = {};
allLabels.forEach((l, i) => { labelToId[l.toUpperCase()] = i; });

const unifiedLabels = { labels: allLabels, labelToId, idToLabel: Object.fromEntries(allLabels.map((l, i) => [i, l])) };
fs.writeFileSync(path.join(OUTPUT_DIR, "labels.json"), JSON.stringify(unifiedLabels, null, 2));

const outputPath = path.join(OUTPUT_DIR, "feedback.json");
const feedbackSamples = corrections
  .filter((c) => labelToId[c.label] !== undefined)
  .map((c) => ({
    label: c.label,
    labelId: labelToId[c.label],
    sequence: c.sequence,
    sequenceLength: c.sequenceLength || Math.floor(c.sequence.length / 126),
    featureDimension: 126,
    originalFrameCount: c.sequenceLength || Math.floor(c.sequence.length / 126),
    source: "user-correction",
    timestamp: c.timestamp,
  }));

fs.writeFileSync(outputPath, JSON.stringify({ samples: feedbackSamples, totalSamples: feedbackSamples.length }, null, 2));
console.log(`Saved ${feedbackSamples.length} feedback samples to ${outputPath}`);
