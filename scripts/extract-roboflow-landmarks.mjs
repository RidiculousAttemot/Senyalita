#!/usr/bin/env node
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const ROBOFLOW_DIR = path.join(process.cwd(), "roboflow");
const TRAIN_DIR = path.join(ROBOFLOW_DIR, "train");
const OUTPUT_DIR = path.join(process.cwd(), "datasets", "processed", "roboflow");
const QUALITY_DIR = path.join(process.cwd(), "docs");
const CACHE_DIR = path.join(os.tmpdir(), "roboflow-landmarks");
const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const TEMPORAL_STEPS = 30;

const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };

const normalizeLabel = (label) => {
  const trimmed = label.trim();
  if (trimmed.length === 1) return trimmed.toLowerCase();
  return trimmed.toUpperCase();
};

const readCsv = (csvPath) => {
  const lines = fs.readFileSync(csvPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length >= header.length) {
      const row = {};
      for (let j = 0; j < header.length; j++) row[header[j].trim()] = cols[j].trim();
      rows.push(row);
    }
  }
  return { header, rows };
};

const normalizeLandmarks = (hand) => {
  if (!hand || hand.length === 0) return null;
  const wrist = hand[0];
  if (!wrist) return null;
  const centered = hand.map((lm) => [lm[0] - wrist[0], lm[1] - wrist[1], lm[2] - wrist[2]]);
  let maxAbs = 0;
  for (const lm of centered) for (const c of lm) maxAbs = Math.max(maxAbs, Math.abs(c));
  if (maxAbs === 0) maxAbs = 1;
  return centered.map((lm) => [lm[0] / maxAbs, lm[1] / maxAbs, lm[2] / maxAbs]);
};

const flattenFrame = (leftHand, rightHand) => {
  const frame = new Array(FEATURE_DIMENSION).fill(0);
  let idx = 0;
  if (leftHand) for (const lm of leftHand) { frame[idx++] = lm[0]; frame[idx++] = lm[1]; frame[idx++] = lm[2]; }
  else idx += 63;
  if (rightHand) for (const lm of rightHand) { frame[idx++] = lm[0]; frame[idx++] = lm[1]; frame[idx++] = lm[2]; }
  return frame;
};

const extractLandmarksWithPython = (imagePath) => {
  const pythonScript = `
import json, sys
image = ${JSON.stringify(imagePath)}
try:
    import mediapipe as mp
    import cv2
    import numpy as np

    BaseOptions = mp.tasks.BaseOptions
    HandLandmarker = mp.tasks.vision.HandLandmarker
    HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
    RunningMode = mp.tasks.vision.RunningMode

    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path="${path.join(process.cwd(), "models", "hand_landmarker.task").replace(/\\/g, "\\\\")}"),
        running_mode=RunningMode.IMAGE,
        num_hands=2
    )

    img = cv2.imread(image)
    if img is None:
        print(json.dumps({"error": "Could not read image", "detected": False}))
        sys.exit(0)

    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

    with HandLandmarker.create_from_options(options) as landmarker:
        result = landmarker.detect(mp_image)

    hands = []
    conf = 0.0
    if result.hand_landmarks:
        for hl in result.hand_landmarks:
            hands.append([[float(l.x), float(l.y), float(l.z)] for l in hl])
    if result.handedness:
        conf = sum([h[0].score for h in result.handedness]) / len(result.handedness)

    print(json.dumps({
        "detected": len(hands) > 0,
        "hands": hands,
        "confidence": conf,
        "num_hands": len(hands)
    }))
except Exception as e:
    print(json.dumps({"error": str(e), "detected": False}))
`;
  const tmpScript = path.join(CACHE_DIR, `extract_${path.basename(imagePath).replace(/[^a-zA-Z0-9]/g, "_")}.py`);
  ensureDir(CACHE_DIR);
  fs.writeFileSync(tmpScript, pythonScript);
  try {
    const output = execSync(`python "${tmpScript}"`, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }).toString();
    return JSON.parse(output);
  } catch (err) {
    return { error: err.message, detected: false };
  }
};

