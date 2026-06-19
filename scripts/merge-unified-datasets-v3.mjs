#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ALPHABET_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_v2");
const FSL105_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_105");
const V45_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_v45");
const ROBOFLOW_DIR = path.join(process.cwd(), "datasets", "processed", "roboflow");
const OUT_DIR = path.join(process.cwd(), "datasets", "processed", "unified_v3");
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

  const alphabetLabels = readJson(path.join(ALPHABET_DIR, "labels.json"));
  if (alphabetLabels) {
    const labels = alphabetLabels.labels ?? [];
    for (const l of labels) { if (!(l in map)) map[l] = nextId++; }
  }

  const fslLabels = readJson(path.join(FSL105_DIR, "labels.json"));
  if (fslLabels) {
    const labels = fslLabels.labels ?? [];
    for (const l of labels) { if (!(l in map)) map[l] = nextId++; }
  }

  const v45Labels = readJson(path.join(V45_DIR, "labels.json"));
  if (v45Labels) {
    const labels = v45Labels.labels ?? [];
    for (const l of labels) { if (!(l in map)) map[l] = nextId++; }
  }

  const roboflowLabels = readJson(path.join(ROBOFLOW_DIR, "labels.json"));
  if (roboflowLabels) {
    const labels = roboflowLabels.labels ?? [];
    for (const l of labels) { if (!(l in map)) map[l] = nextId++; }
  }

  return { map, labels: Object.entries(map).sort(([, a], [, b]) => a - b).map(([l]) => l) };
};

