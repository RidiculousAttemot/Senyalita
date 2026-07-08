import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const MODELS_DIR = path.join(ROOT, "models", "fsl_unified", "bilstm");

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));

const confusionPath = path.join(MODELS_DIR, "confusion_matrix.json");
const metricsPath = path.join(MODELS_DIR, "metrics.json");
const metaPath = path.join(ROOT, "datasets", "processed", "fsl_unified", "metadata.json");

const { labels, matrix } = readJson(confusionPath);
const metrics = readJson(metricsPath);
const unifiedMeta = readJson(metaPath);

const ALPHA_DIR = path.join(ROOT, "datasets", "processed", "fsl_alphabet_kaggle_v2");
const FSL_DIR = path.join(ROOT, "datasets", "processed", "fsl_105");

const alphaTrain = readJson(path.join(ALPHA_DIR, "train.json"));
const alphaTest = readJson(path.join(ALPHA_DIR, "test.json"));
const fslTrain = readJson(path.join(FSL_DIR, "train.json"));
const fslTest = readJson(path.join(FSL_DIR, "test.json"));

const numClasses = labels.length;
const confusion = matrix.map((row) => row.map((v) => (typeof v === "number" ? v : 0)));

const perClassMetrics = [];
for (let i = 0; i < numClasses; i++) {
  const tp = confusion[i][i];
  let fp = 0, fn = 0, support = 0;
  for (let j = 0; j < numClasses; j++) {
    if (j !== i) { fp += confusion[j][i]; fn += confusion[i][j]; }
    support += confusion[i][j];
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  perClassMetrics.push({ label: labels[i], index: i, tp, fp, fn, support, precision, recall, f1, errorRate: fn / support });
}

const worstClasses = [...perClassMetrics].sort((a, b) => a.f1 - b.f1).slice(0, 15);
const highErrorClasses = [...perClassMetrics].sort((a, b) => b.errorRate - a.errorRate).slice(0, 15);

const confusionPairs = [];
for (let i = 0; i < numClasses; i++) {
  for (let j = 0; j < numClasses; j++) {
    if (i !== j && confusion[i][j] > 0) {
      confusionPairs.push({ trueIdx: i, trueLabel: labels[i], predIdx: j, predLabel: labels[j], count: confusion[i][j] });
    }
  }
}
confusionPairs.sort((a, b) => b.count - a.count);

const hardTrainingPairs = confusionPairs.filter((p) => p.count >= 2);

const alphaCount = 28;

const findTrainingSamples = (samples, labelName) => {
  return samples.filter((s) => s.label === labelName);
};

const minedHardExamples = [];

for (const pair of hardTrainingPairs.slice(0, 30)) {
  let trueSamples = [];
  if (pair.trueIdx < alphaCount) {
    trueSamples = findTrainingSamples([...alphaTrain.samples, ...alphaTest.samples], pair.trueLabel);
  } else {
    trueSamples = findTrainingSamples([...fslTrain.samples, ...fslTest.samples], pair.trueLabel);
  }
  let confuserSamples = [];
  if (pair.predIdx < alphaCount) {
    confuserSamples = findTrainingSamples([...alphaTrain.samples, ...alphaTest.samples], pair.predLabel);
  } else {
    confuserSamples = findTrainingSamples([...fslTrain.samples, ...fslTest.samples], pair.predLabel);
  }

  minedHardExamples.push({
    trueLabel: pair.trueLabel,
    confusedWith: pair.predLabel,
    confusionCount: pair.count,
    trueSamplesAvailable: trueSamples.length,
    confuserSamplesAvailable: confuserSamples.length,
    pairId: `${pair.trueLabel}__VS__${pair.predLabel}`,
  });
}

const report = {
  summary: {
    worstPerClass: worstClasses.map((c) => ({ label: c.label, f1: Number(c.f1.toFixed(4)), errorRate: Number(c.errorRate.toFixed(4)), support: c.support })),
    highErrorClasses: highErrorClasses.map((c) => ({ label: c.label, errorRate: Number(c.errorRate.toFixed(4)), f1: Number(c.f1.toFixed(4)), support: c.support })),
    totalConfusionPairs: confusionPairs.length,
    hardPairs: hardTrainingPairs.length,
  },
  minedPairs: minedHardExamples,
  recommendations: {
    hardExampleMining: "Focus on the worst-performing classes and confusion pairs listed above. For each pair, augment both classes with contrasting frames.",
    targetedAugmentation: "Apply temporal cropping/masking to force the model to distinguish similar pairs.",
    curriculumStrategy: "Start training with easy examples (high confidence correct), gradually introduce hard examples after epoch 10-15.",
  },
};

const outPath = path.join(MODELS_DIR, "hard_examples.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log("=== Hard Example Mining ===");
console.log(`Worst classes (by F1):`);
for (const c of report.summary.worstPerClass.slice(0, 10)) {
  console.log(`  ${c.label.padEnd(20)} F1=${(c.f1 * 100).toFixed(1)}% errors=${(c.errorRate * 100).toFixed(1)}%`);
}
console.log(`\nTop confusion pairs:`);
for (const p of minedHardExamples.slice(0, 10)) {
  console.log(`  "${p.trueLabel}" ↔ "${p.confusedWith}" (${p.confusionCount}x)`);
}
console.log(`\nSaved to ${outPath}`);