const collectQualityStats = (results) => {
  const stats = {
    totalImages: results.length,
    successful: 0,
    failed: 0,
    detected: 0,
    noHands: 0,
    confidenceValues: [],
    perLabel: {}
  };
  for (const r of results) {
    if (r.error) { stats.failed++; continue; }
    stats.successful++;
    if (r.detected) stats.detected++;
    else stats.noHands++;
    stats.confidenceValues.push(r.confidence);
    if (r.label) {
      if (!stats.perLabel[r.label]) stats.perLabel[r.label] = { total: 0, success: 0, noHands: 0 };
      stats.perLabel[r.label].total++;
      if (r.detected) stats.perLabel[r.label].success++;
      else stats.perLabel[r.label].noHands++;
    }
  }
  return stats;
};

const writeQualityReport = (stats) => {
  ensureDir(QUALITY_DIR);
  const sortedConf = [...stats.confidenceValues].sort((a, b) => a - b);
  const p50 = (arr) => arr.length > 0 ? arr[Math.floor(arr.length * 0.5)] : 0;
  const p95 = (arr) => arr.length > 0 ? arr[Math.floor(arr.length * 0.95)] : 0;

  const labels = Object.entries(stats.perLabel).sort(([, a], [, b]) => b.total - a.total);
  const lowDetect = labels.filter(([, v]) => v.success > 0 && (v.success / v.total) < 0.5).map(([k]) => k);

  const report = `# Roboflow Landmark Extraction Quality Report

Generated: ${new Date().toISOString().split("T")[0]}

## Extraction Summary

| Metric | Value |
|--------|-------|
| Total images | ${stats.totalImages} |
| Successful | ${stats.successful} |
| Failed | ${stats.failed} |
| Hands detected | ${stats.detected} |
| No hands detected | ${stats.noHands} |
| Detection rate | ${stats.totalImages > 0 ? ((stats.detected / stats.totalImages) * 100).toFixed(2) : "N/A"}% |

## Confidence Distribution

| Statistic | Value |
|-----------|-------|
| Min | ${(sortedConf[0] ?? 0).toFixed(3)} |
| P50 | ${p50(sortedConf).toFixed(3)} |
| P95 | ${p95(sortedConf).toFixed(3)} |
| Max | ${(sortedConf[sortedConf.length - 1] ?? 0).toFixed(3)} |

## Per-Class Detection

| Label | Total | Detected | No Hands | Detection Rate |
|-------|-------|----------|----------|---------------|
${labels.map(([label, v]) => `| ${label} | ${v.total} | ${v.success} | ${v.noHands} | ${((v.success / v.total) * 100).toFixed(1)}% |`).join("\n")}

## Low Detection Classes (< 50% rate)

${lowDetect.length > 0 ? lowDetect.map((l) => `- ${l}: ${((stats.perLabel[l].success / stats.perLabel[l].total) * 100).toFixed(1)}% detection`).join("\n") : "All classes have >= 50% detection rate."}

## Notes

- This is a single-image dataset. Each image produces one landmark frame.
- Synthetic ${SEQUENCE_LENGTH}-frame sequences are created by repeating the extracted frame.
- The temporal interpolation step is skipped since there is only one frame.
- Images where no hands are detected get zero-filled landmark vectors.
`;
  fs.writeFileSync(path.join(QUALITY_DIR, "roboflow-landmark-quality-report.md"), report);
  console.log("Quality report written to docs/roboflow-landmark-quality-report.md");
};

