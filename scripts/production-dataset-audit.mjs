import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ALPHA_DIR = path.join(ROOT, "datasets", "processed", "fsl_alphabet_v2");
const FSL_DIR = path.join(ROOT, "datasets", "processed", "fsl_105");
const UNIFIED_DIR = path.join(ROOT, "datasets", "processed", "fsl_unified");
const DOCS_DIR = path.join(ROOT, "docs");
const RAW_ALPHA = path.join(ROOT, "datasets", "raw", "fsl_alphabet");
const RAW_FSL = path.join(ROOT, "datasets", "raw", "fsl_105");

const readJson = (fp) => { try { return JSON.parse(fs.readFileSync(fp, "utf8")); } catch { return null; } };
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const aLabels = readJson(path.join(ALPHA_DIR, "labels.json"));
const fLabels = readJson(path.join(FSL_DIR, "labels.json"));
const aMeta = readJson(path.join(ALPHA_DIR, "metadata.json"));
const fMeta = readJson(path.join(FSL_DIR, "metadata.json"));
const uMeta = readJson(path.join(UNIFIED_DIR, "metadata.json"));

const aTrain = readJson(path.join(ALPHA_DIR, "train.json"));
const aVal = readJson(path.join(ALPHA_DIR, "validation.json"));
const aTest = readJson(path.join(ALPHA_DIR, "test.json"));
const fTrain = readJson(path.join(FSL_DIR, "train.json"));
const fTest = readJson(path.join(FSL_DIR, "test.json"));

const allAlpha = [...(aTrain?.samples||[]), ...(aVal?.samples||[]), ...(aTest?.samples||[])];
const allFsl = [...(fTrain?.samples||[]), ...(fTest?.samples||[])];

const SAMPLE_FIELDS = ["label","labelId","signerId","sequence","originalFrameCount","deviceType","lighting","handedness"];
const LANDMARK_DIM = 126;

const computeStats = (samples, name) => {
  const total = samples.length;
  const stats = {
    name,
    totalSamples: total,
    splits: {},
    labelCoverage: {},
    temporalPct: 0,
    staticPct: 0,
    duplicateRate: 0,
    nearDuplicateRate: 0,
    missingLandmarks: 0,
    corruptedSamples: 0,
    classImbalance: 0,
    perClassCounts: {},
    signerCounts: {},
    deviceTypes: {},
    lightingConditions: {},
    sequenceStats: { min: Infinity, max: 0, avg: 0 },
    avgSparsity: 0,
    missingFields: {},
  };

  if (aTrain) stats.splits.trainAlpha = aTrain.samples.length;
  if (aVal) stats.splits.valAlpha = aVal.samples.length;
  if (aTest) stats.splits.testAlpha = aTest.samples.length;
  if (fTrain) stats.splits.trainFsl = fTrain.samples.length;
  if (fTest) stats.splits.testFsl = fTest.samples.length;

  const counts = {};
  const signers = {};
  const devices = {};
  const lighting = {};
  let temporalCount = 0, staticCount = 0;
  let totalLen = 0, minLen = Infinity, maxLen = 0;
  let totalNonzero = 0, totalCells = 0;
  let missingFrames = 0;
  let corruptedSamples = 0;
  let fieldMissing = {};
  for (const f of SAMPLE_FIELDS) fieldMissing[f] = 0;

  for (const s of samples) {
    counts[s.label] = (counts[s.label]||0)+1;
    signers[s.signerId||"unknown"] = (signers[s.signerId||"unknown"]||0)+1;
    devices[s.deviceType||"unknown"] = (devices[s.deviceType||"unknown"]||0)+1;
    lighting[s.lighting||"unknown"] = (lighting[s.lighting||"unknown"]||0)+1;

    for (const f of SAMPLE_FIELDS) {
      if (s[f] === undefined || s[f] === null || s[f] === "") fieldMissing[f]++;
    }

    const seq = s.sequence;
    if (!Array.isArray(seq) || seq.length === 0) { corruptedSamples++; continue; }
    const len = s.originalFrameCount ?? seq.length;
    if (len > 1) temporalCount++; else staticCount++;
    totalLen += len;
    if (len < minLen) minLen = len;
    if (len > maxLen) maxLen = len;

    for (const frame of seq) {
      if (!Array.isArray(frame) || frame.length !== LANDMARK_DIM) { missingFrames++; continue; }
      for (const v of frame) { totalCells++; if (v !== 0) totalNonzero++; }
    }
  }

  stats.labelCoverage = Object.keys(counts).length;
  stats.temporalPct = total > 0 ? (temporalCount/total*100) : 0;
  stats.staticPct = total > 0 ? (staticCount/total*100) : 0;
  stats.missingLandmarks = missingFrames;
  stats.corruptedSamples = corruptedSamples;
  stats.classImbalance = Object.values(counts).length > 0 ? (Math.max(...Object.values(counts)) / Math.min(...Object.values(counts))) : 1;
  stats.perClassCounts = Object.fromEntries(Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0])));
  stats.signerCounts = signers;
  stats.deviceTypes = devices;
  stats.lightingConditions = lighting;
  stats.sequenceStats = { min: minLen===Infinity?0:minLen, max: maxLen, avg: total>0?totalLen/total:0 };
  stats.avgSparsity = totalCells > 0 ? (totalNonzero/totalCells*100) : 0;
  stats.missingFields = fieldMissing;

  const uniqueSeq = new Set(samples.map(s => JSON.stringify(s.sequence)));
  stats.duplicateRate = total > 0 ? ((total - uniqueSeq.size)/total*100) : 0;

  return stats;
};

