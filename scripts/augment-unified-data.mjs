import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const ROOT = process.cwd();
const ALPHA_DIR = path.join(ROOT, "datasets", "processed", "fsl_alphabet_v2");
const FSL_DIR = path.join(ROOT, "datasets", "processed", "fsl_105");
const OUTPUT_DIR = path.join(ROOT, "datasets", "processed", "fsl_unified_augmented");

const FEATURE_DIM = 126;
const SEQUENCE_LEN = 120;

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const writeJson = (fp, data) => fs.writeFileSync(fp, JSON.stringify(data));
const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const mulberry = (seed) => {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; };
};

const rng = mulberry(Date.now());

const augmentTimeWarp = (sequence, sigma = 0.05) => {
  const T = sequence.length;
  const warped = [];
  for (let t = 0; t < T; t++) {
    const srcIdx = Math.max(0, Math.min(T - 1, Math.round(t + rng() * sigma * T)));
    warped.push([...sequence[srcIdx]]);
  }
  return warped;
};

const augmentNoise = (sequence, std = 0.01) => {
  return sequence.map((frame) => {
    return frame.map((v) => v === 0 ? 0 : v + (rng() - 0.5) * 2 * std);
  });
};

const augmentScale = (sequence, factor = null) => {
  const s = factor ?? (0.8 + rng() * 0.4);
  return sequence.map((frame) => frame.map((v) => v === 0 ? 0 : v * s));
};

const augmentRotation = (sequence, angleDeg = null) => {
  const angle = (angleDeg ?? (rng() * 20 - 10)) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return sequence.map((frame) => {
    const out = [...frame];
    for (let i = 0; i < 66; i += 2) {
      const x = frame[i], y = frame[i + 1];
      out[i] = x * cos - y * sin;
      out[i + 1] = x * sin + y * cos;
    }
    return out;
  });
};

const augmentTranslate = (sequence, shift = null) => {
  const s = shift ?? ((rng() - 0.5) * 0.2);
  return sequence.map((frame) => {
    const out = [...frame];
    for (let i = 0; i < 66; i += 2) {
      out[i] += s;
      out[i + 1] += s;
    }
    return out;
  });
};

const augmentTemporalMask = (sequence, maskRatio = 0.15) => {
  const T = sequence.length;
  const maskLen = Math.max(1, Math.floor(T * maskRatio));
  const start = Math.floor(rng() * (T - maskLen));
  const out = sequence.map((f) => [...f]);
  for (let t = start; t < start + maskLen && t < T; t++) {
    out[t] = new Array(FEATURE_DIM).fill(0);
  }
  return out;
};

const augmentLandmarkDropout = (sequence, dropoutRate = 0.05) => {
  return sequence.map((frame) => {
    const out = [...frame];
    for (let i = 0; i < FEATURE_DIM; i++) {
      if (rng() < dropoutRate) out[i] = 0;
    }
    return out;
  });
};

const augmentMirror = (sequence) => {
  return sequence.map((frame) => {
    const out = [...frame];
    for (let i = 0; i < 66; i += 2) {
      out[i] = -frame[i];
    }
    return out;
  });
};

const augmentTimeReverse = (sequence) => {
  return [...sequence].reverse().map((f) => [...f]);
};

const augmentationMethods = [
  { name: "time-warp", fn: augmentTimeWarp, probability: 0.3, copies: 1 },
  { name: "noise", fn: augmentNoise, probability: 0.3, copies: 1 },
  { name: "scale", fn: augmentScale, probability: 0.3, copies: 1 },
  { name: "rotation", fn: augmentRotation, probability: 0.2, copies: 1 },
  { name: "translate", fn: augmentTranslate, probability: 0.2, copies: 1 },
  { name: "temporal-mask", fn: augmentTemporalMask, probability: 0.2, copies: 1 },
  { name: "landmark-dropout", fn: augmentLandmarkDropout, probability: 0.2, copies: 1 },
  { name: "mirror", fn: augmentMirror, probability: 0.15, copies: 1 },
  { name: "time-reverse", fn: augmentTimeReverse, probability: 0.1, copies: 1 },
];

