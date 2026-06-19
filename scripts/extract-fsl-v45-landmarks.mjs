#!/usr/bin/env node
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const OUTPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_v45");
const QUALITY_DIR = path.join(process.cwd(), "docs");
const CACHE_DIR = path.join(os.tmpdir(), "fsl-v45-landmarks");
const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const TEMPORAL_STEPS = 30;

const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };

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

const temporalInterpolation = (frames, targetFrames) => {
  if (frames.length === 0) return Array.from({ length: targetFrames }, () => new Array(FEATURE_DIMENSION).fill(0));
  const result = [];
  for (let i = 0; i < targetFrames; i++) {
    const pos = (i * (frames.length - 1)) / Math.max(targetFrames - 1, 1);
    const idx = Math.floor(pos);
    const frac = pos - idx;
    if (idx >= frames.length - 1) result.push([...frames[frames.length - 1]]);
    else {
      const interpolated = new Array(FEATURE_DIMENSION);
      for (let d = 0; d < FEATURE_DIMENSION; d++) {
        interpolated[d] = frames[idx][d] + frac * (frames[idx + 1][d] - frames[idx][d]);
      }
      result.push(interpolated);
    }
  }
  return result;
};

const padOrTruncate = (sequence, targetLen) => {
  if (sequence.length >= targetLen) return sequence.slice(0, targetLen);
  const padded = [...sequence];
  while (padded.length < targetLen) padded.push(new Array(FEATURE_DIMENSION).fill(0));
  return padded;
};

const extractLandmarksWithPython = (videoPath) => {
  const pythonScript = `
import json, sys, os, subprocess, tempfile, struct
video = ${JSON.stringify(videoPath)}
try:
    import mediapipe as mp
    import cv2
    import numpy as np

    BaseOptions = mp.tasks.BaseOptions
    HandLandmarker = mp.tasks.vision.HandLandmarker
    HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
    RunningMode = mp.tasks.vision.RunningMode

    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path="${path.join(process.cwd(), "models", "hand_landmarker.task")}"),
        running_mode=RunningMode.VIDEO,
        num_hands=2
    )

    cap = cv2.VideoCapture(video)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames == 0:
        print(json.dumps({"error": "Empty video", "frames": 0}))
        sys.exit(0)

    frames_data = []
    frame_idx = 0
    with HandLandmarker.create_from_options(options) as landmarker:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = landmarker.detect_for_video(mp_image, frame_idx)
            hands = []
            conf = 0.0
            if result.hand_landmarks:
                for hl in result.hand_landmarks:
                    hands.append([[float(l.x), float(l.y), float(l.z)] for l in hl])
            if result.handedness:
                conf = sum([h[0].score for h in result.handedness]) / len(result.handedness)
            frames_data.append({"hands": hands, "confidence": conf, "frame": frame_idx})
            frame_idx += 1

    cap.release()
    print(json.dumps({
        "total_frames": total_frames,
        "extracted_frames": len(frames_data),
        "fps": fps,
        "frames": frames_data
    }))
except Exception as e:
    print(json.dumps({"error": str(e), "frames": 0}))
`;
  const tmpScript = path.join(CACHE_DIR, `extract_${path.basename(videoPath).replace(/[^a-zA-Z0-9]/g, "_")}.py`);
  ensureDir(CACHE_DIR);
  fs.writeFileSync(tmpScript, pythonScript);
  try {
    const output = execSync(`python "${tmpScript}"`, { timeout: 300000, maxBuffer: 50 * 1024 * 1024 }).toString();
    return JSON.parse(output);
  } catch (err) {
    return { error: err.message, frames: 0 };
  }
};

const scanVideos = (baseDir) => {
  const videos = [];
  if (!fs.existsSync(baseDir)) return videos;
  const walk = (dir, label) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, entry.name);
        else if (/\.(mp4|avi|mov|webm)$/i.test(entry.name)) {
          videos.push({ path: full, label: label || path.basename(path.dirname(full)), file: entry.name });
        }
      }
    } catch {}
  };
  walk(baseDir, null);
  return videos;
};

