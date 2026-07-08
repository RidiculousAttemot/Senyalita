#!/usr/bin/env node
import fs from "fs";
import path from "path";

const COMBINED_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_combined");
const KAGGLE_MANIFEST_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_kaggle_landmarks");
const OUTPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_unified_augmented");

const FEATURE_DIMENSION = 126;
const LANDMARK_DIM = 66;
const TEMPORAL_NOISE_STD = 0.004;
const SCALE_JITTER_RANGE = 0.04;
const AUGMENTED_EXAMPLES_PER_LABEL = 50;

const LABELS = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n",
  "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
];

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let v = Math.imul(t ^ (t >>> 15), 1 | t);
    v ^= v + Math.imul(v ^ (v >>> 7), 61 | v);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
};

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };

const loadKaggleSamples = () => {
  const manifest = readJson(path.join(KAGGLE_MANIFEST_DIR, "manifest.json"));
  const samples = [];
  for (const label of manifest.labels) {
    const labelFile = path.join(KAGGLE_MANIFEST_DIR, `samples_${label}.json`);
    if (fs.existsSync(labelFile)) {
      const data = readJson(labelFile);
      for (const s of data.samples) {
        samples.push({ ...s, label: label.toLowerCase() });
      }
    }
  }
  return samples;
};

const generateTemporalJitter = (baseFrame, rng) => {
  const out = new Float32Array(FEATURE_DIMENSION);
  for (let i = 0; i < FEATURE_DIMENSION; i++) {
    const v = baseFrame[i];
    if (v === 0) {
      out[i] = 0;
    } else if (i < LANDMARK_DIM) {
      out[i] = v + (rng() - 0.5) * 2 * TEMPORAL_NOISE_STD;
    } else {
      out[i] = v + (rng() - 0.5) * 2 * TEMPORAL_NOISE_STD * 0.3;
    }
  }
  return Array.from(out);
};

const augmentSingleSample = (sample, rng, seenSigners) => {
  const baseFrames = sample.sequence;
  const seqLength = baseFrames.length;

  const scaleJitter = 1 + (rng() - 0.5) * SCALE_JITTER_RANGE;

  const augmentedSequence = baseFrames.map((frame, fi) => {
    const raw = generateTemporalJitter(frame, rng);
    const scaled = raw.map((v) => v === 0 ? 0 : v * scaleJitter);
    return scaled;
  });

  const signerBase = sample.signerId || "kaggle";
  const signerId = `kaggle-aug-${signerBase}-${Date.now()}-${Math.floor(rng() * 1e6)}`;

  return {
    label: sample.label,
    labelId: LABELS.indexOf(sample.label),
    signerId,
    sessionId: `aug-temporal-${sample.sessionId || sample.label}`,
    deviceType: "webcam-aug",
    lighting: "indoor-angled",
    handedness: sample.handedness || "right",
    augmentationPreset: "temporal-jitter",
    originalFile: null,
    source: "kaggle-augmented",
    sequence: augmentedSequence,
  };
};

const main = async () => {
  console.log("Kaggle Temporal Augmentation");
  console.log("=".repeat(40));

  const allKaggleSamples = loadKaggleSamples();
  console.log(`Loaded ${allKaggleSamples.length} Kaggle samples`);

  const byLabel = {};
  for (const s of allKaggleSamples) {
    if (!byLabel[s.label]) byLabel[s.label] = [];
    byLabel[s.label].push(s);
  }

  const trainSamples = [];
  const rng = mulberry32(2026);

  for (const label of LABELS) {
    const pool = byLabel[label] || [];
    if (pool.length === 0) {
      console.warn(`  No Kaggle samples for "${label}", skipping`);
      continue;
    }
    const count = Math.min(AUGMENTED_EXAMPLES_PER_LABEL, pool.length);
    const selected = [];
    for (let i = 0; i < count; i++) {
      selected.push(pool[i % pool.length]);
    }
    for (const base of selected) {
      trainSamples.push(augmentSingleSample(base, rng, {}));
    }
    console.log(`  ${label}: ${count} augmented samples`);
  }

  console.log(`\nTotal augmented samples: ${trainSamples.length}`);

  ensureDir(OUTPUT_DIR);
  ensureDir(OUTPUT_DIR);
  const outPath = path.join(OUTPUT_DIR, "train_augmented.json");

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

  const out = fs.createWriteStream(outPath);
  const writeChunk = (c) => new Promise((resolve) => { if (!out.write(c)) out.once("drain", resolve); else resolve(); });
  const metadataOut = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    augmentationType: "temporal-jitter",
    noiseStd: TEMPORAL_NOISE_STD,
    scaleJitter: SCALE_JITTER_RANGE,
    samplesPerLabel: AUGMENTED_EXAMPLES_PER_LABEL,
    totalSamples: trainSamples.length,
  };

  out.write(`{"metadata":${JSON.stringify(metadataOut)},"trainSamples":[`);
  for (let i = 0; i < trainSamples.length; i++) {
    const chunk = (i === 0 ? "" : ",") + formatValue(trainSamples[i]);
    await writeChunk(chunk);
    if ((i + 1) % 1000 === 0) console.log(`  Writing: ${i + 1}/${trainSamples.length}`);
  }
  out.write("]}");
  await new Promise((resolve) => out.end(resolve));
  console.log(`\nSaved ${outPath}`);
  console.log("Done.");
};

main().catch((err) => { console.error("Error:", err); process.exit(1); });
