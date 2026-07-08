import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ALPHA_DIR = path.join(ROOT, "datasets", "processed", "fsl_alphabet_kaggle_v2");
const FSL_DIR = path.join(ROOT, "datasets", "processed", "fsl_105");
const OUT_DIR = path.join(ROOT, "datasets", "processed", "fsl_unified_balanced");
const DOCS_DIR = path.join(ROOT, "docs");

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const writeJson = (fp, d) => fs.writeFileSync(fp, JSON.stringify(d));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const mulberry = (s) => {
  let t = s >>> 0;
  return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; };
};
const rng = mulberry(2026);

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const aLabels = readJson(path.join(ALPHA_DIR, "labels.json"));
const fLabels = readJson(path.join(FSL_DIR, "labels.json"));
const unifiedMeta = readJson(path.join(ROOT, "datasets", "processed", "fsl_unified", "metadata.json"));

const allLabels = [...aLabels.labels, ...fLabels.labels];
const alphaCount = aLabels.labels.length;

const aTrain = readJson(path.join(ALPHA_DIR, "train.json"));
const aTest = readJson(path.join(ALPHA_DIR, "test.json"));
const fTrain = readJson(path.join(FSL_DIR, "train.json"));
const fTest = readJson(path.join(FSL_DIR, "test.json"));

const remapFsl = (samples) => samples.map((s) => ({ ...s, labelId: s.labelId + alphaCount }));
const fTrainR = remapFsl(fTrain.samples);
const fTestR = remapFsl(fTest.samples);
const allTrainRaw = [...aTrain.samples, ...fTrainR];
const allTestRaw = [...aTest.samples, ...fTestR];

const countByLabel = (samples) => {
  const counts = {};
  for (const s of samples) counts[s.label] = (counts[s.label] || 0) + 1;
  return counts;
};

const trainCounts = countByLabel(allTrainRaw);
const labelIds = {};
for (const s of allTrainRaw) labelIds[s.label] = s.labelId;

const generateSyntheticSample = (baseSample) => {
  const seq = baseSample.sequence.map((frame) => {
    return frame.map((v) => v === 0 ? 0 : v + (rng() - 0.5) * 2 * 0.005);
  });
  const scale = 0.9 + rng() * 0.2;
  const scaledSeq = seq.map((frame) => frame.map((v) => v === 0 ? 0 : v * scale));
  return { ...baseSample, sequence: scaledSeq, augmented: true, augmentationType: "balance-oversample" };
};

const alphaCounts = Object.entries(trainCounts).filter(([k]) => k.length === 1 || k === "\xF1" || k === "ng");
const fslCounts = Object.entries(trainCounts).filter(([k]) => k.length > 2);
const alphaTarget = Math.max(20, ...alphaCounts.map(([, v]) => v));
const fslTarget = Math.max(15, ...fslCounts.map(([, v]) => v));

console.log(`Alpha target: ${alphaTarget}, FSL target: ${fslTarget}`);

const oversampleStats = { alphabet: {}, fsl: {} };
let totalAdded = 0;

const applyOversampling = (samples, baseSample) => {
  const label = baseSample.label;
  const currentCount = trainCounts[label];
  const isAlpha = (labelIds[label] ?? 0) < alphaCount;
  const target = isAlpha ? alphaTarget : fslTarget;
  const deficit = target - currentCount;
  if (deficit <= 0) return 0;
  const group = isAlpha ? "alphabet" : "fsl";
  if (!oversampleStats[group][label]) oversampleStats[group][label] = { original: currentCount, added: 0, target };
  const copies = Math.ceil(deficit / currentCount);
  for (let c = 0; c < copies; c++) {
    samples.push(generateSyntheticSample(baseSample));
    oversampleStats[group][label].added++;
    totalAdded++;
  }
  return copies;
};

const balancedSamples = [...allTrainRaw];
for (const s of allTrainRaw) applyOversampling(balancedSamples, s);
for (const s of allTrainRaw) {
  if (["m", "n", "d", "p", "q"].includes(s.label)) {
    for (let c = 0; c < 2; c++) { balancedSamples.push(generateSyntheticSample(s)); totalAdded++; }
  }
}

const balancedCounts = countByLabel(balancedSamples);
const shuffled = shuffle(balancedSamples);
const valCount = Math.floor(shuffled.length * 0.15);
const trainFinal = shuffled.slice(0, shuffled.length - valCount);
const valFinal = shuffled.slice(shuffled.length - valCount);

const origCounts = Object.entries(trainCounts).sort((a, b) => a[0].localeCompare(b[0]));
const balCounts = Object.entries(balancedCounts).sort((a, b) => a[0].localeCompare(b[0]));

