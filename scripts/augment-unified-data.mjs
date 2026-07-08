import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const ROOT = process.cwd();
const ALPHA_DIR = path.join(ROOT, "datasets", "processed", "fsl_alphabet_kaggle_v2");
const FSL_DIR = path.join(ROOT, "datasets", "processed", "fsl_105");
const OUTPUT_DIR = path.join(ROOT, "datasets", "processed", "fsl_unified_augmented");

const FEATURE_DIM = 126;
const SEQUENCE_LEN = 120;

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const writeJson = (fp, data) => fs.writeFileSync(fp, JSON.stringify(data));
const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const streamNdjson = (filePath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) resolve([]);
    const samples = [];
    const stream = fs.createReadStream(filePath, { encoding: "utf8", highWaterMark: 1 << 20 });
    let leftover = "";
    stream.on("data", (chunk) => {
      const text = leftover + chunk;
      let start = 0;
      let newlineIdx;
      while ((newlineIdx = text.indexOf("\n", start)) !== -1) {
        const line = text.slice(start, newlineIdx);
        start = newlineIdx + 1;
        if (!line) continue;
        const obj = JSON.parse(line);
        if (obj._header) continue;
        samples.push(obj);
      }
      leftover = text.slice(start);
    });
    stream.on("end", () => resolve(samples));
    stream.on("error", reject);
  });
};

const loadJsonSamples = (dir, split = "train") => {
  // Try NDJSON first (streaming), fall back to JSON
  const ndPath = path.join(dir, `${split}.ndjson`);
  const jsonPath = path.join(dir, `${split}.json`);
  if (fs.existsSync(ndPath)) return streamNdjson(ndPath);
  const data = readJson(jsonPath);
  return Promise.resolve(data ? data.samples || [] : []);
};

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

const HAND_SIZE = 63; // 21 landmarks * 3 (x,y,z)
const LANDMARK_STRIDE = 3;

const mirrorAndSwapHand = (frame) => {
  if (!Array.isArray(frame) || frame.length !== FEATURE_DIM) {
    throw new Error(`mirrorAndSwapHand: expected frame of length ${FEATURE_DIM}, got ${frame?.length}`);
  }

  const slot0 = frame.slice(0, HAND_SIZE);
  const slot1 = frame.slice(HAND_SIZE, FEATURE_DIM);
  const out = new Array(FEATURE_DIM);

  // Mirror slot1 (original right hand) into output slot 0 (left hand slot)
  // Mirror slot0 (original left hand) into output slot 1 (right hand slot)
  // Hand slots are swapped so the model learns to recognize signs from either hand
  const mirrorSlot = (src, dst, dstOffset) => {
    for (let i = 0; i < HAND_SIZE; i += LANDMARK_STRIDE) {
      // negate x, preserve y and z
      dst[dstOffset + i]     = -src[i];       // x
      dst[dstOffset + i + 1] =  src[i + 1];   // y
      dst[dstOffset + i + 2] =  src[i + 2];   // z
    }
  };

  mirrorSlot(slot1, out, 0);
  mirrorSlot(slot0, out, HAND_SIZE);

  return out;
};

