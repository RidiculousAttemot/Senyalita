#!/usr/bin/env node
import fs from "fs";
import path from "path";

const LABELS = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];

const PROJECT_ROOT = process.cwd();
const PROCESSED_DIRS = [
  path.join(PROJECT_ROOT, "datasets", "processed", "fsl_alphabet"),
  path.join(PROJECT_ROOT, "datasets", "processed", "fsl_alphabet_v2")
];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

const labelsData = {
  labels: LABELS,
  labelToId: Object.fromEntries(LABELS.map((l, i) => [l, i])),
  idToLabel: Object.fromEntries(LABELS.map((l, i) => [i, l]))
};

const filterAndRewriteDataset = (dir) => {
  console.log(`\n=== Processing ${dir} ===`);
  const labelsPath = path.join(dir, "labels.json");
  const metadataPath = path.join(dir, "metadata.json");

  fs.writeFileSync(labelsPath, JSON.stringify(labelsData, null, 2));
  console.log(`  Wrote labels.json (${LABELS.length} classes)`);

  let metadata = null;
  if (fs.existsSync(metadataPath)) {
    metadata = readJson(metadataPath);
  }

  let totalRemoved = 0;
  const sampleCountsByLabel = Object.fromEntries(LABELS.map((l) => [l, 0]));

  for (const split of ["train", "validation", "test"]) {
    const splitPath = path.join(dir, `${split}.json`);
    if (!fs.existsSync(splitPath)) continue;

    const data = readJson(splitPath);
    const samples = Array.isArray(data.samples) ? data.samples : [];
    const before = samples.length;
    const kept = samples.filter((s) => LABELS.includes(s.label));
    const removed = before - kept.length;
    totalRemoved += removed;

    for (const s of kept) {
      sampleCountsByLabel[s.label] = (sampleCountsByLabel[s.label] || 0) + 1;
      s.labelId = labelsData.labelToId[s.label];
    }

    const newData = { ...data, samples: kept };
    fs.writeFileSync(splitPath, JSON.stringify(newData));
    console.log(`  ${split}: kept ${kept.length} (removed ${removed})`);
  }

  if (metadata) {
    const beforeCounts = metadata.sampleCountsByLabel || {};
    const removedSamples = {};
    for (const oldLabel of Object.keys(beforeCounts)) {
      if (!LABELS.includes(oldLabel)) {
        removedSamples[oldLabel] = beforeCounts[oldLabel];
      }
    }

    metadata.sampleCountsByLabel = sampleCountsByLabel;
    if (Array.isArray(metadata.expectedLabels)) {
      metadata.expectedLabels = LABELS;
    }
    if (metadata.labelToId) {
      metadata.labelToId = labelsData.labelToId;
    }
    metadata.standardizedAt = new Date().toISOString();
    metadata.standardizedNote = "Removed ñ and ng to align with Kaggle FSL dataset (26 classes).";

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`  Updated metadata.json`);
    if (Object.keys(removedSamples).length > 0) {
      console.log(`  Removed label counts: ${JSON.stringify(removedSamples)}`);
    }
  }
};

const main = () => {
  for (const dir of PROCESSED_DIRS) {
    if (!fs.existsSync(dir)) {
      console.warn(`Skipping ${dir} (not found)`);
      continue;
    }
    filterAndRewriteDataset(dir);
  }
  console.log("\n=== Done ===");
};

try {
  main();
} catch (err) {
  console.error("Standardization failed:", err);
  process.exit(1);
}
