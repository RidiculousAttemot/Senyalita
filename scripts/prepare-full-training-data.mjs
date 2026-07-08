import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ALPHA_DIR = path.join(ROOT, "datasets", "processed", "fsl_alphabet_kaggle_v2");
const FSL_DIR = path.join(ROOT, "datasets", "processed", "fsl_105");
const BALANCED_DIR = path.join(ROOT, "datasets", "processed", "fsl_unified_balanced");
const HARD_DIR = path.join(ROOT, "datasets", "hard_samples");

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const writeJson = (fp, d) => fs.writeFileSync(fp, JSON.stringify(d));

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;

const aLabels = readJson(path.join(ALPHA_DIR, "labels.json"));
const fLabels = readJson(path.join(FSL_DIR, "labels.json"));
const ac = aLabels.labels.length;
const allLabels = [...aLabels.labels, ...fLabels.labels];

const aTrain = readJson(path.join(ALPHA_DIR, "train.json"));
const aTest = readJson(path.join(ALPHA_DIR, "test.json"));
const fTrain = readJson(path.join(FSL_DIR, "train.json"));
const fTest = readJson(path.join(FSL_DIR, "test.json"));

const remapFsl = (samples) => samples.map((s) => ({ ...s, labelId: s.labelId + ac }));
const ftTrain = remapFsl(fTrain.samples);
const ftTest = remapFsl(fTest.samples);

const allOrigTrain = [...aTrain.samples, ...ftTrain];

const mulberry = (s) => {
  let t = s >>> 0;
  return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; };
};
const rng = mulberry(2026);

const generateSyntheticSample = (baseSample) => {
  const seq = baseSample.sequence.map((frame) =>
    frame.map((v) => v === 0 ? 0 : v + (rng() - 0.5) * 2 * 0.005)
  );
  const scale = 0.9 + rng() * 0.2;
  return {
    ...baseSample,
    sequence: seq.map((frame) => frame.map((v, i) => v === 0 ? 0 : v * scale)),
    augmented: true,
    augmentationType: "balance-oversample"
  };
};

const countByLabel = (samples) => {
  const counts = {};
  for (const s of samples) counts[s.label] = (counts[s.label] || 0) + 1;
  return counts;
};

const trainCounts = countByLabel(allOrigTrain);
const labelIds = {};
for (const s of allOrigTrain) labelIds[s.label] = s.labelId;

const alphaCounts = Object.entries(trainCounts).filter(([k]) => k.length === 1 || k === "\xF1" || k === "ng");
const fslCounts = Object.entries(trainCounts).filter(([k]) => k.length > 2);
const alphaTarget = Math.max(20, ...alphaCounts.map(([, v]) => v));
const fslTarget = Math.max(15, ...fslCounts.map(([, v]) => v));

console.log(`Balancing: alpha target=${alphaTarget}, fsl target=${fslTarget}`);

const balancedSamples = [...allOrigTrain];
let totalAdded = 0;

const oversample = (label, currentCount, target) => {
  const deficit = target - currentCount;
  if (deficit <= 0) return 0;
  const candidates = allOrigTrain.filter((s) => s.label === label);
  if (candidates.length === 0) return 0;
  const copies = Math.ceil(deficit / candidates.length);
  let added = 0;
  for (let c = 0; c < copies; c++) {
    for (const base of candidates) {
      if (added >= deficit) break;
      balancedSamples.push(generateSyntheticSample(base));
      added++;
      totalAdded++;
    }
    if (added >= deficit) break;
  }
  return added;
};

// Oversample each class to target
for (const [label, count] of alphaCounts) {
  oversample(label, count, alphaTarget);
}
for (const [label, count] of fslCounts) {
  oversample(label, count, fslTarget);
}

// Focused boosting for m, n, d, p, q
for (const s of allOrigTrain) {
  if (["m", "n", "d", "p", "q"].includes(s.label)) {
    for (let c = 0; c < 2; c++) {
      balancedSamples.push(generateSyntheticSample(s));
      totalAdded++;
    }
  }
}

// Shuffle and split into train/val
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const shuffled = shuffle(balancedSamples);
const valCount = Math.floor(shuffled.length * 0.15);
const trainFinal = shuffled.slice(0, shuffled.length - valCount);
const valFinal = shuffled.slice(shuffled.length - valCount);

console.log(`Balanced: ${balancedSamples.length} (train=${trainFinal.length}, val=${valFinal.length}), added=${totalAdded}`);

// Save full training data
const OUT = path.join(BALANCED_DIR, "train.json");
writeJson(OUT, { samples: trainFinal });
writeJson(path.join(BALANCED_DIR, "val.json"), { samples: valFinal });
console.log(`Saved ${OUT}`);

// Hard samples: build from confusion matrix
const MODEL_DIR = path.join(ROOT, "models", "fsl_unified", "bilstm");
const confusionData = readJson(path.join(MODEL_DIR, "confusion_matrix.json"));
const { labels, matrix } = confusionData;
const numClasses = labels.length;

const perClassMetrics = [];
for (let i = 0; i < numClasses; i++) {
  const tp = matrix[i][i]; let fp = 0, fn = 0, sup = 0;
  for (let j = 0; j < numClasses; j++) {
    if (j !== i) { fp += matrix[j][i]; fn += matrix[i][j]; }
    sup += matrix[i][j];
  }
  const p = tp + fp === 0 ? 0 : tp / (tp + fp);
  const r = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = p + r === 0 ? 0 : (2 * p * r) / (p + r);
  perClassMetrics.push({ label: labels[i], index: i, tp, fp, fn, sup, f1, errorRate: sup > 0 ? fn / sup : 0 });
}

const confusionPairs = [];
for (let i = 0; i < numClasses; i++) {
  for (let j = 0; j < numClasses; j++) {
    if (i !== j && matrix[i][j] > 0) {
      confusionPairs.push({ trueLabel: labels[i], predictedLabel: labels[j], trueIdx: i, predIdx: j, count: matrix[i][j] });
    }
  }
}
confusionPairs.sort((a, b) => b.count - a.count);

const hardSamples = [];
const seen = new Set();
for (const pair of confusionPairs.slice(0, 40)) {
  const trueSamples = allOrigTrain.filter((s) => s.label === pair.trueLabel);
  const confuserSamples = allOrigTrain.filter((s) => s.label === pair.predictedLabel);
  for (const s of [...trueSamples, ...confuserSamples]) {
    const key = `${s.label}_${s.signerId}_${pair.trueLabel}_${pair.predictedLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const pcm = perClassMetrics.find((p) => p.label === s.label);
    const weight = pcm ? 1.0 + (1 - pcm.f1) * 3 : 1.0;
    hardSamples.push({ ...s, weight: Number(weight.toFixed(2)), hardPair: `${pair.trueLabel}__VS__${pair.predictedLabel}` });
  }
}

writeJson(path.join(HARD_DIR, "hard_samples.json"), { samples: hardSamples });
console.log(`Hard samples: ${hardSamples.length}`);

console.log("Training data preparation complete.");