const applyAugmentationPreset = (sample, presetName) => {
  const { sequence, ...meta } = sample;
  let augmented = sequence.map((f) => [...f]);

  switch (presetName) {
    case "light":
      augmented = augmentNoise(augmented, 0.005);
      break;
    case "medium":
      augmented = augmentNoise(augmentScale(augmented, 0.9 + rng() * 0.2), 0.01);
      break;
    case "heavy":
      augmented = augmentNoise(augmentScale(augmentTimeWarp(augmented, 0.1), 0.8 + rng() * 0.4), 0.015);
      augmented = augmentTemporalMask(augmented);
      break;
    case "mirror":
      augmented = augmentMirror(augmented);
      break;
    default:
      break;
  }

  return {
    ...meta,
    sequence: augmented,
    augmentationPreset: presetName,
  };
};

const main = () => {
  ensureDir(OUTPUT_DIR);

  const alphaTrain = readJson(path.join(ALPHA_DIR, "train.json"));
  const alphaTest = readJson(path.join(ALPHA_DIR, "test.json"));
  const fslTrain = readJson(path.join(FSL_DIR, "train.json"));
  const fslTest = readJson(path.join(FSL_DIR, "test.json"));

  const augmented = [];
  let originalCount = 0;
  const augmentationPresets = ["light", "medium", "heavy", "mirror"];

  const processSamples = (samples, source) => {
    for (const sample of samples) {
      originalCount++;
      for (const preset of augmentationPresets) {
        const augSample = applyAugmentationPreset(sample, preset);
        augmented.push(augSample);
      }
    }
  };

  processSamples(alphaTrain.samples, "alphabet");
  processSamples(fslTrain.samples, "fsl105");

  const alphaTrainAugSamples = [];
  for (const s of alphaTrain.samples) {
    for (const method of augmentationMethods) {
      if (rng() < method.probability) {
        for (let c = 0; c < method.copies; c++) {
          const seq = method.fn(s.sequence.map((f) => [...f]));
          alphaTrainAugSamples.push({ ...s, sequence: seq, augmentationPreset: method.name });
        }
      }
    }
  }

  const fslCountPerLabel = {};
  for (const s of fslTrain.samples) {
    fslCountPerLabel[s.labelId] = (fslCountPerLabel[s.labelId] || 0) + 1;
  }

  const underRepresentedLabels = Object.entries(fslCountPerLabel)
    .filter(([_, count]) => count < 10)
    .map(([labelId]) => Number.parseInt(labelId));

  const fslTrainAugSamples = [];
  for (const s of fslTrain.samples) {
    for (const method of augmentationMethods) {
      const overrideProb = underRepresentedLabels.includes(s.labelId) ? 0.6 : method.probability;
      if (rng() < overrideProb) {
        for (let c = 0; c < (underRepresentedLabels.includes(s.labelId) ? 3 : method.copies); c++) {
          const seq = method.fn(s.sequence.map((f) => [...f]));
          fslTrainAugSamples.push({ ...s, sequence: seq, augmentationPreset: method.name });
        }
      }
    }
  }

  const allAugmentedTrainSamples = [
    ...alphaTrain.samples,
    ...alphaTrainAugSamples,
    ...fslTrain.samples,
    ...fslTrainAugSamples,
  ];

  const metadata = {
    originalCount,
    augmentedCount: allAugmentedTrainSamples.length,
    augmentationPresets,
    methods: augmentationMethods.map((m) => ({ name: m.name, probability: m.probability })),
    underRepresentedLabels: underRepresentedLabels.map((id) => ({ labelId: id })),
    createdAt: new Date().toISOString(),
  };

  const augResults = {
    sequenceLength: SEQUENCE_LEN,
    featureDimension: FEATURE_DIM,
    metadata,
    trainSamples: allAugmentedTrainSamples,
  };

  writeJson(path.join(OUTPUT_DIR, "train_augmented.json"), augResults);

  const testMerged = {
    sequenceLength: SEQUENCE_LEN,
    featureDimension: FEATURE_DIM,
    samples: [...alphaTest.samples, ...fslTest.samples],
  };

  writeJson(path.join(OUTPUT_DIR, "test.json"), testMerged);

  console.log("=== Data Augmentation Complete ===");
  console.log(`Original training samples: ${originalCount}`);
  console.log(`Augmented training samples: ${allAugmentedTrainSamples.length}`);
  console.log(`Augmentation factor: ${(allAugmentedTrainSamples.length / originalCount).toFixed(2)}x`);
  console.log(`Under-represented FSL labels (count < 10): ${underRepresentedLabels.length}`);
  console.log(`Output: ${OUTPUT_DIR}`);
};

main();
