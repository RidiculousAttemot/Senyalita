#!/usr/bin/env node
/**
 * Merge FSL Kaggle and Custom Datasets
 * 
 * Combines the Kaggle FSL dataset with custom Senyalita dataset,
 * preserves source metadata, and applies stratified-by-label splitting.
 * 
 * Usage: node scripts/merge-fsl-datasets.mjs
 */

import fs from 'fs';
import path from 'path';
import { randomInt } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KAGGLE_EXTRACTION_DIR = path.join(process.cwd(), 'datasets', 'processed', 'fsl_kaggle_landmarks');
const CUSTOM_DATASET_DIR = path.join(process.cwd(), 'datasets', 'processed', 'fsl_alphabet');
const OUTPUT_DIR = path.join(process.cwd(), 'datasets', 'processed', 'fsl_alphabet_combined');
const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const RANDOM_SEED = 1337;

const SPLIT_RATIOS = {
  train: 0.7,
  validation: 0.15,
  test: 0.15
};

const LABELS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
  'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
];

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const seededShuffleArray = (array, seed) => {
  // Deterministic shuffling using seed
  const shuffled = [...array];
  let rng = seed;

  for (let i = shuffled.length - 1; i > 0; i--) {
    rng = (rng * 9301 + 49297) % 233280; // LCG
    const j = Math.floor((rng / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

const loadCustomDataset = () => {
  console.log('📂 Loading custom dataset...');

  const samples = [];
  const labelsFile = path.join(CUSTOM_DATASET_DIR, 'labels.json');
  
  if (!fs.existsSync(labelsFile)) {
    console.error(`❌ Custom dataset not found at ${CUSTOM_DATASET_DIR}`);
    return null;
  }

  const labelsData = JSON.parse(fs.readFileSync(labelsFile, 'utf8'));

  // Load samples from each split
  for (const split of ['train', 'validation', 'test']) {
    const splitFile = path.join(CUSTOM_DATASET_DIR, `${split}.json`);
    if (fs.existsSync(splitFile)) {
      const splitData = JSON.parse(fs.readFileSync(splitFile, 'utf8'));
      for (const sample of splitData.samples) {
        samples.push({
          ...sample,
          source: 'custom',
          originalSplit: split
        });
      }
    }
  }

  console.log(`✓ Loaded ${samples.length} custom samples`);
  return { samples, labels: labelsData };
};

const loadKaggleDataset = () => {
  console.log('📂 Loading Kaggle dataset...');

  const samples = [];
  const manifest = path.join(KAGGLE_EXTRACTION_DIR, 'manifest.json');

  if (!fs.existsSync(manifest)) {
    console.error(`❌ Kaggle dataset not found at ${KAGGLE_EXTRACTION_DIR}`);
    return null;
  }

  const manifestData = JSON.parse(fs.readFileSync(manifest, 'utf8'));

  // Load samples from each label file
  for (const label of manifestData.labels) {
    const labelFile = path.join(KAGGLE_EXTRACTION_DIR, `samples_${label}.json`);
    if (fs.existsSync(labelFile)) {
      const labelData = JSON.parse(fs.readFileSync(labelFile, 'utf8'));
      for (const sample of labelData.samples) {
        samples.push({
          ...sample,
          source: 'kaggle'
        });
      }
    }
  }

  console.log(`✓ Loaded ${samples.length} Kaggle samples`);
  return { samples, manifest: manifestData };
};

const mergeDatasets = (customData, kaggleData) => {
  console.log('\n🔄 Merging datasets...');

  const labelToId = Object.fromEntries(LABELS.map((l, i) => [l, i]));

  const mergedSamples = [
    ...customData.samples,
    ...kaggleData.samples
  ].map((sample) => ({
    ...sample,
    labelId: labelToId[sample.label] ?? sample.labelId
  }));

  const stats = {
    totalSamples: mergedSamples.length,
    customCount: customData.samples.length,
    kaggleCount: kaggleData.samples.length,
    labelCounts: {}
  };

  for (const label of LABELS) {
    stats.labelCounts[label] = mergedSamples.filter(s => s.label === label).length;
  }

  console.log(`✓ Merged ${mergedSamples.length} total samples`);
  console.log(`   Custom: ${customData.samples.length}`);
  console.log(`   Kaggle: ${kaggleData.samples.length}`);

  return { mergedSamples, stats };
};

const splitDataset = (samples) => {
  console.log('\n📊 Applying stratified-by-label split...');

  const splits = {
    train: [],
    validation: [],
    test: []
  };

  // Group by label
  const samplesByLabel = {};
  for (const label of LABELS) {
    samplesByLabel[label] = samples.filter(s => s.label === label);
  }

  // Split each label stratified
  for (const [label, labelSamples] of Object.entries(samplesByLabel)) {
    if (labelSamples.length === 0) continue;

    // Shuffle with deterministic seed
    const labelSeed = RANDOM_SEED + LABELS.indexOf(label);
    const shuffled = seededShuffleArray(labelSamples, labelSeed);

    // Calculate split indices
    const trainCount = Math.max(1, Math.floor(shuffled.length * SPLIT_RATIOS.train));
    const valCount = Math.max(1, Math.floor(shuffled.length * SPLIT_RATIOS.validation));

    const trainSamples = shuffled.slice(0, trainCount);
    const valSamples = shuffled.slice(trainCount, trainCount + valCount);
    const testSamples = shuffled.slice(trainCount + valCount);

    splits.train.push(...trainSamples);
    splits.validation.push(...valSamples);
    splits.test.push(...testSamples);
  }

  const splitStats = {
    train: splits.train.length,
    validation: splits.validation.length,
    test: splits.test.length
  };

  console.log(`✓ Split complete:`);
  console.log(`   Train: ${splitStats.train}`);
  console.log(`   Validation: ${splitStats.validation}`);
  console.log(`   Test: ${splitStats.test}`);

  return { splits, splitStats };
};

const validateSplit = (splits) => {
  console.log('\n✓ Validating split coverage...');

  const labelCoverageBySplit = {
    train: new Set(),
    validation: new Set(),
    test: new Set()
  };

  for (const [splitName, splitSamples] of Object.entries(splits)) {
    for (const sample of splitSamples) {
      labelCoverageBySplit[splitName].add(sample.label);
    }
  }

  let allCovered = true;
  for (const label of LABELS) {
    for (const split of ['train', 'validation', 'test']) {
      if (!labelCoverageBySplit[split].has(label)) {
        console.warn(`⚠️  Label '${label}' missing from ${split} split`);
        allCovered = false;
      }
    }
  }

  if (allCovered) {
    console.log('✓ All labels present in all splits');
  }

  return allCovered;
};

const saveDataset = async (splits, labels, stats, splitStats) => {
  console.log('\n💾 Saving combined dataset...');

  ensureDir(OUTPUT_DIR);

  // Save labels
  const labelsJson = {
    labels: LABELS,
    labelToId: Object.fromEntries(LABELS.map((l, i) => [l, i])),
    idToLabel: Object.fromEntries(LABELS.map((l, i) => [i, l]))
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'labels.json'),
    JSON.stringify(labelsJson, null, 2)
  );

  // Save metadata
  const metadata = {
    version: '1.0',
    sequenceLength: SEQUENCE_LENGTH,
    featureDimension: FEATURE_DIMENSION,
    splitCounts: splitStats,
    sampleCountsByLabel: {},
    splitStrategy: 'stratified-by-label',
    mergedFrom: ['custom', 'kaggle'],
    mergedAt: new Date().toISOString(),
    customSamples: stats.customCount,
    kaggleSamples: stats.kaggleCount
  };

  // Count by label
  const allSamples = [
    ...splits.train,
    ...splits.validation,
    ...splits.test
  ];

  for (const label of LABELS) {
    metadata.sampleCountsByLabel[label] = allSamples.filter(s => s.label === label).length;
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  // Save splits via a streaming writer to avoid the 512MB JSON string limit.
  // We write the structure in fixed-shape pieces: header → array open →
  // sample 0 → sample 1 → ... → array close → footer.
  const formatValue = (value) => {
    if (typeof value === "number") {
      if (Number.isInteger(value)) return value.toString();
      return Number(value).toString();
    }
    if (typeof value === "string") return JSON.stringify(value);
    if (value === null) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      return "[" + value.map(formatValue).join(",") + "]";
    }
    if (typeof value === "object") {
      const keys = Object.keys(value);
      return "{" + keys.map(k => JSON.stringify(k) + ":" + formatValue(value[k])).join(",") + "}";
    }
    return JSON.stringify(value);
  };

  for (const [splitName, splitSamples] of Object.entries(splits)) {
    try {
      const splitPath = path.join(OUTPUT_DIR, `${splitName}.json`);
      const out = fs.createWriteStream(splitPath);
      const bytesWritten = { n: 0 };
      out.on("error", (err) => { console.error(`❌ Stream error saving ${splitName}:`, err.message); });
      const writeChunk = (chunk) => {
        return new Promise((resolve, reject) => {
          if (!out.write(chunk)) out.once("drain", resolve);
          else resolve();
          bytesWritten.n += Buffer.byteLength(chunk, "utf8");
        });
      };
      out.write(`{"sequenceLength":${SEQUENCE_LENGTH},"featureDimension":${FEATURE_DIMENSION},"samples":[`);
      for (let i = 0; i < splitSamples.length; i++) {
        const chunk = (i === 0 ? "" : ",") + formatValue(splitSamples[i]);
        await writeChunk(chunk);
        if ((i + 1) % 500 === 0) console.log(`  ${splitName}: ${i + 1}/${splitSamples.length} (${(bytesWritten.n / (1024 * 1024)).toFixed(1)} MB)`);
      }
      out.write("]}");
      await new Promise((resolve) => out.end(resolve));
      console.log(`✓ Saved ${splitName} split (${splitSamples.length} samples, ${(bytesWritten.n / (1024 * 1024)).toFixed(2)} MB)`);

      // Also write an NDJSON version: the FIRST line is a header object with
      // {sequenceLength, featureDimension, totalSamples, labels, splitName}.
      // Every subsequent line is a single sample object. The trainer can read
      // line-by-line so the 1.2GB train file never has to be a single string.
      const ndPath = path.join(OUTPUT_DIR, `${splitName}.ndjson`);
      const ndOut = fs.createWriteStream(ndPath);
      const ndBytes = { n: 0 };
      const writeNdChunk = (c) => new Promise((resolve) => {
        if (!ndOut.write(c)) ndOut.once("drain", resolve); else resolve();
        ndBytes.n += Buffer.byteLength(c, "utf8");
      });
      const ndHeader = JSON.stringify({
        _header: true,
        sequenceLength: SEQUENCE_LENGTH,
        featureDimension: FEATURE_DIMENSION,
        splitName,
        totalSamples: splitSamples.length,
        labels: LABELS
      });
      await writeNdChunk(ndHeader + "\n");
      for (let i = 0; i < splitSamples.length; i++) {
        const line = JSON.stringify(splitSamples[i]);
        await writeNdChunk(line + "\n");
        if ((i + 1) % 1000 === 0) console.log(`  ${splitName} ndjson: ${i + 1}/${splitSamples.length}`);
      }
      await new Promise((resolve) => ndOut.end(resolve));
      console.log(`✓ Saved ${splitName} NDJSON (${(ndBytes.n / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (err) {
      console.error(`❌ Error saving ${splitName}:`, err.message);
      throw err;
    }
  }

  console.log(`✓ Dataset saved to ${OUTPUT_DIR}`);
};

const main = async () => {
  console.log('🔀 Merge FSL Kaggle and Custom Datasets');
  console.log('=' .repeat(50));
  console.log(`\nOutput: ${OUTPUT_DIR}\n`);

  // Load datasets
  const customData = loadCustomDataset();
  if (!customData) {
    console.error(`❌ Failed to load custom dataset`);
    process.exit(1);
  }

  const kaggleData = loadKaggleDataset();
  if (!kaggleData) {
    console.error(`❌ Failed to load Kaggle dataset`);
    process.exit(1);
  }

  // Merge
  const { mergedSamples, stats } = mergeDatasets(customData, kaggleData);

  // Split
  const { splits, splitStats } = splitDataset(mergedSamples);

  // Validate
  validateSplit(splits);

  // Save
  saveDataset(splits, customData.labels, stats, splitStats);

  console.log(`\n✓ Merge complete!`);
  console.log(`\nNext steps:`);
  console.log(`  1. Run: npm run verify:processed:fsl-alphabet`);
  console.log(`  2. Run: npm run train:fsl-alphabet:bilstm-v3`);
};

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