const collectQualityStats = (results) => {
  const stats = {
    totalVideos: results.length,
    successful: 0,
    failed: 0,
    totalFrames: 0,
    extractedFrames: 0,
    missingLandmarks: 0,
    occludedHands: 0,
    sequenceLengths: [],
    confidenceValues: [],
    perLabel: {}
  };
  for (const r of results) {
    if (r.error) { stats.failed++; continue; }
    stats.successful++;
    stats.totalFrames += r.total_frames ?? 0;
    stats.extractedFrames += r.frames?.length ?? 0;
    const hasMissing = (r.frames ?? []).filter((f) => !f.hands || f.hands.length === 0).length;
    stats.missingLandmarks += hasMissing;
    const hasOccluded = (r.frames ?? []).filter((f) => f.confidence < 0.5).length;
    stats.occludedHands += hasOccluded;
    stats.sequenceLengths.push(r.frames?.length ?? 0);
    for (const f of r.frames ?? []) stats.confidenceValues.push(f.confidence);
    if (r.label) {
      if (!stats.perLabel[r.label]) stats.perLabel[r.label] = { total: 0, success: 0, fail: 0, frames: 0 };
      stats.perLabel[r.label].total++;
      stats.perLabel[r.label].success++;
      stats.perLabel[r.label].frames += r.frames?.length ?? 0;
    }
  }
  return stats;
};

const writeQualityReport = (stats) => {
  ensureDir(QUALITY_DIR);
  const sortedLengths = [...stats.sequenceLengths].sort((a, b) => a - b);
  const sortedConf = [...stats.confidenceValues].sort((a, b) => a - b);
  const p50 = (arr) => arr.length > 0 ? arr[Math.floor(arr.length * 0.5)] : 0;
  const p95 = (arr) => arr.length > 0 ? arr[Math.floor(arr.length * 0.95)] : 0;

  const labels = Object.entries(stats.perLabel).sort(([, a], [, b]) => b.frames - a.frames);
  const imbalanced = labels.filter(([, v]) => v.frames < 50).map(([k]) => k);

  const report = `# FSL Dataset v4.5 Quality Report

Generated: ${new Date().toISOString().split("T")[0]}

## Extraction Summary

| Metric | Value |
|--------|-------|
| Total videos | ${stats.totalVideos} |
| Successful | ${stats.successful} |
| Failed | ${stats.failed} |
| Total frames | ${stats.totalFrames} |
| Extracted frames | ${stats.extractedFrames} |
| Missing landmarks frames | ${stats.missingLandmarks} |
| Occluded hands frames (<0.5 conf) | ${stats.occludedHands} |
| Missing rate | ${stats.totalFrames > 0 ? ((stats.missingLandmarks / stats.totalFrames) * 100).toFixed(2) : "N/A"}% |
| Occlusion rate | ${stats.totalFrames > 0 ? ((stats.occludedHands / stats.totalFrames) * 100).toFixed(2) : "N/A"}% |

## Sequence Length Distribution

| Statistic | Value |
|-----------|-------|
| Min | ${sortedLengths[0] ?? 0} |
| P50 | ${p50(sortedLengths)} |
| P95 | ${p95(sortedLengths)} |
| Max | ${sortedLengths[sortedLengths.length - 1] ?? 0} |
| Mean | ${stats.sequenceLengths.length > 0 ? (stats.sequenceLengths.reduce((a, b) => a + b, 0) / stats.sequenceLengths.length).toFixed(1) : 0} |

## Confidence Distribution

| Statistic | Value |
|-----------|-------|
| Min | ${(sortedConf[0] ?? 0).toFixed(3)} |
| P50 | ${p50(sortedConf).toFixed(3)} |
| P95 | ${p95(sortedConf).toFixed(3)} |
| Max | ${(sortedConf[sortedConf.length - 1] ?? 0).toFixed(3)} |

## Class Imbalance

${imbalanced.length > 0 ? `Classes with <50 frames: **${imbalanced.length}**\n\n${imbalanced.map((l) => `- ${l}: ${stats.perLabel[l]?.frames ?? 0} frames`).join("\n")}` : "No significant class imbalance detected."}

## Top 10 Most Sampled Classes

| Label | Frames |
|-------|--------|
${labels.slice(0, 10).map(([label, v]) => `| ${label} | ${v.frames} |`).join("\n")}

## Bottom 10 Least Sampled Classes

| Label | Frames |
|-------|--------|
${labels.slice(-10).map(([label, v]) => `| ${label} | ${v.frames} |`).join("\n")}

## Recommendations

- ${stats.totalFrames > 0 ? "Data extracted with minimal issues." : "No data extracted — check video paths and MediaPipe setup."}
- ${stats.missingLandmarks > stats.totalFrames * 0.1 ? "High missing landmark rate; consider adjusting MediaPipe detection parameters." : "Missing landmark rate is within acceptable range."}
- ${imbalanced.length > 0 ? "Consider collecting more samples for underrepresented classes." : "Class distribution is balanced."}
`;
  fs.writeFileSync(path.join(QUALITY_DIR, "fsl-v45-quality-report.md"), report);
  console.log("Quality report written to docs/fsl-v45-quality-report.md");
};

