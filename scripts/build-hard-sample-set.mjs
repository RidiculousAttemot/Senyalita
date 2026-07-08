import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const MODEL_DIR = path.join(ROOT, "models", "fsl_unified", "bilstm");
const ALPHA_DIR = path.join(ROOT, "datasets", "processed", "fsl_alphabet_kaggle_v2");
const FSL_DIR = path.join(ROOT, "datasets", "processed", "fsl_105");
const HARD_DIR = path.join(ROOT, "datasets", "hard_samples");
const DOCS_DIR = path.join(ROOT, "docs");

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const writeJson = (fp, d) => fs.writeFileSync(fp, JSON.stringify(d));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const confusionData = readJson(path.join(MODEL_DIR, "confusion_matrix.json"));
const aLabels = readJson(path.join(ALPHA_DIR, "labels.json"));
const fLabels = readJson(path.join(FSL_DIR, "labels.json"));
const aTrain = readJson(path.join(ALPHA_DIR, "train.json"));
const aTest = readJson(path.join(ALPHA_DIR, "test.json"));
const fTrain = readJson(path.join(FSL_DIR, "train.json"));
const fTest = readJson(path.join(FSL_DIR, "test.json"));

const { labels, matrix } = confusionData;
const alphaCount = aLabels.labels.length;
const numClasses = labels.length;

const confusion = matrix.map((row) => row.map((v) => (typeof v === "number" ? v : 0)));

const remapFsl = (s) => s.map((x) => ({ ...x, labelId: x.labelId + alphaCount }));
const allTrain = [...aTrain.samples, ...remapFsl(fTrain.samples)];
const allTest = [...aTest.samples, ...remapFsl(fTest.samples)];

const perClassMetrics = [];
for (let i = 0; i < numClasses; i++) {
  const tp = confusion[i][i]; let fp = 0, fn = 0, sup = 0;
  for (let j = 0; j < numClasses; j++) {
    if (j !== i) { fp += confusion[j][i]; fn += confusion[i][j]; }
    sup += confusion[i][j];
  }
  const p = tp + fp === 0 ? 0 : tp / (tp + fp);
  const r = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = p + r === 0 ? 0 : (2 * p * r) / (p + r);
  perClassMetrics.push({ label: labels[i], index: i, tp, fp, fn, sup, f1, errorRate: sup > 0 ? fn / sup : 0 });
}

const worstByF1 = [...perClassMetrics].sort((a, b) => a.f1 - b.f1).slice(0, 20);
const worstByErrors = [...perClassMetrics].sort((a, b) => b.fn - a.fn).slice(0, 20);

const confusionPairs = [];
for (let i = 0; i < numClasses; i++) {
  for (let j = 0; j < numClasses; j++) {
    if (i !== j && confusion[i][j] > 0) {
      confusionPairs.push({ trueLabel: labels[i], predictedLabel: labels[j], trueIdx: i, predIdx: j, count: confusion[i][j] });
    }
  }
}
confusionPairs.sort((a, b) => b.count - a.count);

const findSamples = (samples, label) => samples.filter((s) => s.label === label);

const pairMetadata = {};
let totalHardSamples = 0;

for (const pair of confusionPairs.slice(0, 40)) {
  const trueSamples = findSamples([...allTrain, ...allTest], pair.trueLabel);
  const confuserSamples = findSamples([...allTrain, ...allTest], pair.predictedLabel);
  const pairKey = `${pair.trueLabel}__VS__${pair.predictedLabel}`;
  pairMetadata[pairKey] = {
    trueLabel: pair.trueLabel,
    predictedLabel: pair.predictedLabel,
    confusionCount: pair.count,
    trueSamplesAvailable: trueSamples.length,
    confuserSamplesAvailable: confuserSamples.length,
  };
  totalHardSamples += trueSamples.length + confuserSamples.length;
}

const hardLabels = new Set();
for (const p of Object.values(pairMetadata)) { hardLabels.add(p.trueLabel); hardLabels.add(p.predictedLabel); }

