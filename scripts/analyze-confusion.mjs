import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CONFUSION_PATH = path.join(ROOT, "models", "fsl_unified", "bilstm", "confusion_matrix.json");

const { labels, matrix } = JSON.parse(fs.readFileSync(CONFUSION_PATH, "utf8"));
const numClasses = labels.length;

const classNames = labels;

const confusion = matrix.map((row) => row.map((v) => (typeof v === "number" ? v : 0)));

const computeMetrics = () => {
  const perClass = [];
  for (let i = 0; i < numClasses; i++) {
    const tp = confusion[i][i];
    let fp = 0, fn = 0, support = 0;
    for (let j = 0; j < numClasses; j++) {
      if (j !== i) {
        fp += confusion[j][i];
        fn += confusion[i][j];
      }
      support += confusion[i][j];
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    perClass.push({ label: classNames[i], tp, fp, fn, support, precision, recall, f1, errors: fn });
  }
  return perClass;
};

const perClass = computeMetrics();

const sortedByF1 = [...perClass].sort((a, b) => a.f1 - b.f1);
const sortedByErrors = [...perClass].sort((a, b) => b.errors - a.errors);

const bottom10 = sortedByF1.slice(0, 10);
const top10F1 = sortedByF1.slice(-10).reverse();

const findTopConfusions = (topN = 20) => {
  const pairs = [];
  for (let i = 0; i < numClasses; i++) {
    for (let j = 0; j < numClasses; j++) {
      if (i !== j && confusion[i][j] > 0) {
        pairs.push({ trueLabel: classNames[i], predictedLabel: classNames[j], count: confusion[i][j] });
      }
    }
  }
  pairs.sort((a, b) => b.count - a.count);
  return pairs.slice(0, topN);
};

const topConfusions = findTopConfusions(20);

const labelGroups = () => {
  const alphabetSet = new Set();
  for (let i = 0; i < 28; i++) alphabetSet.add(classNames[i]);
  return {
    alphabetClassIndices: Array.from({ length: 28 }, (_, i) => i),
    fslClassIndices: Array.from({ length: 105 }, (_, i) => i + 28),
  };
};

const { alphabetClassIndices, fslClassIndices } = labelGroups();

const alphabetErrors = alphabetClassIndices.reduce((sum, i) => sum + perClass[i].errors, 0);
const fslErrors = fslClassIndices.reduce((sum, i) => sum + perClass[i].errors, 0);
const alphabetSamples = alphabetClassIndices.reduce((sum, i) => sum + confusion[i].reduce((a, b) => a + b, 0), 0);
const fslSamples = fslClassIndices.reduce((sum, i) => sum + confusion[i].reduce((a, b) => a + b, 0), 0);

const alphabetConfusionPairs = [];
for (const a of alphabetClassIndices) {
  for (const b of alphabetClassIndices) {
    if (a !== b && confusion[a][b] > 0) {
      alphabetConfusionPairs.push({ trueLabel: classNames[a], predicted: classNames[b], count: confusion[a][b] });
    }
  }
}
alphabetConfusionPairs.sort((a, b) => b.count - a.count);

const crossGroupConfusions = [];
for (const a of alphabetClassIndices) {
  for (const f of fslClassIndices) {
    if (confusion[a][f] > 0) crossGroupConfusions.push({ trueLabel: classNames[a], predicted: classNames[f], count: confusion[a][f], type: "alphabet->fsl" });
    if (confusion[f][a] > 0) crossGroupConfusions.push({ trueLabel: classNames[f], predicted: classNames[a], count: confusion[f][a], type: "fsl->alphabet" });
  }
}
crossGroupConfusions.sort((a, b) => b.count - a.count);

const report = {
  summary: {
    totalClasses: numClasses,
    overallAccuracy: perClass.reduce((sum, p) => sum + p.tp, 0) / perClass.reduce((sum, p) => sum + p.support, 0),
    macroF1: perClass.reduce((sum, p) => sum + p.f1, 0) / numClasses,
    totalTestSamples: perClass.reduce((sum, p) => sum + p.support, 0),
  },
  worstPerformingClasses: bottom10.map((p) => ({
    label: p.label,
    f1: Number(p.f1.toFixed(4)),
    precision: Number(p.precision.toFixed(4)),
    recall: Number(p.recall.toFixed(4)),
    errors: p.errors,
    support: p.support,
  })),
  bestPerformingClasses: top10F1.map((p) => ({
    label: p.label,
    f1: Number(p.f1.toFixed(4)),
    precision: Number(p.precision.toFixed(4)),
    recall: Number(p.recall.toFixed(4)),
    errors: p.errors,
    support: p.support,
  })),
  topConfusions: topConfusions.map((p) => ({
    trueLabel: p.trueLabel,
    predictedLabel: p.predictedLabel,
    count: p.count,
  })),
  crossGroupConfusions: crossGroupConfusions.slice(0, 10).map((p) => ({
    trueLabel: p.trueLabel,
    predictedLabel: p.predictedLabel,
    count: p.count,
    type: p.type,
  })),
  groupAnalysis: {
    alphabet: {
      errorRate: alphabetErrors / alphabetSamples,
      totalErrors: alphabetErrors,
      totalSamples: alphabetSamples,
      topInternalConfusions: alphabetConfusionPairs.slice(0, 10).map((p) => ({ trueLabel: p.trueLabel, predicted: p.predicted, count: p.count })),
    },
    fsl105: {
      errorRate: fslErrors / fslSamples,
      totalErrors: fslErrors,
      totalSamples: fslSamples,
    },
  },
  perLabelMetrics: perClass.map((p) => ({
    label: p.label,
    precision: Number(p.precision.toFixed(4)),
    recall: Number(p.recall.toFixed(4)),
    f1: Number(p.f1.toFixed(4)),
    support: p.support,
    errors: p.errors,
  })),
};

const outPath = path.join(ROOT, "models", "fsl_unified", "bilstm", "confusion_analysis.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log("=== Confusion Analysis ===");
console.log(`Test samples: ${report.summary.totalTestSamples}`);
console.log(`Accuracy: ${(report.summary.overallAccuracy * 100).toFixed(2)}%`);
console.log(`Macro F1: ${(report.summary.macroF1 * 100).toFixed(2)}%`);
console.log(`\nWorst 10 classes (by F1):`);
for (const c of report.worstPerformingClasses) {
  console.log(`  ${c.label.padEnd(20)} F1=${(c.f1 * 100).toFixed(1)}%  errors=${c.errors}/${c.support}`);
}
console.log(`\nTop 10 confusions:`);
for (const c of report.topConfusions.slice(0, 10)) {
  console.log(`  "${c.trueLabel}" → "${c.predictedLabel}" (${c.count}x)`);
}
console.log(`\nCross-group confusions:`);
for (const c of report.crossGroupConfusions) {
  console.log(`  [${c.type}] "${c.trueLabel}" → "${c.predictedLabel}" (${c.count}x)`);
}
console.log(`\nAlphabet error rate: ${(report.groupAnalysis.alphabet.errorRate * 100).toFixed(2)}%`);
console.log(`FSL-105 error rate: ${(report.groupAnalysis.fsl105.errorRate * 100).toFixed(2)}%`);
console.log(`\nAnalysis saved to ${outPath}`);