const report = {
  generated: new Date().toISOString(),
  summary: {
    originalTrainSamples: allTrainRaw.length,
    balancedTrainSamples: balancedSamples.length,
    testSamples: allTestRaw.length,
    validationSamples: valFinal.length,
    totalSamples: balancedSamples.length + valFinal.length + allTestRaw.length,
    oversampleFactor: (balancedSamples.length / allTrainRaw.length).toFixed(2),
    totalSyntheticAdded: totalAdded,
  },
  classDistribution: {
    original: origCounts.map(([label, count]) => ({ label, count, labelId: labelIds[label] })),
    balanced: balCounts.map(([label, count]) => ({ label, count })),
    focusedLabels: ["m", "n", "d", "p", "q"].map((l) => ({
      label: l, original: trainCounts[l] || 0, balanced: balancedCounts[l] || 0, labelId: labelIds[l],
    })),
  },
  imbalanceMetrics: {
    original: {
      min: Math.min(...Object.values(trainCounts)),
      max: Math.max(...Object.values(trainCounts)),
      ratio: (Math.max(...Object.values(trainCounts)) / Math.min(...Object.values(trainCounts))).toFixed(2),
    },
    balanced: {
      min: Math.min(...Object.values(balancedCounts)),
      max: Math.max(...Object.values(balancedCounts)),
      ratio: (Math.max(...Object.values(balancedCounts)) / Math.min(...Object.values(balancedCounts))).toFixed(2),
    },
  },
  oversampling: oversampleStats,
};

ensureDir(OUT_DIR);
writeJson(path.join(OUT_DIR, "metadata.json"), {
  totalLabels: allLabels.length,
  labels: allLabels,
  splits: { train: trainFinal.length, validation: valFinal.length, test: allTestRaw.length },
  originalSamples: allTrainRaw.length,
  balancedSamples: balancedSamples.length,
  oversampleFactor: (balancedSamples.length / allTrainRaw.length).toFixed(2),
  unbalancedClasses: ["m", "n", "d", "p", "q"],
  createdAt: new Date().toISOString(),
});
writeJson(path.join(OUT_DIR, "labels.json"), { labels: allLabels });
writeJson(path.join(OUT_DIR, "report.json"), report);

// Write lightweight sample index only (not full sequences)
const writeIndex = (samples, filePath) => {
  const index = samples.map((s, i) => ({
    index: i, label: s.label, labelId: s.labelId, signerId: s.signerId,
    source: s.source ?? "fsl_unified", augmented: !!s.augmented,
    originalFrames: s.originalFrameCount ?? s.sequence?.length ?? 120,
  }));
  fs.writeFileSync(filePath, JSON.stringify(index));
};
writeIndex(trainFinal, path.join(OUT_DIR, "train_index.json"));
writeIndex(valFinal, path.join(OUT_DIR, "val_index.json"));

ensureDir(DOCS_DIR);
const doc = `# Balanced Dataset Results

Generated: ${new Date().toISOString().split("T")[0]}

## Summary

| Metric | Original | Balanced |
|--------|----------|----------|
| Training samples | ${allTrainRaw.length} | ${balancedSamples.length} |
| Validation samples | 0 (from train split) | ${valFinal.length} |
| Test samples | ${allTestRaw.length} | ${allTestRaw.length} |
| Imbalance ratio | ${report.imbalanceMetrics.original.ratio}x | ${report.imbalanceMetrics.balanced.ratio}x |
| Synthetic samples added | — | ${totalAdded} |

## Focused Labels

| Label | Original | Balanced | Label ID |
|-------|----------|----------|----------|
${report.classDistribution.focusedLabels.map((l) => `| ${l.label} | ${l.original} | ${l.balanced} | ${l.labelId} |`).join("\n")}

## Method

- Oversampling with mild noise (\\u03c3=0.005) + random scaling (0.9-1.1x)
- Target: ${alphaTarget} samples per alphabet class, ${fslTarget} per FSL class
- Focused doubling for: m, n, d, p, q

## Output

\`\`\`
${OUT_DIR}/
  metadata.json
  labels.json
  report.json
  train_index.json  (${trainFinal.length} sample indices)
  val_index.json    (${valFinal.length} sample indices)
\`\`\`
`;
fs.writeFileSync(path.join(DOCS_DIR, "balanced-dataset-results.md"), doc);

console.log("=== Class Balancing Complete ===");
console.log(`Original: ${allTrainRaw.length} → Balanced: ${balancedSamples.length}`);
console.log(`Imbalance ratio: ${report.imbalanceMetrics.original.ratio}x → ${report.imbalanceMetrics.balanced.ratio}x`);
console.log(`Added ${totalAdded} synthetic samples`);
console.log(`Focused labels (m, n, d, p, q): boosted`);
console.log(`Output: ${OUT_DIR}`);
