#!/usr/bin/env node
/**
 * Merge Kaggle FSL landmarks into fsl_alphabet_v2 to create an enriched dataset
 * that includes both the original temporal recordings AND Kaggle static images.
 *
 * Usage: node scripts/merge-kaggle-into-v2.mjs
 */

import fs from "fs";
import path from "path";

const V2_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_v2");
const KAGGLE_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_kaggle_landmarks");
const OUTPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_kaggle_v2");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const RANDOM_SEED = 2026;

const LABELS = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const ensureDir = (dirPath) => { if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true }); };

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let value = Math.imul(t ^ (t >>> 15), 1 | t); value ^= value + Math.imul(value ^ (value >>> 7), 61 | value); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; };
};

const shuffle = (items, seed) => {
  const rng = mulberry32(seed);
  for (let i = items.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
};

const loadV2Data = () => {
  console.log("Loading fsl_alphabet_v2 data...");
  const labels = readJson(path.join(V2_DIR, "labels.json"));
  const metadata = readJson(path.join(V2_DIR, "metadata.json"));

  const splits = {};
  for (const split of ["train", "validation", "test"]) {
    const data = readJson(path.join(V2_DIR, `${split}.json`));
    splits[split] = data.samples;
    console.log(`  ${split}: ${data.samples.length} samples`);
  }
  return { labels, metadata, splits };
};

const loadKaggleData = () => {
  console.log("\nLoading Kaggle landmark data...");
  const samples = [];
  for (const label of LABELS) {
    const filePath = path.join(KAGGLE_DIR, `samples_${label}.json`);
    if (!fs.existsSync(filePath)) continue;
    const data = readJson(filePath);
    for (const s of data.samples) {
      samples.push({
        ...s,
        signerId: "KAGGLE",
        sessionId: `kaggle-${s.sourceFile?.replace(/\.\w+$/, "") || "unknown"}`,
        deviceType: "static-image",
        lighting: "unknown",
        handedness: "right",
        augmentationPreset: null,
        originalFile: s.sourceFile || null,
        source: "kaggle"
      });
    }
  }
  console.log(`  Loaded ${samples.length} Kaggle samples`);
  return samples;
};

const splitKaggleStratified = (kaggleSamples) => {
  const train = [], validation = [], test = [];
  for (const label of LABELS) {
    const labelSamples = kaggleSamples.filter((s) => s.label === label);
    if (labelSamples.length === 0) continue;
    const labelSeed = RANDOM_SEED + LABELS.indexOf(label) + 1000;
    const shuffled = shuffle([...labelSamples], labelSeed);
    const total = shuffled.length;
    const testCount = Math.max(1, Math.floor(total * 0.15));
    const valCount = Math.max(1, Math.floor(total * 0.15));
    const trainCount = total - testCount - valCount;
    train.push(...shuffled.slice(0, trainCount));
    validation.push(...shuffled.slice(trainCount, trainCount + valCount));
    test.push(...shuffled.slice(trainCount + valCount));
  }
  console.log(`\nKaggle split -> train: ${train.length}, validation: ${validation.length}, test: ${test.length}`);
  return { train, validation, test };
};

const mergeSplits = (v2Splits, kaggleSplits) => {
  const merged = {};
  for (const split of ["train", "validation", "test"]) {
    const combined = [...v2Splits[split], ...kaggleSplits[split]];
    const labelSeed = RANDOM_SEED + ["train","validation","test"].indexOf(split) + 2000;
    merged[split] = shuffle([...combined], labelSeed);
    console.log(`  ${split}: ${merged[split].length} (v2: ${v2Splits[split].length} + kaggle: ${kaggleSplits[split].length})`);
  }
  return merged;
};

const writeLargeSplitJson = (filePath, meta, samples) => {
  const fd = fs.openSync(filePath, "w");
  const encode = (str) => Buffer.from(str, "utf8");
  const write = (str) => fs.writeSync(fd, encode(str));
  write(`{\n  "sequenceLength": ${meta.sequenceLength},\n  "featureDimension": ${meta.featureDimension},\n  "samples": [\n`);
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i];
    const sample = {
      label: s.label, labelId: s.labelId, originalFrameCount: s.originalFrameCount,
      signerId: s.signerId, sessionId: s.sessionId, deviceType: s.deviceType,
      lighting: s.lighting, handedness: s.handedness,
      augmentationPreset: s.augmentationPreset, originalFile: s.originalFile,
      source: s.source,
      sequence: s.sequence
    };
    write(JSON.stringify(sample));
    if (i < samples.length - 1) write(",\n");
    if ((i + 1) % 500 === 0) console.log(`  ${path.basename(filePath)}: ${i + 1}/${samples.length}`);
  }
  write("\n  ]\n}\n");
  fs.closeSync(fd);
};