const main = () => {
  console.log("FSL Dataset v4.5 Landmark Extraction");
  console.log("=".repeat(55));

  ensureDir(OUTPUT_DIR);
  ensureDir(CACHE_DIR);

  const datasetPaths = [
    path.join(os.homedir(), ".cache", "kagglehub", "datasets", "japorton", "fsl-dataset", "versions", "4.5"),
    path.join(process.cwd(), "datasets", "fsl_v45"),
    path.join(process.cwd(), "datasets", "raw", "fsl_v45"),
  ];

  let videoDir = null;
  for (const p of datasetPaths) {
    if (fs.existsSync(p)) { videoDir = p; break; }
  }

  if (!videoDir) {
    console.log("FSL Dataset v4.5 not found locally.");
    console.log("Creating placeholder quality report...");

    const placeholderStats = {
      totalVideos: 0, successful: 0, failed: 0, totalFrames: 0,
      extractedFrames: 0, missingLandmarks: 0, occludedHands: 0,
      sequenceLengths: [], confidenceValues: [], perLabel: {}
    };
    writeQualityReport(placeholderStats);

    console.log("To extract landmarks:");
    console.log("1. Download FSL Dataset v4.5 from Kaggle");
    console.log("2. Ensure MediaPipe Python is installed: pip install mediapipe");
    console.log("3. Re-run: node scripts/extract-fsl-v45-landmarks.mjs");
    return;
  }

  console.log(`Videos directory: ${videoDir}`);
  const videos = scanVideos(videoDir);
  console.log(`Found ${videos.length} videos`);

  const results = [];
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    process.stdout.write(`\rProcessing ${i + 1}/${videos.length}: ${v.file}`);
    const extracted = extractLandmarksWithPython(v.path);
    if (extracted.error) {
      console.log(`\n  Failed: ${extracted.error.slice(0, 100)}`);
      results.push({ ...extracted, label: v.label, file: v.file, error: extracted.error });
    } else {
      results.push({ ...extracted, label: v.label, file: v.file, videoPath: v.path });
    }
  }
  console.log();

  const stats = collectQualityStats(results);
  writeQualityReport(stats);

  const trainSet = { samples: [], labels: [] };
  const valSet = { samples: [], labels: [] };
  const testSet = { samples: [], labels: [] };

  const labelMap = {};
  let labelId = 0;
  const rng = () => { let s = 2026; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; }; };
  const rand = rng();

  for (const r of results) {
    if (!r.frames || r.frames.length === 0) continue;
    if (!labelMap[r.label]) { labelMap[r.label] = labelId++; }
    const frames = r.frames.map((f) => flattenFrame(
      f.hands?.[0] ? normalizeLandmarks(f.hands[0]) : null,
      f.hands?.[1] ? normalizeLandmarks(f.hands[1]) : null
    ));
    const interpolated = temporalInterpolation(frames, SEQUENCE_LENGTH);
    const sample = { label: r.label, labelId: labelMap[r.label], sequence: interpolated, originalFrames: r.total_frames ?? frames.length };
    const roll = rand();
    if (roll < 0.7) trainSet.samples.push(sample);
    else if (roll < 0.85) valSet.samples.push(sample);
    else testSet.samples.push(sample);
  }

  trainSet.labels = Object.keys(labelMap);
  valSet.labels = Object.keys(labelMap);
  testSet.labels = Object.keys(labelMap);

  const labelsList = Object.entries(labelMap).sort(([, a], [, b]) => a - b).map(([l]) => l);
  const labelsJson = { labels: labelsList };
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
    source: "fsl_dataset_v4.5",
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
  console.log(`  Output: ${OUTPUT_DIR}`);
};

main();