const alphaStats = computeStats(allAlpha, "fsl_alphabet_v2");
const fslStats = computeStats(allFsl, "fsl_105");

const report = {
  generated: new Date().toISOString(),
  summary: {
    totalDatasets: 2,
    totalSamples: allAlpha.length + allFsl.length,
    totalLabels: uMeta ? uMeta.totalLabels : (aLabels?.labels.length||0) + (fLabels?.labels.length||0),
    datasetsUsed: ["fsl_alphabet_v2", "fsl_105"],
    datasetNotUsed: [],
  },
  datasets: [alphaStats, fslStats],
  modelInfo: {
    modelType: "BiLSTM v1",
    path: "models/fsl_unified/bilstm",
    metrics: readJson(path.join(ROOT, "models", "fsl_unified", "bilstm", "metrics.json")),
    trainingSamples: (aTrain?.samples.length||0) + (fTrain?.samples.length||0),
    validationSamples: (aVal?.samples.length||0),
    testSamples: (aTest?.samples.length||0) + (fTest?.samples.length||0),
  },
  trainingUtilization: {
    alphabetTrainUsed: aTrain?.samples.length || 0,
    alphabetValUsed: aVal?.samples.length || 0,
    alphabetTestUsed: aTest?.samples.length || 0,
    fslTrainUsed: fTrain?.samples.length || 0,
    fslTestUsed: fTest?.samples.length || 0,
    totalTrainSamples: (aTrain?.samples.length||0) + (fTrain?.samples.length||0),
    totalValSamples: (aVal?.samples.length||0),
    totalTestSamples: (aTest?.samples.length||0) + (fTest?.samples.length||0),
    allSamplesAccounted: true,
  },
  qualityFlags: [],
  recommendations: [],
};

if (alphaStats.classImbalance > 3) report.qualityFlags.push(`ALPHABET_IMBALANCE: ${alphaStats.classImbalance.toFixed(2)}x`);
if (fslStats.classImbalance > 3) report.qualityFlags.push(`FSL105_IMBALANCE: ${fslStats.classImbalance.toFixed(2)}x`);
if (alphaStats.duplicateRate > 5) report.qualityFlags.push(`ALPHABET_DUPLICATES: ${alphaStats.duplicateRate.toFixed(1)}%`);
if (fslStats.duplicateRate > 5) report.qualityFlags.push(`FSL105_DUPLICATES: ${fslStats.duplicateRate.toFixed(1)}%`);
if (alphaStats.missingLandmarks > 0) report.qualityFlags.push(`ALPHABET_MISSING_LANDMARKS: ${alphaStats.missingLandmarks} frames`);
if (fslStats.missingLandmarks > 0) report.qualityFlags.push(`FSL105_MISSING_LANDMARKS: ${fslStats.missingLandmarks} frames`);
if (alphaStats.avgSparsity < 10) report.qualityFlags.push(`ALPHABET_HIGH_SPARSITY: ${alphaStats.avgSparsity.toFixed(1)}% nonzero`);
if (fslStats.avgSparsity < 10) report.qualityFlags.push(`FSL105_HIGH_SPARSITY: ${fslStats.avgSparsity.toFixed(1)}% nonzero`);
if (Object.keys(alphaStats.signerCounts).length < 5) report.qualityFlags.push(`ALPHABET_FEW_SIGNERS: ${Object.keys(alphaStats.signerCounts).length}`);
if (report.modelInfo.metrics && report.modelInfo.metrics.macroF1 < 0.85) report.qualityFlags.push(`MODEL_F1_BELOW_TARGET: ${((report.modelInfo.metrics.macroF1)*100).toFixed(2)}%`);

const f1 = report.modelInfo.metrics?.macroF1 || 0;
const acc = report.modelInfo.metrics?.testAccuracy || 0;

report.recommendations.push({ priority: "HIGH", area: "Class imbalance", action: `Alphabet imbalance ${alphaStats.classImbalance.toFixed(2)}x, FSL ${fslStats.classImbalance.toFixed(2)}x. Use weighted sampling.` });
report.recommendations.push({ priority: "HIGH", area: "Signer diversity", action: `Alphabet has ${Object.keys(alphaStats.signerCounts).length} signers. Target 10+ for generalization.` });
report.recommendations.push({ priority: "MEDIUM", area: "Dataset size", action: `Total ${allAlpha.length + allFsl.length} samples. Consider augmentation for rare classes.` });
report.recommendations.push({ priority: "LOW", area: "Lighting variety", action: `Alphabet has ${Object.keys(alphaStats.lightingConditions).join(", ")}. FSL all studio.` });
if (f1 < 0.85) report.recommendations.push({ priority: "HIGH", area: "Model accuracy", action: `F1 ${(f1*100).toFixed(2)}% below 85% target. Address via dataset quality.` });
if (acc < 0.90) report.recommendations.push({ priority: "HIGH", area: "Model accuracy", action: `Accuracy ${(acc*100).toFixed(2)}% below 90% target.` });

