import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const MODEL_DIR = path.join(ROOT, "models", "fsl_unified", "bilstm");
const HARD_DIR = path.join(ROOT, "datasets", "hard_cases");
const DOCS_DIR = path.join(ROOT, "docs");
const ALPHA_DIR = path.join(ROOT, "datasets", "processed", "fsl_alphabet_v2");
const FSL_DIR = path.join(ROOT, "datasets", "processed", "fsl_105");

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const confusionData = readJson(path.join(MODEL_DIR, "confusion_matrix.json"));
const labels = confusionData.labels;
const matrix = confusionData.matrix;

const aLabels = readJson(path.join(ALPHA_DIR, "labels.json"));
const fLabels = readJson(path.join(FSL_DIR, "labels.json"));
const aTrain = readJson(path.join(ALPHA_DIR, "train.json"));
const aTest = readJson(path.join(ALPHA_DIR, "test.json"));
const fTrain = readJson(path.join(FSL_DIR, "train.json"));
const fTest = readJson(path.join(FSL_DIR, "test.json"));

const ac = aLabels.labels.length;
const remapFsl = (s) => s.map(x => ({...x, labelId: x.labelId + ac}));
const allTrain = [...aTrain.samples, ...remapFsl(fTrain.samples)];

// Per-class metrics
const perClass = [];
for (let i = 0; i < labels.length; i++) {
  const tp = matrix[i][i]; let fp = 0, fn = 0, sup = 0;
  for (let j = 0; j < labels.length; j++) {
    if (j !== i) { fp += matrix[j][i]; fn += matrix[i][j]; }
    sup += matrix[i][j];
  }
  const p = tp+fp===0?0:tp/(tp+fp);
  const r = tp+fn===0?0:tp/(tp+fn);
  const f1 = p+r===0?0:2*p*r/(p+r);
  perClass.push({ label: labels[i], index: i, tp, fp, fn, sup, precision: p, recall: r, f1, errorRate: sup>0?fn/sup:0 });
}

// Confusion pairs
const pairs = [];
for (let i = 0; i < labels.length; i++) {
  for (let j = 0; j < labels.length; j++) {
    if (i !== j && matrix[i][j] > 0) {
      pairs.push({ trueIdx: i, predIdx: j, trueLabel: labels[i], predLabel: labels[j], count: matrix[i][j] });
    }
  }
}
pairs.sort((a,b) => b.count - a.count);

// Hard cases dataset
const TARGET_PAIRS = [
  { trueLabel: "m", predLabel: "n" },
  { trueLabel: "n", predLabel: "m" },
  { trueLabel: "d", predLabel: "p" },
  { trueLabel: "p", predLabel: "d" },
  { trueLabel: "p", predLabel: "q" },
  { trueLabel: "q", predLabel: "p" },
  { trueLabel: "v", predLabel: "u" },
  { trueLabel: "u", predLabel: "r" },
  { trueLabel: "GOOD EVENING", predLabel: "GOOD AFTERNOON" },
  { trueLabel: "IM FINE", predLabel: "HELLO" },
];

const hardCases = { samples: [], metadata: { pairs: {} } };
for (const target of TARGET_PAIRS) {
  const trueSamples = allTrain.filter(s => s.label === target.trueLabel);
  const pairKey = `${target.trueLabel}__VS__${target.predLabel}`;
  for (const s of trueSamples) {
    hardCases.samples.push({ ...s, confusionPair: pairKey, confusionType: "true_class" });
  }
  const found = pairs.find(p => p.trueLabel === target.trueLabel && p.predLabel === target.predLabel);
  hardCases.metadata.pairs[pairKey] = {
    trueLabel: target.trueLabel, predLabel: target.predLabel,
    confusionCount: found?.count||0, samplesAdded: trueSamples.length,
  };
}

ensureDir(HARD_DIR);
fs.writeFileSync(path.join(HARD_DIR, "hard_cases.json"), JSON.stringify(hardCases));
fs.writeFileSync(path.join(HARD_DIR, "metadata.json"), JSON.stringify(hardCases.metadata, null, 2));

const worst5 = perClass.sort((a,b)=>a.f1-b.f1).slice(0, 5);
const top10pairs = pairs.slice(0, 10);
const phraseConfusions = pairs.filter(p => p.trueLabel.includes(" ") && p.count > 0).sort((a,b)=>b.count-a.count).slice(0, 10);
const alphabetConfusions = pairs.filter(p => !p.trueLabel.includes(" ") && p.trueLabel.length <= 2 && p.count > 0).sort((a,b)=>b.count-a.count).slice(0, 10);

const doc = `# Hard Case Analysis

Generated: ${new Date().toISOString().split("T")[0]}

## Objective

Identify systematic misclassifications and build targeted training subsets for the most confused label pairs.

## Worst Classes by F1 Score

| Label | Precision | Recall | F1 | Errors | Support |
|-------|:---------:|:------:|:--:|:------:|:-------:|
${worst5.map(c => `| ${c.label} | ${(c.precision*100).toFixed(1)}% | ${(c.recall*100).toFixed(1)}% | ${(c.f1*100).toFixed(1)}% | ${c.fn} | ${c.sup} |`).join("\n")}

## Top 10 Confusion Pairs (Overall)

| True Label | Predicted | Count |
|------------|-----------|:-----:|
${top10pairs.map(p => `| ${p.trueLabel} | ${p.predLabel} | ${p.count} |`).join("\n")}

## Alphabet Confusion Pairs (m, n, d, p, q)

| True Label | Predicted | Count |
|------------|-----------|:-----:|
${alphabetConfusions.slice(0, 15).map(p => `| ${p.trueLabel} | ${p.predLabel} | ${p.count} |`).join("\n")}

## Phrase Confusion Pairs

| True Label | Predicted | Count |
|------------|-----------|:-----:|
${phraseConfusions.map(p => `| ${p.trueLabel} | ${p.predLabel} | ${p.count} |`).join("\n")}

## Low-Confidence Phrases

The following phrases have the highest misclassification rates:

${perClass.filter(c => c.label.includes(" ")).sort((a,b)=>b.errorRate-a.errorRate).slice(0, 10).map(c => `- **${c.label}**: ${(c.errorRate*100).toFixed(1)}% error rate (${c.fn} errors out of ${c.sup} samples)`).join("\n")}

## Targeted Hard Case Subset

Created: \`datasets/hard_cases/\`

Contains focused training subsets for the most problematic pairs:
${TARGET_PAIRS.map(t => `- ${t.trueLabel} ↔ ${t.predLabel}`).join("\n")}

${hardCases.samples.length} total hard case samples collected.

## Methodology

1. Extract confusion matrix from deployed v1 model
2. Rank pairs by confusion count
3. Identify top alphabet confusions (m↔n, d↔p, p↔q)
4. Identify top phrase confusions (similar greetings, low-confidence signs)
5. Collect all available samples for these label pairs
6. Store in \`datasets/hard_cases/\` for targeted fine-tuning
`;

fs.writeFileSync(path.join(DOCS_DIR, "hard-case-analysis.md"), doc);
console.log(`Hard case analysis saved to ${DOCS_DIR}`);
console.log(`Top pair: ${pairs[0].trueLabel}↔${pairs[0].predLabel} (${pairs[0].count})`);
console.log(`Hard cases dataset: ${hardCases.samples.length} samples`);