const loadSamples = (dir, labelMap) => {
  if (!fs.existsSync(dir)) return { samples: [], source: path.basename(dir) };
  const labelsMeta = readJson(path.join(dir, "labels.json"));
  if (!labelsMeta) return { samples: [], source: path.basename(dir) };
  const source = path.basename(dir);
  let all = [];
  for (const split of ["train", "validation", "test"]) {
    const data = readJson(path.join(dir, `${split}.json`));
    if (!data || !data.samples) continue;
    const remapped = data.samples.map((s) => ({
      ...s,
      label: s.label,
      labelId: labelMap[s.label] ?? s.labelId,
      sourceSplit: split,
      source,
      uid: `${source}_${split}_${all.length}`
    }));
    all = all.concat(remapped);
  }
  return { samples: all, source };
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

const writeMergeReport = (coverageReports, labelMap) => {
  ensureDir(DOCS_DIR);
  const labels = labelMap.labels;

  const report = `# Unified Dataset v3 — Merge Report

Generated: ${new Date().toISOString().split("T")[0]}

## Overview

| Metric | Existing (v1) | FSL v45 | Roboflow | Unified v3 |
|--------|--------------|---------|----------|------------|
| Total Samples | ${coverageReports.existing.totalSamples} | ${coverageReports.v45.totalSamples} | ${coverageReports.roboflow.totalSamples} | ${coverageReports.merged.totalSamples} |
| Covered Labels | ${coverageReports.existing.coveredLabels} | ${coverageReports.v45.coveredLabels} | ${coverageReports.roboflow.coveredLabels} | ${coverageReports.merged.coveredLabels} |
| Total Labels | ${labelMap.labels.length} | ${labelMap.labels.length} | ${labelMap.labels.length} | ${labelMap.labels.length} |
| Coverage Rate | ${(coverageReports.existing.coverageRate * 100).toFixed(1)}% | ${(coverageReports.v45.coverageRate * 100).toFixed(1)}% | ${(coverageReports.roboflow.coverageRate * 100).toFixed(1)}% | ${(coverageReports.merged.coverageRate * 100).toFixed(1)}% |

## Label Coverage Detail

| Label | Existing | FSL v45 | Roboflow | Total |
|-------|---------|---------|----------|-------|
${labels.map((l) => {
  const existingCov = coverageReports.existing.perLabel.find((p) => p.label === l);
  const v45Cov = coverageReports.v45.perLabel.find((p) => p.label === l);
  const roboflowCov = coverageReports.roboflow.perLabel.find((p) => p.label === l);
  const existingCount = existingCov?.count ?? 0;
  const v45Count = v45Cov?.count ?? 0;
  const roboflowCount = roboflowCov?.count ?? 0;
  return `| ${l} | ${existingCount} | ${v45Count} | ${roboflowCount} | ${existingCount + v45Count + roboflowCount} |`;
}).join("\n")}

## New Labels from Roboflow

The following labels are NEW and not present in existing datasets:
${coverageReports.roboflow.perLabel
  .filter((p) => !coverageReports.existing.perLabel.find((e) => e.label === p.label))
  .map((p) => `- **${p.label}**: ${p.count} samples`)
  .join("\n") || "None — all roboflow labels already exist in the unified space."}

## Sample Contributors

| Source | Samples |
|--------|---------|
| Existing (alphabet_v2 + fsl_105) | ${coverageReports.existing.totalSamples} |
| FSL v45 | ${coverageReports.v45.totalSamples} |
| Roboflow | ${coverageReports.roboflow.totalSamples} |
| **Total** | **${coverageReports.merged.totalSamples}** |

## Data Quality

- Existing dataset provides ${coverageReports.existing.coveredLabels} labels
- Roboflow adds ${coverageReports.roboflow.perLabel.filter((p) => !coverageReports.existing.perLabel.find((e) => e.label === p.label)).length} new labels
- FSL v45 adds ${coverageReports.v45.coveredLabels - coverageReports.existing.coveredLabels} additional labels
- Combined coverage: **${(coverageReports.merged.coverageRate * 100).toFixed(1)}%**

## Recommendations

- Proceed with model retraining using unified_v3 dataset
- Use 70/15/15 train/val/test split on combined data
- Consider weighted sampling for imbalanced classes (especially new roboflow labels with fewer samples)
- Evaluate with cross-validation for robustness
`;
  const reportPath = path.join(DOCS_DIR, "unified-dataset-v3-report.md");
  fs.writeFileSync(reportPath, report);
  console.log(`Merge report written to ${reportPath}`);
};

const main = () => {
  console.log("Unified Dataset v3 — Merge (Alphabet + FSL-105 + v4.5 + Roboflow)");
  console.log("=".repeat(70));

  ensureDir(OUT_DIR);

  const labelMap = buildLabelMap();
  console.log(`Total labels in unified space: ${labelMap.labels.length}`);

  const alphabetSamples = loadSamples(ALPHABET_DIR, labelMap.map);
  const fslSamples = loadSamples(FSL105_DIR, labelMap.map);
  const v45Samples = loadSamples(V45_DIR, labelMap.map);
  const roboflowSamples = loadSamples(ROBOFLOW_DIR, labelMap.map);

  console.log(`  Alphabet v2: ${alphabetSamples.samples.length} samples`);
  console.log(`  FSL-105: ${fslSamples.samples.length} samples`);
  console.log(`  FSL v45: ${v45Samples.samples.length} samples`);
  console.log(`  Roboflow: ${roboflowSamples.samples.length} samples`);

  const existingAll = [...alphabetSamples.samples, ...fslSamples.samples];
  const existingCoverage = computeCoverage(existingAll, labelMap.labels.length);
  const v45Coverage = computeCoverage(v45Samples.samples, labelMap.labels.length);
  const roboflowCoverage = computeCoverage(roboflowSamples.samples, labelMap.labels.length);

  const merged = shuffle([...existingAll, ...v45Samples.samples, ...roboflowSamples.samples], 2026);
  const mergedCoverage = computeCoverage(merged, labelMap.labels.length);

  console.log(`\nExisting v1 samples: ${existingCoverage.totalSamples}`);
  console.log(`FSL v45 samples: ${v45Coverage.totalSamples}`);
  console.log(`Roboflow samples: ${roboflowCoverage.totalSamples}`);
  console.log(`Merged total: ${mergedCoverage.totalSamples}`);

  const valCount = Math.floor(merged.length * 0.15);
  const testCount = Math.floor(merged.length * 0.15);
  const trainCount = merged.length - valCount - testCount;

  const trainSet = { samples: merged.slice(0, trainCount), labels: labelMap.labels };
  const valSet = { samples: merged.slice(trainCount, trainCount + valCount), labels: labelMap.labels };
  const testSet = { samples: merged.slice(trainCount + valCount), labels: labelMap.labels };

  const sources = {
    alphabet_v2: alphabetSamples.samples.length,
    fsl_105: fslSamples.samples.length,
    fsl_v45: v45Samples.samples.length,
    roboflow: roboflowSamples.samples.length
  };

  const metadata = {
    totalLabels: labelMap.labels.length,
    totalSamples: merged.length,
    splits: {
      train: { samples: trainSet.samples.length, percent: ((trainCount / merged.length) * 100).toFixed(1) },
      validation: { samples: valSet.samples.length, percent: ((valCount / merged.length) * 100).toFixed(1) },
      test: { samples: testSet.samples.length, percent: ((testCount / merged.length) * 100).toFixed(1) },
    },
    sources,
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

  writeMergeReport({
    existing: existingCoverage,
    v45: v45Coverage,
    roboflow: roboflowCoverage,
    merged: mergedCoverage
  }, labelMap);

  console.log(`\nMerge complete. Output: ${OUT_DIR}`);
  console.log(`  Train: ${trainSet.samples.length}`);
  console.log(`  Validation: ${valSet.samples.length}`);
  console.log(`  Test: ${testSet.samples.length}`);
  console.log(`  Labels: ${labelMap.labels.length}`);
};

main();
