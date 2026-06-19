import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ALPHA_DIR = path.join(ROOT, "datasets", "processed", "fsl_alphabet_v2");
const FSL_DIR = path.join(ROOT, "datasets", "processed", "fsl_105");
const BALANCED_DIR = path.join(ROOT, "datasets", "processed", "fsl_unified_balanced");
const HARD_DIR = path.join(ROOT, "datasets", "hard_samples");

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const writeJson = (fp, d) => fs.writeFileSync(fp, JSON.stringify(d, null, 2));

const ac = readJson(path.join(ALPHA_DIR, "labels.json")).labels.length;

console.log("Preparing training data for v3...");

// Load original datasets
const aTrain = readJson(path.join(ALPHA_DIR, "train.json"));
const aTest = readJson(path.join(ALPHA_DIR, "test.json"));
const fTrain = readJson(path.join(FSL_DIR, "train.json"));
const fTest = readJson(path.join(FSL_DIR, "test.json"));

const remapFsl = (samples) => samples.map((s) => ({ ...s, labelId: s.labelId + ac }));
const ftTrain = remapFsl(fTrain.samples);
const ftTest = remapFsl(fTest.samples);

// Build lookup from original data
const allOrigTrain = [...aTrain.samples, ...ftTrain];
const labelSamples = {};
for (const s of allOrigTrain) {
  if (!labelSamples[s.label]) labelSamples[s.label] = [];
  labelSamples[s.label].push(s);
}

// Balanced dataset: generate full samples from index
const balTrainIdx = readJson(path.join(BALANCED_DIR, "train_index.json"));
const balValIdx = readJson(path.join(BALANCED_DIR, "val_index.json"));

const mulberry = (s) => {
  let t = s >>> 0;
  return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; };
};
const rng = mulberry(2026);

const generateSyntheticSample = (baseSample) => {
  const seq = baseSample.sequence.map((frame) => {
    return frame.map((v) => v === 0 ? 0 : v + (rng() - 0.5) * 2 * 0.005);
  });
  const scale = 0.9 + rng() * 0.2;
  const scaledSeq = seq.map((frame) => frame.map((v) => v === 0 ? 0 : v * scale));
  return { ...baseSample, sequence: scaledSeq, augmented: true, augmentationType: "balance-oversample" };
};

const reconstructSamples = (idx) => {
  const result = [];
  for (const entry of idx) {
    const candidates = labelSamples[entry.label];
    if (!candidates || candidates.length === 0) continue;
    const base = candidates[entry.index % candidates.length];
    if (entry.augmented) {
      result.push(generateSyntheticSample(base));
    } else {
      result.push({ ...base, labelId: entry.labelId });
    }
  }
  return result;
};

console.log("Reconstructing balanced training set...");
const balTrain = reconstructSamples(balTrainIdx);
const balVal = reconstructSamples(balValIdx);
writeJson(path.join(BALANCED_DIR, "train.json"), { samples: balTrain });
writeJson(path.join(BALANCED_DIR, "val.json"), { samples: balVal });
console.log(`Balanced train: ${balTrain.length}, val: ${balVal.length}`);

// Hard samples: build from hard_index by looking up original samples and assigning weights
console.log("Reconstructing hard sample set...");
const hardIdx = readJson(path.join(HARD_DIR, "hard_index.json"));
const hardEntries = hardIdx.entries;

const hardSamples = [];
for (const entry of hardEntries) {
  const candidates = labelSamples[entry.label];
  if (!candidates || candidates.length === 0) continue;
  const base = candidates[0];
  hardSamples.push({ ...base, labelId: entry.labelId, weight: entry.weight, hardPair: entry.confusionPair });
}
writeJson(path.join(HARD_DIR, "hard_samples.json"), { samples: hardSamples });
console.log(`Hard samples: ${hardSamples.length}`);

console.log("Training data prepared.");