const writeNdjson = (filePath, samples) => {
  const fd = fs.openSync(filePath, "w");
  const encode = (str) => Buffer.from(str, "utf8");
  const write = (str) => fs.writeSync(fd, encode(str));
  const header = JSON.stringify({
    _header: true, sequenceLength: SEQUENCE_LENGTH, featureDimension: FEATURE_DIMENSION,
    totalSamples: samples.length, labels: LABELS
  });
  write(header + "\n");
  for (const s of samples) {
    write(JSON.stringify(s) + "\n");
  }
  fs.closeSync(fd);
};

const saveMergedDataset = (mergedSplits, v2Metadata) => {
  ensureDir(OUTPUT_DIR);

  const labelToId = Object.fromEntries(LABELS.map((l, i) => [l, i]));
  const idToLabel = Object.fromEntries(LABELS.map((l, i) => [i, l]));

  // Save labels
  fs.writeFileSync(path.join(OUTPUT_DIR, "labels.json"), JSON.stringify({ labels: LABELS, labelToId, idToLabel }, null, 2));

  // Count per-label
  const allSamples = [...mergedSplits.train, ...mergedSplits.validation, ...mergedSplits.test];
  const sampleCountsByLabel = {};
  for (const label of LABELS) {
    sampleCountsByLabel[label] = allSamples.filter((s) => s.label === label).length;
  }

  // Count by signer
  const sampleCountsBySigner = {};
  for (const s of allSamples) {
    sampleCountsBySigner[s.signerId] = (sampleCountsBySigner[s.signerId] || 0) + 1;
  }

  // Save metadata
  fs.writeFileSync(path.join(OUTPUT_DIR, "metadata.json"), JSON.stringify({
    expectedLabels: LABELS, labelToId,
    totalSamples: allSamples.length,
    sequenceLength: SEQUENCE_LENGTH, featureDimension: FEATURE_DIMENSION,
    splitRatios: { train: 0.7, validation: 0.15, test: 0.15 },
    splitCounts: {
      train: mergedSplits.train.length,
      validation: mergedSplits.validation.length,
      test: mergedSplits.test.length
    },
    sampleCountsByLabel,
    sampleCountsBySigner,
    signers: Object.keys(sampleCountsBySigner).sort(),
    numSigners: Object.keys(sampleCountsBySigner).length,
    randomSeed: RANDOM_SEED,
    splitStrategy: "stratified-by-label-shuffled",
    augmentationPresets: v2Metadata.augmentationPresets || ["original"],
    mergedFrom: ["fsl_alphabet_v2", "fsl_kaggle_landmarks"],
    v2Count: v2Metadata.totalSamples,
    kaggleCount: allSamples.length - v2Metadata.totalSamples,
    createdAt: new Date().toISOString()
  }, null, 2));

  // Save splits as JSON
  for (const split of ["train", "validation", "test"]) {
    const jsonPath = path.join(OUTPUT_DIR, `${split}.json`);
    const ndPath = path.join(OUTPUT_DIR, `${split}.ndjson`);
    console.log(`\nWriting ${split}...`);
    writeLargeSplitJson(jsonPath, { sequenceLength: SEQUENCE_LENGTH, featureDimension: FEATURE_DIMENSION }, mergedSplits[split]);
    writeNdjson(ndPath, mergedSplits[split]);
    console.log(`  JSON: ${mergedSplits[split].length} samples`);
    console.log(`  NDJSON: ${mergedSplits[split].length} samples`);
  }

  console.log(`\n✓ Dataset saved to ${OUTPUT_DIR}`);
  console.log(`  Total: ${allSamples.length} samples`);
  console.log(`  V2: ${v2Metadata.totalSamples}, Kaggle: ${allSamples.length - v2Metadata.totalSamples}`);
};

const main = () => {
  console.log("=== Merge Kaggle Landmarks into fsl_alphabet_v2 ===\n");

  if (!fs.existsSync(V2_DIR)) { console.error(`❌ V2 dir not found: ${V2_DIR}`); process.exit(1); }
  if (!fs.existsSync(KAGGLE_DIR)) { console.error(`❌ Kaggle dir not found: ${KAGGLE_DIR}`); process.exit(1); }

  const v2 = loadV2Data();
  const kaggleSamples = loadKaggleData();

  // Check label overlap
  const v2Labels = new Set(v2.labels.labels);
  const kaggleLabels = new Set(kaggleSamples.map((s) => s.label));
  const common = [...v2Labels].filter((l) => kaggleLabels.has(l));
  console.log(`\nCommon labels: ${common.length}/${v2Labels.size}`);

  const kaggleSplits = splitKaggleStratified(kaggleSamples);
  const mergedSplits = mergeSplits(v2.splits, kaggleSplits);
  saveMergedDataset(mergedSplits, v2.metadata);

  console.log("\n=== Merge complete! ===");
  console.log("Next: Update unified training scripts to use fsl_alphabet_kaggle_v2");
};

try { main(); } catch (err) { console.error("Fatal:", err); process.exit(1); }