const augmentMirror = (sequence) => {
  return sequence.map((frame) => mirrorAndSwapHand(frame));
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

const main = async () => {
  ensureDir(OUTPUT_DIR);

  console.log("Loading alphabet training data...");
  const alphaTrainSamples = await loadJsonSamples(ALPHA_DIR);
  const alphaTrain = { samples: alphaTrainSamples };
  console.log(`  Train samples: ${alphaTrainSamples.length}`);

  console.log("Loading alphabet test data...");
  const alphaTestSamples = await loadJsonSamples(ALPHA_DIR, "test");
  const alphaTest = { samples: alphaTestSamples };
  console.log(`  Test samples: ${alphaTestSamples.length}`);

  console.log("Loading FSL-105 test data...");
  const fslTestSamples = await loadJsonSamples(FSL_DIR, "test");
  const fslTest = { samples: fslTestSamples };
  console.log(`  Test samples: ${fslTestSamples.length}`);

  console.log("Loading FSL-105 training data...");
  const fslTrainSamples = await loadJsonSamples(FSL_DIR);
  const fslTrain = { samples: fslTrainSamples };
  console.log(`  Train samples: ${fslTrainSamples.length}`);

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

  console.log(`\nWriting ${allAugmentedTrainSamples.length} augmented samples as NDJSON...`);
  const outPath = path.join(OUTPUT_DIR, "train_augmented.ndjson");
  const outFd = fs.openSync(outPath, "w");
  const enc = (str) => Buffer.from(str, "utf8");

  const header = JSON.stringify({
    _header: true,
    sequenceLength: SEQUENCE_LEN,
    featureDimension: FEATURE_DIM,
    metadata,
    totalSamples: allAugmentedTrainSamples.length
  });
  fs.writeSync(outFd, enc(header + "\n"));

  for (let i = 0; i < allAugmentedTrainSamples.length; i++) {
    fs.writeSync(outFd, enc(JSON.stringify(allAugmentedTrainSamples[i]) + "\n"));
    if ((i + 1) % 10000 === 0) console.log(`    ${i + 1}/${allAugmentedTrainSamples.length}`);
  }
  fs.closeSync(outFd);
  console.log(`  Written to ${outPath}`);

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

const verifyMirrorLogic = () => {
  console.log("=== Verifying mirror augmentation logic ===");

  // Build a synthetic frame with distinguishable values in each hand slot
  const frame = new Array(FEATURE_DIM).fill(0);
  // Fill slot 0 (left hand) with pattern 0..62
  for (let i = 0; i < HAND_SIZE; i++) frame[i] = i + 1;
  // Fill slot 1 (right hand) with pattern 100..162
  for (let i = 0; i < HAND_SIZE; i++) frame[HAND_SIZE + i] = 100 + i + 1;

  const mirrored = mirrorAndSwapHand(frame);

  // 1. Check output length
  const lenOk = mirrored.length === FEATURE_DIM;
  console.log(`  Length: ${mirrored.length} (expected ${FEATURE_DIM}) ${lenOk ? "✓" : "✗"}`);

  // 2. Verify slot swap: original slot1 x values (negated) should appear in output slot0
  let swapOk = true;
  for (let i = 0; i < HAND_SIZE; i += LANDMARK_STRIDE) {
    // original slot1 at index HAND_SIZE + i
    const origSlot1X = frame[HAND_SIZE + i];
    // mirrored output slot0 at index i
    const outSlot0X = mirrored[i];
    if (Math.abs(outSlot0X - (-origSlot1X)) > 1e-10) { swapOk = false; break; }
  }
  console.log(`  Slot swap (slot1→slot0, x negated): ${swapOk ? "✓" : "✗"}`);

  // 3. Verify slot swap: original slot0 x values (negated) should appear in output slot1
  let swapOk2 = true;
  for (let i = 0; i < HAND_SIZE; i += LANDMARK_STRIDE) {
    const origSlot0X = frame[i];
    const outSlot1X = mirrored[HAND_SIZE + i];
    if (Math.abs(outSlot1X - (-origSlot0X)) > 1e-10) { swapOk2 = false; break; }
  }
  console.log(`  Slot swap (slot0→slot1, x negated): ${swapOk2 ? "✓" : "✗"}`);

  // 4. Verify y and z are preserved (just swapped)
  let yzOk = true;
  for (let i = 1; i < HAND_SIZE; i += LANDMARK_STRIDE) {
    // y: original slot1 y at HAND_SIZE+i → output slot0 y at i
    if (Math.abs(mirrored[i] - frame[HAND_SIZE + i]) > 1e-10) { yzOk = false; break; }
    // y: original slot0 y at i → output slot1 y at HAND_SIZE+i
    if (Math.abs(mirrored[HAND_SIZE + i] - frame[i]) > 1e-10) { yzOk = false; break; }
    // z: same pattern at i+1
    if (Math.abs(mirrored[i + 1] - frame[HAND_SIZE + i + 1]) > 1e-10) { yzOk = false; break; }
    if (Math.abs(mirrored[HAND_SIZE + i + 1] - frame[i + 1]) > 1e-10) { yzOk = false; break; }
  }
  console.log(`  y/z values preserved after swap: ${yzOk ? "✓" : "✗"}`);

  // 5. Verify double mirror returns original
  const doubleMirrored = mirrorAndSwapHand(mirrored);
  let doubleOk = true;
  for (let i = 0; i < FEATURE_DIM; i++) {
    if (Math.abs(doubleMirrored[i] - frame[i]) > 1e-10) { doubleOk = false; break; }
  }
  console.log(`  Double mirror (involution): ${doubleOk ? "✓" : "✗"}`);

  const allOk = lenOk && swapOk && swapOk2 && yzOk && doubleOk;
  console.log(`  Overall: ${allOk ? "ALL CHECKS PASSED ✓" : "FAILED ✗"}`);
  if (!allOk) { console.error("Mirror verification failed. Aborting."); process.exit(1); }
};

verifyMirrorLogic();
main();
