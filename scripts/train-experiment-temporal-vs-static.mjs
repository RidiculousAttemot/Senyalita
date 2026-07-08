import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const readJson = (fp) => { try { return JSON.parse(fs.readFileSync(fp, "utf8")); } catch { return null; } };

const ALPHA_V2 = "datasets/processed/fsl_alphabet_kaggle_v2";
const FSL_105 = "datasets/processed/fsl_105";

const experiments = [
  {
    name: "Model A — Temporal Only",
    id: "temporal-only",
    description: "FSL-105 only (105 temporal phrase classes, no alphabet static data)",
    datasets: [FSL_105],
    labelSource: FSL_105,
    config: { epochs: 60, hiddenSize: 48, dropout: 0.25, lr: 0.002, temporalSteps: 35 },
  },
  {
    name: "Model B — Alphabet Only (Static-derived)",
    id: "alphabet-only",
    description: "fsl_alphabet_kaggle_v2 only (28 alphabet classes, static frame sequences)",
    datasets: [ALPHA_V2],
    labelSource: ALPHA_V2,
    config: { epochs: 60, hiddenSize: 32, dropout: 0.2, lr: 0.002, temporalSteps: 30 },
  },
  {
    name: "Model C — Hybrid (Current Unified)",
    id: "hybrid",
    description: "fsl_alphabet_kaggle_v2 + fsl_105 combined (133 classes, current production approach)",
    datasets: [ALPHA_V2, FSL_105],
    labelSource: null,
    config: { epochs: 80, hiddenSize: 48, dropout: 0.25, lr: 0.002, temporalSteps: 35 },
  },
];

const computeStats = (dsPaths) => {
  let totalSamples = 0, totalTemporal = 0, totalClasses = 0;
  const classSet = new Set();
  const sampleOrigins = {};
  for (const dp of dsPaths) {
    const full = path.join(ROOT, dp);
    const meta = readJson(path.join(full, "metadata.json"));
    const labels = readJson(path.join(full, "labels.json"));
    const train = readJson(path.join(full, "train.json"));
    const test = readJson(path.join(full, "test.json"));
    if (meta?.sampleCountsByLabel) {
      for (const [label, count] of Object.entries(meta.sampleCountsByLabel)) {
        classSet.add(label);
        totalSamples += count;
      }
    }
    if (labels?.labels) {
      for (const l of labels.labels) classSet.add(l);
      totalClasses = labels.labels.length;
    }
    if (train?.samples) {
      totalSamples += train.samples.length;
      for (const s of train.samples) {
        totalTemporal += (s.originalFrameCount || s.sequence?.length || 0) > 1 ? 1 : 0;
        sampleOrigins[dp] = (sampleOrigins[dp] || 0) + 1;
      }
    }
    if (test?.samples) {
      totalSamples += test.samples.length;
      for (const s of test.samples) {
        totalTemporal += (s.originalFrameCount || s.sequence?.length || 0) > 1 ? 1 : 0;
      }
    }
  }
  return { totalSamples, totalTemporal, totalClasses: classSet.size, classCount: classSet.size, sampleOrigins };
};

const currentMetrics = readJson(path.join(ROOT, "models/fsl_unified/bilstm/metrics.json"));
const v2Metrics = readJson(path.join(ROOT, "models/fsl_unified/bilstm_v2/metrics.json"));

const results = experiments.map((exp) => {
  const stats = computeStats(exp.datasets);
  return {
    experiment: exp.name,
    id: exp.id,
    description: exp.description,
    datasetStats: {
      totalSamples: stats.totalSamples,
      totalClasses: stats.totalClasses,
      temporalRatio: stats.totalSamples > 0 ? stats.totalTemporal / stats.totalSamples : 0,
      datasets: exp.datasets,
    },
    config: exp.config,
    status: "planned",
    metrics: exp.id === "hybrid" && currentMetrics ? {
      testAccuracy: currentMetrics.testAccuracy,
      macroF1: currentMetrics.macroF1,
      weightedF1: currentMetrics.weightedF1,
    } : null,
  };
});

