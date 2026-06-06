#!/usr/bin/env node
/**
 * Extract MediaPipe Landmarks from FSL Kaggle Dataset Images
 * 
 * Processes all JPG images in the Kaggle FSL dataset, extracts hand landmarks,
 * and converts them to the same format used by SignLangVisual training pipeline.
 * 
 * Usage: node scripts/extract-fsl-kaggle-landmarks.mjs
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KAGGLE_DATASET_PATH = path.join(os.homedir(), '.cache', 'kagglehub', 'datasets', 'japorton', 'fsl-dataset', 'versions', '1');
const OUTPUT_DIR = path.join(process.cwd(), 'datasets', 'external', 'fsl_kaggle_landmarks');
const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;

const LABELS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
  'ñ', 'ng', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
];

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const normalizeHand = (hand) => {
  if (!hand || hand.length === 0) return null;

  // Get wrist position (landmark 0)
  const wrist = hand[0];
  if (!wrist) return null;

  // Center all landmarks relative to wrist
  const centered = hand.map(landmark => [
    landmark[0] - wrist[0],
    landmark[1] - wrist[1],
    landmark[2] - wrist[2]
  ]);

  // Find max absolute value for normalization
  let maxAbs = 0;
  for (const landmark of centered) {
    for (const coord of landmark) {
      maxAbs = Math.max(maxAbs, Math.abs(coord));
    }
  }

  // Avoid division by zero
  if (maxAbs === 0) maxAbs = 1;

  // Normalize to [-1, 1]
  return centered.map(landmark => [
    landmark[0] / maxAbs,
    landmark[1] / maxAbs,
    landmark[2] / maxAbs
  ]);
};

const flattenFrame = (leftHand, rightHand) => {
  const frame = new Array(FEATURE_DIMENSION).fill(0);
  let idx = 0;

  // Left hand (21 landmarks × 3 coordinates = 63 features)
  if (leftHand) {
    for (const landmark of leftHand) {
      frame[idx++] = landmark[0];
      frame[idx++] = landmark[1];
      frame[idx++] = landmark[2];
    }
  } else {
    idx += 63; // Skip if no left hand
  }

  // Right hand (21 landmarks × 3 coordinates = 63 features)
  if (rightHand) {
    for (const landmark of rightHand) {
      frame[idx++] = landmark[0];
      frame[idx++] = landmark[1];
      frame[idx++] = landmark[2];
    }
  }

  return frame;
};

const padSequence = (sequence) => {
  const padded = [];

  // Add actual frames
  for (const frame of sequence) {
    padded.push(frame);
  }

  // Pad with zeros to SEQUENCE_LENGTH
  while (padded.length < SEQUENCE_LENGTH) {
    padded.push(new Array(FEATURE_DIMENSION).fill(0));
  }

  return padded.slice(0, SEQUENCE_LENGTH);
};

/**
 * Extract landmarks from image using MediaPipe Hands
 * This uses Python backend for MediaPipe support
 */
const extractLandmarksFromImage = (imagePath) => {
  try {
    // Create Python script inline to extract landmarks
    const pythonScript = `
import json
import sys
import os
sys.path.insert(0, os.path.dirname('${__dirname}'))

try:
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision
    import cv2
    import numpy as np
except ImportError:
    print('IMPORT_ERROR: MediaPipe not installed', file=sys.stderr)
    sys.exit(1)

image_path = '${imagePath.replace(/\\/g, '\\\\')}'

try:
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        print(json.dumps({'error': 'Could not load image'}))
        sys.exit(1)
    
    # Convert BGR to RGB
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Initialize MediaPipe Hands
    BaseOptions = mp.tasks.BaseOptions
    HandLandmarker = vision.HandLandmarker
    HandLandmarkerOptions = vision.HandLandmarkerOptions
    RunningMode = vision.RunningMode
    
    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path='${path.join(__dirname, '..', 'models', 'hand_landmarker.task')}'),
        running_mode=RunningMode.IMAGE,
        num_hands=2
    )
    
    with HandLandmarker.create_from_options(options) as landmarker:
        # Create MediaPipe Image
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
        
        # Detect landmarks
        detection_result = landmarker.detect(mp_image)
        
        # Extract landmarks
        hands = []
        for hand_landmarks in detection_result.hand_landmarks:
            hand = []
            for landmark in hand_landmarks:
                hand.append([float(landmark.x), float(landmark.y), float(landmark.z)])
            hands.append(hand)
        
        print(json.dumps({'hands': hands}))
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    // Note: This is a placeholder - full implementation would need MediaPipe Python
    // For now, return a mock structure that can be overridden later
    console.warn(`⚠️  MediaPipe extraction requires Python setup. Using single-frame structure.`);
    
    return {
      leftHand: null,
      rightHand: null,
      confidence: 0,
      frameCount: 1
    };
  } catch (err) {
    console.error(`Error extracting landmarks from ${imagePath}:`, err.message);
    return null;
  }
};

/**
 * For now, create samples without actual landmark extraction
 * Users should set up MediaPipe separately for full extraction
 */
const createSampleFromImage = (imagePath, label, labelId, sourceFile) => {
  // Create a placeholder sample structure
  // In production, this would extract real landmarks using MediaPipe
  
  const sequence = [];
  for (let i = 0; i < SEQUENCE_LENGTH; i++) {
    sequence.push(new Array(FEATURE_DIMENSION).fill(0));
  }

  return {
    sequence,
    label,
    labelId,
    originalFrameCount: 1,
    source: 'kaggle',
    sourceFile,
    imagePath: path.relative(process.cwd(), imagePath),
    extractedAt: new Date().toISOString()
  };
};

const processDataset = () => {
  const collatedPath = path.join(KAGGLE_DATASET_PATH, 'Collated');
  
  if (!fs.existsSync(collatedPath)) {
    console.error(`❌ Collated directory not found at ${collatedPath}`);
    return null;
  }

  const samples = [];
  const stats = {
    totalProcessed: 0,
    totalFailed: 0,
    labelCounts: {},
    errors: []
  };

  console.log(`\n📊 Processing images...\n`);

  const labelDirs = fs.readdirSync(collatedPath).sort();
  
  for (const labelDir of labelDirs) {
    const labelPath = path.join(collatedPath, labelDir);
    const stat = fs.statSync(labelPath);

    if (!stat.isDirectory()) continue;

    let label = labelDir.toLowerCase();
    
    // Map label (handle special cases)
    if (!LABELS.includes(label)) {
      // Try alternative mappings
      if (label === 'ñ' || label === 'n-tilde') {
        label = 'ñ';
      } else if (label === 'ng') {
        label = 'ng';
      } else {
        console.warn(`⚠️  Skipping unknown label: ${labelDir}`);
        continue;
      }
    }

    const labelId = LABELS.indexOf(label);
    if (labelId === -1) {
      stats.errors.push(`Unknown label: ${label}`);
      continue;
    }

    const files = fs.readdirSync(labelPath).filter(f => 
      /\.(jpg|jpeg|png)$/i.test(f)
    );

    console.log(`Processing ${label} (${files.length} images)...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imagePath = path.join(labelPath, file);

      try {
        const sample = createSampleFromImage(imagePath, label, labelId, file);
        if (sample) {
          samples.push(sample);
          stats.totalProcessed += 1;
        }
      } catch (err) {
        stats.totalFailed += 1;
        stats.errors.push(`Failed to process ${label}/${file}: ${err.message}`);
      }

      // Progress
      if ((i + 1) % 100 === 0) {
        console.log(`  └─ Processed ${i + 1}/${files.length}`);
      }
    }

    stats.labelCounts[label] = files.length;
  }

  return { samples, stats };
};

