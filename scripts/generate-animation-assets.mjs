// Node script to generate animation assets from processed landmark datasets.
// Reads the unified dataset's train.json, extracts landmark sequences per gesture,
// and writes individual JSON animation assets to public/animations/.
//
// Usage: node scripts/generate-animation-assets.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DATASET_PATH = path.join(ROOT, "datasets", "processed", "fsl_unified_balanced");
const OUTPUT_DIR = path.join(ROOT, "public", "animations");
const FALLBACK_DATASETS = [
  path.join(ROOT, "datasets", "processed", "fsl_unified"),
  path.join(ROOT, "datasets", "processed", "fsl_105"),
];

const LANDMARKS_PER_HAND = 21;
const FEATURE_DIM = 126;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function decode126ToLandmarks(featureArray) {
  const leftLandmarks = [];
  const rightLandmarks = [];

  for (let i = 0; i < LANDMARKS_PER_HAND; i++) {
    const base = i * 3;
    leftLandmarks.push({
      x: featureArray[base] ?? 0,
      y: featureArray[base + 1] ?? 0,
      z: featureArray[base + 2] ?? 0,
    });
  }

  for (let i = 0; i < LANDMARKS_PER_HAND; i++) {
    const base = FEATURE_DIM / 2 + i * 3;
    rightLandmarks.push({
      x: featureArray[base] ?? 0,
      y: featureArray[base + 1] ?? 0,
      z: featureArray[base + 2] ?? 0,
    });
  }

  return { left: leftLandmarks, right: rightLandmarks };
}

function isAllZeros(landmarks) {
  return landmarks.every(
    (lm) =>
      Math.abs(lm.x) < 0.001 &&
      Math.abs(lm.y) < 0.001 &&
      Math.abs(lm.z) < 0.001,
  );
}

function readDataset(dirPath) {
  const trainPath = path.join(dirPath, "train.json");
  const labelsPath = path.join(dirPath, "labels.json");
  const testPath = path.join(dirPath, "test.json");

  if (!fs.existsSync(trainPath)) return null;

  const labelsData = fs.existsSync(labelsPath)
    ? JSON.parse(fs.readFileSync(labelsPath, "utf-8"))
    : null;

  const labels = labelsData?.labels ?? [];

  console.log(`  Reading ${trainPath}...`);
  const raw = fs.readFileSync(trainPath, "utf-8");
  const parsed = JSON.parse(raw);
  let samples = parsed.samples ?? [];

  // Also read test samples if available
  if (fs.existsSync(testPath)) {
    try {
      const testRaw = fs.readFileSync(testPath, "utf-8");
      const testParsed = JSON.parse(testRaw);
      const testSamples = testParsed.samples ?? [];
      samples = [...samples, ...testSamples];
      console.log(`  Added ${testSamples.length} test samples`);
    } catch {}
  }

  return { labels, samples, sequenceLength: parsed.sequenceLength ?? 120 };
}

function findBestSample(samples, label) {
  const matching = samples.filter((s) => {
    const sLabel = s.label ?? "";
    return sLabel.toUpperCase() === label.toUpperCase();
  });

  if (matching.length === 0) return null;

  // Sort by: most original frames first, then longest sequence
  matching.sort((a, b) => {
    const aFrames = a.originalFrameCount ?? 0;
    const bFrames = b.originalFrameCount ?? 0;
    if (aFrames !== bFrames) return bFrames - aFrames;
    const aSeq = a.sequence?.length ?? 0;
    const bSeq = b.sequence?.length ?? 0;
    return bSeq - aSeq;
  });

  return matching[0];
}