const reportContent = `# Temporal vs Static Study

Generated: ${new Date().toISOString().split("T")[0]}

## Overview

Three controlled experiments to determine whether static (alphabet) data helps or hurts temporal
(phrase) recognition in the unified model.

## Experiment Design

### Model A — Temporal Only

Uses only FSL-105 phrase data (105 classes). Excludes all alphabet static-image-derived samples.

| Property | Value |
|----------|-------|
| Datasets | fsl_105 |
| Classes | 105 |
| Samples | ~2129 |
| Temporal ratio | 100% |

### Model B — Alphabet Only

Uses only fsl_alphabet_kaggle_v2 (28 classes). Tests whether alphabet-level features are learned
effectively from static-derived single-frame data.

| Property | Value |
|----------|-------|
| Datasets | fsl_alphabet_kaggle_v2 |
| Classes | 28 |
| Samples | ~3592 |
| Temporal ratio | 100% (video-derived sequences) |

### Model C — Hybrid (Current Unified)

Uses both datasets combined (133 classes). This is the current production approach.

| Property | Value |
|----------|-------|
| Datasets | fsl_alphabet_kaggle_v2 + fsl_105 |
| Classes | 133 |
| Samples | ~5721 |
| Temporal ratio | 100% |

## Current Best Metrics

| Model | Accuracy | Macro F1 | Weighted F1 |
|-------|:--------:|:--------:|:-----------:|
| Current production (unified v1) | ${(currentMetrics?.testAccuracy * 100)?.toFixed(2) ?? "N/A"}% | ${(currentMetrics?.macroF1 * 100)?.toFixed(2) ?? "N/A"}% | ${(currentMetrics?.weightedF1 * 100)?.toFixed(2) ?? "N/A"}% |
| ${v2Metrics ? `BiLSTM v2` : "BiLSTM v2"} | ${v2Metrics ? `${(v2Metrics.testAccuracy * 100).toFixed(2)}%` : "N/A"} | ${v2Metrics ? `${(v2Metrics.macroF1 * 100).toFixed(2)}%` : "N/A"} | ${v2Metrics ? `${(v2Metrics.weightedF1 * 100).toFixed(2)}%` : "N/A"} |

## How to Run

\`\`\`
# Model A — Temporal only
node scripts/train-fsl-105-bilstm.mjs

# Model B — Alphabet only
node scripts/train-fsl-alphabet-bilstm-v2.mjs

# Model C — Hybrid (unified)
node scripts/merge-unified-datasets-v3.mjs
node scripts/train-unified-bilstm-v2.mjs
\`\`\`

## Analysis Notes

- All three models use the same underlying BiLSTM architecture
- Alphabet data is NOT truly "static" — it contains 120-frame temporal sequences extracted from video
- The distinction is that alphabet data has minimal motion (single letter hand shapes) vs phrases
  which have complex motion trajectories
- Expected: Model C (hybrid) will outperform both A and B due to larger training set
- Key question: Does adding alphabet data degrade phrase recognition accuracy?
  → Compare phrase-level accuracy between Model A and Model C

## Dataset Truth

| Dataset | Samples | Classes | Temporal | Static | Used By |
|---------|---------|---------|----------|--------|---------|
| fsl_alphabet_kaggle_v2 | ${(() => { const m = readJson(path.join(ROOT, ALPHA_V2, "metadata.json")); return m?.totalSamples ?? "?"; })()} | 28 | 100% | 0% | Models B, C |
| fsl_105 | ${(() => { const m = readJson(path.join(ROOT, FSL_105, "metadata.json")); return m?.totalSamples ?? "?"; })()} | 105 | 100% | 0% | Models A, C |
`;

ensureDir(DOCS_DIR);
fs.writeFileSync(path.join(DOCS_DIR, "temporal-vs-static-study.md"), reportContent);

console.log("=== Temporal vs Static Experiment Plan ===");
for (const r of results) {
  console.log(`  ${r.id}: ${r.datasetStats.totalSamples} samples, ${r.datasetStats.totalClasses} classes, ${(r.datasetStats.temporalRatio * 100).toFixed(0)}% temporal`);
}
console.log(`Report: docs/temporal-vs-static-study.md`);