const main = () => {
  console.log("Roboflow Dataset Landmark Extraction");
  console.log("=".repeat(55));

  ensureDir(OUTPUT_DIR);
  ensureDir(CACHE_DIR);

  if (!fs.existsSync(ROBOFLOW_DIR)) {
    console.log("Roboflow dataset not found at ./roboflow/");
    console.log("Download the dataset from Roboflow Universe first.");
    return;
  }

  const csvPath = path.join(TRAIN_DIR, "_annotations.csv");
  if (!fs.existsSync(csvPath)) {
    console.log("Annotations CSV not found at roboflow/train/_annotations.csv");
    return;
  }

  const { header, rows } = readCsv(csvPath);
  console.log(`Found ${rows.length} annotated entries in CSV`);
  console.log(`Total JPG images in train/: ${fs.readdirSync(TRAIN_DIR).filter((f) => /\.jpg$/i.test(f)).length}`);

  const uniqueEntries = new Map();
  for (const row of rows) {
    const filename = row.filename;
    if (!uniqueEntries.has(filename)) {
      uniqueEntries.set(filename, { filename, class: normalizeLabel(row.class), xmin: row.xmin, ymin: row.ymin, xmax: row.xmax, ymax: row.ymax });
    }
  }
  const entries = [...uniqueEntries.values()];
  console.log(`Unique annotated images: ${entries.length}`);

  const results = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const imgPath = path.join(TRAIN_DIR, entry.filename);
    if (!fs.existsSync(imgPath)) {
      process.stdout.write(`\rProcessing ${i + 1}/${entries.length}: ${entry.filename} (not found)`);
      results.push({ label: entry.class, file: entry.filename, error: "File not found", detected: false, confidence: 0 });
      continue;
    }
    process.stdout.write(`\rProcessing ${i + 1}/${entries.length}: ${entry.filename}`);
    const extracted = extractLandmarksWithPython(imgPath);
    if (extracted.error) {
      console.log(`\n  Failed: ${extracted.error.slice(0, 100)}`);
      results.push({ ...extracted, label: entry.class, file: entry.filename, error: extracted.error });
    } else {
      results.push({ ...extracted, label: entry.class, file: entry.filename, imagePath: imgPath });
    }
  }
  console.log();

  const stats = collectQualityStats(results);
  writeQualityReport(stats);

  const labelMap = {};
  let labelId = 0;
  const rng = () => { let s = 2026; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; }; };
  const rand = rng();

  const trainSet = { samples: [], labels: [] };
  const valSet = { samples: [], labels: [] };
  const testSet = { samples: [], labels: [] };

  for (const r of results) {
    if (!r.detected) continue;
    if (!labelMap[r.label]) { labelMap[r.label] = labelId++; }
    const leftHand = r.hands?.[0] ? normalizeLandmarks(r.hands[0]) : null;
    const rightHand = r.hands?.[1] ? normalizeLandmarks(r.hands[1]) : null;
    const frame = flattenFrame(leftHand, rightHand);
    const sequence = Array.from({ length: SEQUENCE_LENGTH }, () => [...frame]);
    const sample = { label: r.label, labelId: labelMap[r.label], sequence, originalFrames: 1 };
    const roll = rand();
    if (roll < 0.7) trainSet.samples.push(sample);
    else if (roll < 0.85) valSet.samples.push(sample);
    else testSet.samples.push(sample);
  }

  trainSet.labels = Object.keys(labelMap);
  valSet.labels = Object.keys(labelMap);
  testSet.labels = Object.keys(labelMap);

  const labelsList = Object.entries(labelMap).sort(([, a], [, b]) => a - b).map(([l]) => l);
  const labelsJson = { labels: labelsList, total: labelsList.length };
  const metadata = {
    totalLabels: labelsList.length,
    totalSamples: trainSet.samples.length + valSet.samples.length + testSet.samples.length,
    splits: {
      train: { samples: trainSet.samples.length, labels: labelsList.length },
      validation: { samples: valSet.samples.length, labels: labelsList.length },
      test: { samples: testSet.samples.length, labels: labelsList.length }
    },
    featureDimension: FEATURE_DIMENSION,
    sequenceLength: SEQUENCE_LENGTH,
    temporalSteps: TEMPORAL_STEPS,
    source: "roboflow_fsl_v4.5",
    totalImages: entries.length,
    detectionRate: stats.totalImages > 0 ? (stats.detected / stats.totalImages) : 0,
    extractedAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, "labels.json"), JSON.stringify(labelsJson, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, "train.json"), JSON.stringify(trainSet, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, "validation.json"), JSON.stringify(valSet, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, "test.json"), JSON.stringify(testSet, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, "metadata.json"), JSON.stringify(metadata, null, 2));

  console.log(`\nLandmark extraction complete.`);
  console.log(`  Train: ${trainSet.samples.length} samples`);
  console.log(`  Validation: ${valSet.samples.length} samples`);
  console.log(`  Test: ${testSet.samples.length} samples`);
  console.log(`  Labels: ${labelsList.length}`);
  console.log(`  Detection rate: ${(metadata.detectionRate * 100).toFixed(1)}%`);
  console.log(`  Output: ${OUTPUT_DIR}`);
};

main();
