#!/usr/bin/env node
import fs from "fs";
import path from "path";

const EXISTING_DIRS = [
  { dir: path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_kaggle_v2"), prefix: "alphabet_v2_", labelOffset: 0 },
  { dir: path.join(process.cwd(), "datasets", "processed", "fsl_105"), prefix: "fsl105_", labelOffset: 28 },
  { dir: path.join(process.cwd(), "datasets", "processed", "fsl_unified"), prefix: "unified_v1_", labelOffset: 0 },
];
const V45_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_v45");
const OUT_DIR = path.join(process.cwd(), "datasets", "processed", "unified_v2");
const DOCS_DIR = path.join(process.cwd(), "docs");

const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const shuffle = (arr, seed = 2026) => {
  const a = [...arr];
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const buildLabelMap = () => {
  const map = {};
  let nextId = 0;

  const alphabetLabels = readJson(path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_kaggle_v2", "labels.json"));
  if (alphabetLabels) {
    for (const l of alphabetLabels.labels) { if (!(l in map)) map[l] = nextId++; }
  }

  const fslLabels = readJson(path.join(process.cwd(), "datasets", "processed", "fsl_105", "labels.json"));
  if (fslLabels) {
    for (const l of fslLabels.labels) { if (!(l in map)) map[l] = nextId++; }
  }

  const v45Labels = readJson(path.join(V45_DIR, "labels.json"));
  if (v45Labels) {
    for (const l of v45Labels.labels) { if (!(l in map)) map[l] = nextId++; }
  }

  return { map, labels: Object.entries(map).sort(([, a], [, b]) => a - b).map(([l]) => l) };
};

const loadSamples = (dir, labelMap) => {
  if (!fs.existsSync(dir)) return { samples: [], source: path.basename(dir) };
  const labelsMeta = readJson(path.join(dir, "labels.json"));
  if (!labelsMeta) return { samples: [], source: path.basename(dir) };
  const prefix = path.basename(dir);
  let all = [];
  for (const split of ["train", "validation", "test"]) {
    const data = readJson(path.join(dir, `${split}.json`));
    if (!data || !data.samples) continue;
    const remapped = data.samples.map((s) => ({
      ...s,
      label: s.label,
      labelId: labelMap[s.label] ?? s.labelId,
      sourceSplit: split,
      source: prefix,
      uid: `${prefix}_${split}_${all.length}`
    }));
    all = all.concat(remapped);
  }
  return { samples: all, source: prefix };
};

const computeCoverage = (samples, totalLabels) => {
  const covered = new Set(samples.map((s) => s.label));
  const perLabel = {};
  for (const s of samples) {
    if (!perLabel[s.label]) perLabel[s.label] = { count: 0, sources: new Set() };
    perLabel[s.label].count++;
    perLabel[s.label].sources.add(s.source);
  }
  const sorted = Object.entries(perLabel).sort(([, a], [, b]) => b.count - a.count);
  return {
    totalSamples: samples.length,
    coveredLabels: covered.size,
    totalLabels,
    coverageRate: totalLabels > 0 ? covered.size / totalLabels : 0,
    perLabel: sorted.map(([label, info]) => ({ label, count: info.count, sources: [...info.sources] })),
  };
};

const writeMergeReport = (v45Coverage, existingCoverage, mergedCoverage, labelMap) => {
  ensureDir(DOCS_DIR);
  const labels = labelMap.labels;

  const report = `# Unified Dataset v2 — Merge Report

Generated: ${new Date().toISOString().split("T")[0]}

## Overview

| Metric | Existing (v1) | FSL v4.5 | Unified v2 |
|--------|--------------|----------|------------|
| Total Samples | ${existingCoverage.totalSamples} | ${v45Coverage.totalSamples} | ${mergedCoverage.totalSamples} |
| Covered Labels | ${existingCoverage.coveredLabels} | ${v45Coverage.coveredLabels} | ${mergedCoverage.coveredLabels} |
| Total Labels | ${labelMap.labels.length} | ${labelMap.labels.length} | ${labelMap.labels.length} |
| Coverage Rate | ${(existingCoverage.coverageRate * 100).toFixed(1)}% | ${(v45Coverage.coverageRate * 100).toFixed(1)}% | ${(mergedCoverage.coverageRate * 100).toFixed(1)}% |

## Label Coverage Detail

| Label | V1 Samples | V4.5 Samples | Total |
|-------|-----------|-------------|-------|
${labels.map((l) => {
  const v1 = existingCoverage.perLabel.find((p) => p.label === l);
  const v45 = v45Coverage.perLabel.find((p) => p.label === l);
  const v1Count = v1?.count ?? 0;
  const v45Count = v45?.count ?? 0;
  return `| ${l} | ${v1Count} | ${v45Count} | ${v1Count + v45Count} |`;
}).join("\n")}

## Samples Added by v4.5

- **New samples**: ${v45Coverage.totalSamples}
- **New labels exclusively from v4.5**: ${labels.filter((l) => !existingCoverage.perLabel.find((p) => p.label === l)).length}
- **Overlapping labels**: ${labels.filter((l) => existingCoverage.perLabel.find((p) => p.label === l) && v45Coverage.perLabel.find((p) => p.label === l)).length}

## Data Quality

- v4.5 provides additional diversity across ${v45Coverage.coveredLabels} labels
- Existing v1 covers ${existingCoverage.coveredLabels} labels
- Combined coverage: **${(mergedCoverage.coverageRate * 100).toFixed(1)}%**

## Recommendations

- Proceed with model retraining using unified_v2 dataset
- Use 70/15/15 train/val/test split on combined data
- Consider weighted sampling for imbalanced classes
- Evaluate with cross-validation for robustness
`;
  fs.writeFileSync(path.join(DOCS_DIR, "unified-dataset-v2-report.md"), report);
  console.log("Merge report written to docs/unified-dataset-v2-report.md");
};

const main = () => {
  console.log("Unified Dataset v2 — Merge");
  console.log("=".repeat(55));

  ensureDir(OUT_DIR);

  const labelMap = buildLabelMap();
  console.log(`Total labels in unified space: ${labelMap.labels.length}`);

  const existing = loadSamples(EXISTING_DIRS[0].dir, labelMap.map);
  const fsl105 = loadSamples(EXISTING_DIRS[1].dir, labelMap.map);
  const v45 = loadSamples(V45_DIR, labelMap.map);

  const existingAll = [...existing.samples, ...fsl105.samples];
  const existingCoverage = computeCoverage(existingAll, labelMap.labels.length);
  const v45Coverage = computeCoverage(v45.samples, labelMap.labels.length);

  const merged = shuffle([...existingAll, ...v45.samples], 2026);
  const mergedCoverage = computeCoverage(merged, labelMap.labels.length);

  console.log(`Existing v1 samples: ${existingCoverage.totalSamples}`);
  console.log(`v4.5 samples: ${v45Coverage.totalSamples}`);
  console.log(`Merged total: ${mergedCoverage.totalSamples}`);

  const valCount = Math.floor(merged.length * 0.15);
  const testCount = Math.floor(merged.length * 0.15);
  const trainCount = merged.length - valCount - testCount;

  const trainSet = { samples: merged.slice(0, trainCount), labels: labelMap.labels };
  const valSet = { samples: merged.slice(trainCount, trainCount + valCount), labels: labelMap.labels };
  const testSet = { samples: merged.slice(trainCount + valCount), labels: labelMap.labels };

  const metadata = {
    totalLabels: labelMap.labels.length,
    totalSamples: merged.length,
    splits: {
      train: { samples: trainSet.samples.length, percent: ((trainCount / merged.length) * 100).toFixed(1) },
      validation: { samples: valSet.samples.length, percent: ((valCount / merged.length) * 100).toFixed(1) },
      test: { samples: testSet.samples.length, percent: ((testCount / merged.length) * 100).toFixed(1) },
    },
    sources: { existing_v1: existingAll.length, fsl_v45: v45.samples.length },
    featureDimension: 126,
    sequenceLength: 120,
    temporalSteps: 30,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(OUT_DIR, "labels.json"), JSON.stringify({ labels: labelMap.labels }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "train.json"), JSON.stringify(trainSet, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "validation.json"), JSON.stringify(valSet, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "test.json"), JSON.stringify(testSet, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "metadata.json"), JSON.stringify(metadata, null, 2));

  writeMergeReport(v45Coverage, existingCoverage, mergedCoverage, labelMap);

  console.log(`\nMerge complete. Output: ${OUT_DIR}`);
  console.log(`  Train: ${trainSet.samples.length}`);
  console.log(`  Validation: ${valSet.samples.length}`);
  console.log(`  Test: ${testSet.samples.length}`);
  console.log(`  Labels: ${labelMap.labels.length}`);
};

main();
