#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";

const ROBOFLOW_PROCESSED = path.join(process.cwd(), "datasets", "processed", "roboflow");
const ROBOFLOW_RAW = path.join(process.cwd(), "roboflow", "train");
const OUTPUT_DIR = path.join(process.cwd(), "datasets", "processed", "roboflow_static");
const CACHE_DIR = path.join(os.tmpdir(), "roboflow-static-landmarks");
const FEATURE_DIMENSION = 126;

const exists = async (p) => { try { await fs.access(p); return true; } catch { return false; } };

const readJson = async (p) => { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return null; } };

const normalizeLabel = (label) => {
  const trimmed = label.trim();
  if (trimmed.length === 1) return trimmed.toLowerCase();
  return trimmed.toUpperCase();
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

const readCsv = (content) => {
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length >= header.length) {
      const row = {};
      for (let j = 0; j < header.length; j++) row[header[j]] = cols[j].trim();
      rows.push(row);
    }
  }
  return { header, rows };
};

const extractLandmarksFromImage = (imagePath) => {
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
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(tmpScript, pythonScript);
  try {
    const output = execSync(`python "${tmpScript}"`, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }).toString();
    return JSON.parse(output);
  } catch (err) {
    return { error: err.message, detected: false };
  }
};

const makeRng = (seed) => {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
};

const main = async () => {
  console.log("[prep] Roboflow Static Training Data Preparation");
  console.log("[prep] ==========================================");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let features = [];
  let labels = [];

  const processedExists = await exists(ROBOFLOW_PROCESSED)
    && await exists(path.join(ROBOFLOW_PROCESSED, "train.json"));

  if (processedExists) {
    console.log("[prep] Found pre-extracted roboflow data at datasets/processed/roboflow/");

    for (const split of ["train", "validation", "test"]) {
      const data = await readJson(path.join(ROBOFLOW_PROCESSED, `${split}.json`));
      if (!data || !data.samples) continue;
      console.log(`[prep]   Loading ${split}: ${data.samples.length} samples`);
      for (const s of data.samples) {
        const seq = s.sequence;
        if (seq && seq.length > 0) {
          features.push(seq[0]);
          labels.push(s.label);
        }
      }
    }
  } else {
    const csvPath = path.join(ROBOFLOW_RAW, "_annotations.csv");
    if (!await exists(csvPath)) {
      console.log("[prep] No processed or raw roboflow data found.");
      console.log("[prep] Expected at datasets/processed/roboflow/ or roboflow/train/");
      console.log("[prep] Done.");
      return;
    }

    console.log("[prep] Raw data found at roboflow/train/ — extracting landmarks from images");

    const csvContent = await fs.readFile(csvPath, "utf8");
    const { rows } = readCsv(csvContent);
    console.log(`[prep]   CSV entries: ${rows.length}`);

    const uniqueEntries = new Map();
    for (const row of rows) {
      const filename = row.filename;
      if (!uniqueEntries.has(filename)) {
        uniqueEntries.set(filename, { filename, class: normalizeLabel(row.class) });
      }
    }
    const entries = [...uniqueEntries.values()];
    console.log(`[prep]   Unique images: ${entries.length}`);

    const dirFiles = await fs.readdir(ROBOFLOW_RAW);
    const jpgSet = new Set(dirFiles.filter((f) => /\.jpg$/i.test(f)));
    console.log(`[prep]   JPG files in dir: ${jpgSet.size}`);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const imgPath = path.join(ROBOFLOW_RAW, entry.filename);
      if (!jpgSet.has(entry.filename)) {
        process.stdout.write(`\r[prep]   Processing ${i + 1}/${entries.length}: ${entry.filename} (not found)`);
        continue;
      }
      process.stdout.write(`\r[prep]   Processing ${i + 1}/${entries.length}: ${entry.filename}`);
      const result = extractLandmarksFromImage(imgPath);
      if (!result.detected || !result.hands || result.hands.length === 0) {
        continue;
      }
      const leftHand = result.hands?.[0] ? normalizeLandmarks(result.hands[0]) : null;
      const rightHand = result.hands?.[1] ? normalizeLandmarks(result.hands[1]) : null;
      const frame = flattenFrame(leftHand, rightHand);
      features.push(frame);
      labels.push(entry.class);
    }
    console.log();
  }

  console.log(`[prep] Total feature vectors: ${features.length}`);
  if (features.length === 0) {
    console.log("[prep] No valid features extracted. Done.");
    return;
  }

  const labelSet = [...new Set(labels)].sort();
  const labelToId = {};
  const idToLabel = {};
  for (let i = 0; i < labelSet.length; i++) {
    labelToId[labelSet[i]] = i;
    idToLabel[i] = labelSet[i];
  }
  console.log(`[prep] Unique labels: ${labelSet.length}`);

  const indices = Array.from({ length: features.length }, (_, i) => i);
  const rand = makeRng(2026);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledFeatures = indices.map((i) => features[i]);
  const shuffledLabels = indices.map((i) => labels[i]);

  const n = shuffledFeatures.length;
  const valCount = Math.floor(n * 0.15);
  const testCount = Math.floor(n * 0.15);
  const trainCount = n - valCount - testCount;

  const splits = {
    train: { features: shuffledFeatures.slice(0, trainCount), labels: shuffledLabels.slice(0, trainCount) },
    validation: { features: shuffledFeatures.slice(trainCount, trainCount + valCount), labels: shuffledLabels.slice(trainCount, trainCount + valCount) },
    test: { features: shuffledFeatures.slice(trainCount + valCount), labels: shuffledLabels.slice(trainCount + valCount) },
  };

  const labelsManifest = { labels: labelSet, labelToId, idToLabel };

  for (const [split, data] of Object.entries(splits)) {
    await fs.writeFile(
      path.join(OUTPUT_DIR, `${split}.json`),
      JSON.stringify({ features: data.features, labels: data.labels }, null, 2)
    );
    console.log(`[prep]   ${split}.json: ${data.features.length} samples`);
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, "labels.json"),
    JSON.stringify(labelsManifest, null, 2)
  );
  console.log(`[prep]   labels.json: ${labelSet.length} labels`);

  console.log("[prep] Done.");
  console.log(`[prep] Output: ${OUTPUT_DIR}`);
};

main().catch((err) => {
  console.error("[prep] Error:", err.message);
  process.exit(1);
});