function buildAnimationAsset(sample, label) {
  const sequence = sample.sequence ?? [];
  const fps = 30;
  const totalFrames = sequence.length;

  if (totalFrames === 0) return null;

  const frames = [];
  for (let i = 0; i < totalFrames; i++) {
    const frameData = sequence[i];
    if (!frameData || frameData.length < FEATURE_DIM) continue;

    const decoded = decode126ToLandmarks(frameData);
    const landmarks = [];

    if (!isAllZeros(decoded.left)) {
      landmarks.push({ landmarks: decoded.left });
    }
    if (!isAllZeros(decoded.right)) {
      landmarks.push({ landmarks: decoded.right });
    }

    if (landmarks.length === 0) continue;

    const timestamp = (i / fps) * 1000;
    frames.push({ timestamp, landmarks });
  }

  if (frames.length === 0) return null;

  const duration = (frames.length / fps) * 1000;

  return {
    label: label.toUpperCase(),
    language: "FSL",
    fps,
    duration,
    totalFrames: frames.length,
    frames,
    metadata: {
      signerId: sample.signerId ?? "unknown",
      source: "fsl_unified",
      featureDimension: FEATURE_DIM,
      sequenceLength: totalFrames,
      handedness: sample.handedness ?? "right",
      version: 1,
    },
  };
}

async function generateAssets() {
  console.log("=== Animation Asset Generator ===\n");
  ensureDir(OUTPUT_DIR);

  // Try primary dataset first, then fallbacks
  let dataset = readDataset(DATASET_PATH);
  if (!dataset) {
    console.log("Primary dataset not found, trying fallbacks...");
    for (const fb of FALLBACK_DATASETS) {
      dataset = readDataset(fb);
      if (dataset) {
        console.log(`  Using fallback: ${fb}`);
        break;
      }
    }
  }

  if (!dataset) {
    console.error("ERROR: No processed dataset found!");
    console.error("Looked in:");
    console.error(`  ${DATASET_PATH}`);
    for (const fb of FALLBACK_DATASETS) console.error(`  ${fb}`);
    process.exit(1);
  }

  console.log(`\nPhrase dataset: ${dataset.samples.length} samples, ${dataset.labels.length} labels`);

  // Also read alphabet dataset for a-z gestures
  const ALPHABET_PATH = path.join(ROOT, "datasets", "processed", "fsl_alphabet_kaggle_v2");
  let allSamples = [...dataset.samples];
  let alphabetLabels = [];

  const alphabetDataset = readDataset(ALPHABET_PATH);
  if (alphabetDataset) {
    console.log(`\nAlphabet dataset: ${alphabetDataset.samples.length} samples, ${alphabetDataset.labels.length} labels`);
    allSamples = [...allSamples, ...alphabetDataset.samples];
    alphabetLabels = alphabetDataset.labels.map((l) => l.toUpperCase());
  }

  // Collect all labels
  const phraseLabels = dataset.labels.map((l) => l.toUpperCase());
  const allLabels = [...new Set([...phraseLabels, ...alphabetLabels])].sort();
  console.log(`\nTotal unique labels: ${allLabels.length}`);

  let generated = 0;
  let skipped = 0;
  const generatedList = [];

  for (const label of allLabels) {
    if (!label.trim()) continue;

    const bestSample = findBestSample(allSamples, label);
    if (!bestSample) {
      console.log(`  SKIP: "${label}" — no samples found`);
      skipped++;
      continue;
    }

    const asset = buildAnimationAsset(bestSample, label);
    if (!asset) {
      console.log(`  SKIP: "${label}" — no valid frames`);
      skipped++;
      continue;
    }

    const filename = label.replace(/\s+/g, "_") + ".json";
    const outputPath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(outputPath, JSON.stringify(asset, null, 2), "utf-8");
    generated++;
    generatedList.push(label);

    if (generated % 25 === 0) {
      console.log(`  Progress: ${generated} assets generated...`);
    }
  }

  // Generate manifest
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalGestures: allLabels.length,
    generated,
    skipped,
    missing: allLabels.filter((l) => !generatedList.includes(l)),
    assets: generatedList,
  };

  const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`\n=== Complete ===`);
  console.log(`  Total labels: ${allLabels.length}`);
  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Missing: ${manifest.missing.length}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log(`  Manifest: ${manifestPath}`);
}

generateAssets().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
