#!/usr/bin/env node
/**
 * Merge FSL Kaggle and Custom Datasets
 * 
 * Combines the Kaggle FSL dataset with custom SignLangVisual dataset,
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

const KAGGLE_EXTRACTION_DIR = path.join(process.cwd(), 'datasets', 'external', 'fsl_kaggle_landmarks');
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
  'ñ', 'ng', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
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

  const mergedSamples = [
    ...customData.samples,
    ...kaggleData.samples
  ];

  const stats = {
    totalSamples: mergedSamples.length,
    customCount: customData.samples.length,
    kaggleCount: kaggleData.samples.length,
    labelCounts: {}
  };

  // Count by label
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

const saveDataset = (splits, labels, stats, splitStats) => {
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

  // Save splits without pretty-printing to reduce string size
  for (const [splitName, splitSamples] of Object.entries(splits)) {
    try {
      const splitPath = path.join(OUTPUT_DIR, `${splitName}.json`);
      const json = JSON.stringify({ samples: splitSamples });
      fs.writeFileSync(splitPath, json);
      console.log(`✓ Saved ${splitName} split (${splitSamples.length} samples, ${(json.length / (1024 * 1024)).toFixed(2)} MB)`);
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