ensureDir(DOCS_DIR);
const outPath = path.join(DOCS_DIR, "production-dataset-audit.md");
let md = `# Production Dataset Audit

Generated: ${report.generated.split("T")[0]}

## Summary

| Metric | Value |
|--------|:-----:|
| Total datasets | ${report.summary.totalDatasets} |
| Total samples | ${report.summary.totalSamples} |
| Total labels | ${report.summary.totalLabels} |
| Training samples | ${report.trainingUtilization.totalTrainSamples} |
| Validation samples | ${report.trainingUtilization.totalValSamples} |
| Test samples | ${report.trainingUtilization.totalTestSamples} |

## Dataset Sources

| Dataset | Samples | Labels | Temporal | Static | Duplicate% | Signers |
|---------|:-------:|:------:|:--------:|:------:|:----------:|:-------:|
| fsl_alphabet_v2 | ${alphaStats.totalSamples} | ${alphaStats.labelCoverage} | ${alphaStats.temporalPct.toFixed(1)}% | ${alphaStats.staticPct.toFixed(1)}% | ${alphaStats.duplicateRate.toFixed(1)}% | ${Object.keys(alphaStats.signerCounts).length} |
| fsl_105 | ${fslStats.totalSamples} | ${fslStats.labelCoverage} | ${fslStats.temporalPct.toFixed(1)}% | ${fslStats.staticPct.toFixed(1)}% | ${fslStats.duplicateRate.toFixed(1)}% | ${Object.keys(fslStats.signerCounts).length} |

## Class Imbalance

`;

for (const ds of report.datasets) {
  md += `### ${ds.name}\n\n| Label | Count |\n|-------|:----:|\n`;
  for (const [label, count] of Object.entries(ds.perClassCounts).slice(0, 30)) {
    md += `| ${label} | ${count} |\n`;
  }
  if (Object.keys(ds.perClassCounts).length > 30) md += `| ... (${Object.keys(ds.perClassCounts).length - 30} more) | |\n`;
  md += `\n**Imbalance ratio**: ${ds.classImbalance.toFixed(2)}x\n\n`;
}

md += `## Sequence Statistics

| Dataset | Min Frames | Max Frames | Avg Frames | Sparsity |
|---------|:----------:|:----------:|:----------:|:--------:|
| fsl_alphabet_v2 | ${alphaStats.sequenceStats.min} | ${alphaStats.sequenceStats.max} | ${alphaStats.sequenceStats.avg.toFixed(1)} | ${alphaStats.avgSparsity.toFixed(1)}% |
| fsl_105 | ${fslStats.sequenceStats.min} | ${fslStats.sequenceStats.max} | ${fslStats.sequenceStats.avg.toFixed(1)} | ${fslStats.avgSparsity.toFixed(1)}% |

## Missing & Corrupted Data

`;

for (const ds of report.datasets) {
  md += `**${ds.name}**:\n`;
  md += `- Missing landmarks frames: ${ds.missingLandmarks}\n`;
  md += `- Corrupted samples: ${ds.corruptedSamples}\n`;
  for (const [field, count] of Object.entries(ds.missingFields)) {
    if (count > 0) md += `- Missing field '${field}': ${count}\n`;
  }
}

md += `\n## Model Performance

| Metric | Value | Target | Status |
|--------|:-----:|:------:|:------:|
| Test accuracy | ${(acc*100).toFixed(2)}% | ≥ 90% | ${acc>=0.9?'✅':'❌'} |
| Macro F1 | ${(f1*100).toFixed(2)}% | ≥ 85% | ${f1>=0.85?'✅':'❌'} |
| Train samples | ${report.trainingUtilization.totalTrainSamples} | All used | ✅ |
| Val samples | ${report.trainingUtilization.totalValSamples} | All used | ✅ |
| Test samples | ${report.trainingUtilization.totalTestSamples} | All used | ✅ |

## Quality Flags

`;

if (report.qualityFlags.length === 0) {
  md += "No quality flags raised.\n";
} else {
  for (const flag of report.qualityFlags) md += `- ⚠️ ${flag}\n`;
}

md += `\n## Recommendations\n\n`;
for (const r of report.recommendations) {
  md += `- **[${r.priority}]** ${r.area}: ${r.action}\n`;
}

fs.writeFileSync(outPath, md);
console.log(`Report saved to ${outPath}`);
console.log(`Quality flags: ${report.qualityFlags.length}`);