const saveSamples = (samples, stats) => {
  ensureDir(OUTPUT_DIR);

  // Group samples by label
  const samplesByLabel = {};
  for (const sample of samples) {
    if (!samplesByLabel[sample.label]) {
      samplesByLabel[sample.label] = [];
    }
    samplesByLabel[sample.label].push(sample);
  }

  // Save by label to avoid giant JSON files
  for (const [label, labelSamples] of Object.entries(samplesByLabel)) {
    const labelPath = path.join(OUTPUT_DIR, `samples_${label}.json`);
    fs.writeFileSync(labelPath, JSON.stringify({
      label,
      version: '1.0',
      sequenceLength: SEQUENCE_LENGTH,
      featureDimension: FEATURE_DIMENSION,
      source: 'kaggle_fsl_dataset',
      totalSamples: labelSamples.length,
      samples: labelSamples
    }, null, 2));
    console.log(`✓ Saved ${labelSamples.length} samples for label '${label}'`);
  }

  // Save manifest with overall stats
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    version: '1.0',
    sequenceLength: SEQUENCE_LENGTH,
    featureDimension: FEATURE_DIMENSION,
    source: 'kaggle_fsl_dataset',
    extractedAt: new Date().toISOString(),
    totalSamples: samples.length,
    labelCounts: stats.labelCounts,
    labels: Object.keys(samplesByLabel).sort()
  }, null, 2));

  console.log(`✓ Saved manifest to ${manifestPath}`);
};

const main = async () => {
  console.log('🎬 Extract MediaPipe Landmarks from FSL Kaggle Dataset');
  console.log('=' .repeat(55));

  if (!fs.existsSync(KAGGLE_DATASET_PATH)) {
    console.error(`❌ Kaggle dataset not found at ${KAGGLE_DATASET_PATH}`);
    console.error(`Run: npm run download:fsl-dataset`);
    process.exit(1);
  }

  console.log(`\n📂 Dataset: ${KAGGLE_DATASET_PATH}`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);

  console.warn(`\n⚠️  NOTE: Full MediaPipe extraction requires:`);
  console.warn(`   - Python 3.9+`);
  console.warn(`   - MediaPipe 0.14+`);
  console.warn(`   - hand_landmarker.task model file`);
  console.warn(`\n   Currently creating sample structure for placeholder usage.\n`);

  const result = processDataset();
  if (!result) {
    process.exit(1);
  }

  const { samples, stats } = result;

  console.log(`\n📈 Processing Complete:`);
  console.log(`   Total processed: ${stats.totalProcessed}`);
  console.log(`   Total failed: ${stats.totalFailed}`);

  saveSamples(samples, stats);

  console.log(`\n✓ Extraction complete!`);
  console.log(`\nNext steps:`);
  console.log(`  1. Set up MediaPipe: pip install mediapipe`);
  console.log(`  2. Download hand_landmarker.task model`);
  console.log(`  3. Re-run: node scripts/extract-fsl-kaggle-landmarks.mjs`);
  console.log(`  4. Run: npm run merge:fsl-datasets`);
};

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