// Write lightweight metadata and index only (not full sequences)
const hardIndex = [];
for (const [key, pair] of Object.entries(pairMetadata)) {
  const trueSamples = findSamples([...allTrain, ...allTest], pair.trueLabel);
  const confuserSamples = findSamples([...allTrain, ...allTest], pair.predictedLabel);
  for (const s of trueSamples) {
    const pcm = perClassMetrics.find((p) => p.label === s.label);
    const weight = pcm ? 1.0 + (1 - pcm.f1) * 3 : 1.0;
    hardIndex.push({ label: s.label, labelId: s.labelId, confusionPair: key, sampleType: "true_class", weight: Number(weight.toFixed(2)) });
  }
  for (const s of confuserSamples) {
    const pcm = perClassMetrics.find((p) => p.label === s.label);
    const weight = pcm ? 1.0 + (1 - pcm.f1) * 3 : 1.0;
    hardIndex.push({ label: s.label, labelId: s.labelId, confusionPair: key, sampleType: "confuser_class", weight: Number(weight.toFixed(2)) });
  }
}

const metadata = {
  generated: new Date().toISOString(),
  totalHardEntries: hardIndex.length,
  uniqueConfusionPairs: Object.keys(pairMetadata).length,
  uniqueHardLabels: hardLabels.size,
  weightRange: {
    min: Number(Math.min(...hardIndex.map((s) => s.weight)).toFixed(2)),
    max: Number(Math.max(...hardIndex.map((s) => s.weight)).toFixed(2)),
  },
  confusionPairs: Object.entries(pairMetadata).slice(0, 20).map(([key, val]) => ({
    pair: key, trueLabel: val.trueLabel, predictedLabel: val.predictedLabel,
    confusionCount: val.confusionCount, samplesAvailable: val.trueSamplesAvailable + val.confuserSamplesAvailable,
  })),
  worstClasses: worstByF1.map((c) => ({
    label: c.label, f1: Number(c.f1.toFixed(4)), errorRate: Number(c.errorRate.toFixed(4)),
    samplesInHardSet: hardIndex.filter((s) => s.label === c.label).length,
  })),
};

ensureDir(HARD_DIR);
writeJson(path.join(HARD_DIR, "metadata.json"), metadata);
writeJson(path.join(HARD_DIR, "hard_index.json"), { entries: hardIndex });

const doc = `# Hard Sample Dataset Report

Generated: ${new Date().toISOString().split("T")[0]}

## Summary

- Total hard sample entries: ${hardIndex.length}
- Unique confusion pairs: ${Object.keys(pairMetadata).length}
- Unique hard labels: ${hardLabels.size}
- Weight range: ${metadata.weightRange.min}–${metadata.weightRange.max}

## Top Confusion Pairs

| True Label | Predicted | Confusions | Samples Available |
|------------|-----------|------------|------------------|
${metadata.confusionPairs.slice(0, 10).map((p) => `| ${p.trueLabel} | ${p.predictedLabel} | ${p.confusionCount} | ${p.samplesAvailable} |`).join("\n")}

## Worst Classes by F1

| Label | F1 | Error Rate | Hard Samples |
|-------|----|------------|-------------|
${metadata.worstClasses.slice(0, 10).map((c) => `| ${c.label} | ${(c.f1 * 100).toFixed(1)}% | ${(c.errorRate * 100).toFixed(1)}% | ${c.samplesInHardSet} |`).join("\n")}

## Usage

The hard sample index can be used for:
1. **Weighted sampling**: Higher weight = more frequent sampling
2. **Curriculum**: Inject after epoch 10-15
3. **Focused fine-tuning**: Train only on hard samples

## Output

\`\`\`
${HARD_DIR}/
  metadata.json
  hard_index.json (${hardIndex.length} entries)
\`\`\`
`;
fs.writeFileSync(path.join(DOCS_DIR, "hard-sample-dataset-report.md"), doc);

console.log("=== Hard Sample Set Built ===");
console.log(`Hard entries: ${hardIndex.length}`);
console.log(`Confusion pairs: ${Object.keys(pairMetadata).length}`);
console.log(`Weight range: ${metadata.weightRange.min}–${metadata.weightRange.max}`);
console.log(`Output: ${HARD_DIR}`);
