import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATASETS = [
  { name: "fsl_alphabet_v2", dir: "datasets/processed/fsl_alphabet_v2", type: "temporal" },
  { name: "fsl_105", dir: "datasets/processed/fsl_105", type: "temporal" },
  { name: "fsl_alphabet", dir: "datasets/processed/fsl_alphabet", type: "temporal" },
];

const readJson = (fp) => {
  try { return JSON.parse(fs.readFileSync(fp, "utf8")); } catch { return null; }
};

const analyzeDataset = (ds) => {
  const dir = path.join(ROOT, ds.dir);
  if (!fs.existsSync(dir)) {
    return { name: ds.name, exists: false, errors: [`Directory not found: ${dir}`] };
  }

  const meta = readJson(path.join(dir, "metadata.json"));
  const labelsMeta = readJson(path.join(dir, "labels.json"));
  const train = readJson(path.join(dir, "train.json"));
  const test = readJson(path.join(dir, "test.json"));
  const val = readJson(path.join(dir, "validation.json"));

  const allSplits = [];
  if (train) allSplits.push({ name: "train", data: train });
  if (val) allSplits.push({ name: "validation", data: val });
  if (test) allSplits.push({ name: "test", data: test });

  let totalSamples = 0;
  const labelSources = {};
  const sampleDetails = [];

  for (const split of allSplits) {
    if (!split.data || !split.data.samples) continue;
    for (const s of split.data.samples) {
      totalSamples++;
      if (!labelSources[s.label]) labelSources[s.label] = { count: 0, sources: new Set() };
      labelSources[s.label].count++;
      labelSources[s.label].sources.add(ds.name);

      const isStatic = s.originalFrameCount === 1 || ds.type === "static";
      sampleDetails.push({
        label: s.label,
        labelId: s.labelId,
        split: split.name,
        signerId: s.signerId || "unknown",
        originalFrames: s.originalFrameCount ?? s.sequence?.length ?? 0,
        isStatic,
        deviceType: s.deviceType || "unknown",
        lighting: s.lighting || "unknown",
        handedness: s.handedness || "unknown",
        augmentationPreset: s.augmentationPreset || "none",
        source: ds.name,
      });
    }
  }

  const classCounts = {};
  for (const [label, info] of Object.entries(labelSources)) {
    classCounts[label] = info.count;
  }

  const sortedLabels = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
  const temporalCount = sampleDetails.filter((s) => s.originalFrames > 1).length;
  const staticCount = sampleDetails.filter((s) => s.isStatic || s.originalFrames <= 1).length;

  const labelList = [];
  if (labelsMeta) {
    labelList.push(...(labelsMeta.labels ?? []));
  } else if (meta?.expectedLabels) {
    labelList.push(...meta.expectedLabels);
  }

  return {
    name: ds.name,
    exists: true,
    type: ds.type,
    totalSamples,
    splits: allSplits.map((s) => s.name),
    numClasses: labelList.length,
    labelList,
    temporalSamples: temporalCount,
    staticSamples: staticCount,
    temporalRatio: totalSamples > 0 ? temporalCount / totalSamples : 0,
    staticRatio: totalSamples > 0 ? staticCount / totalSamples : 0,
    classCounts,
    minClass: sortedLabels[sortedLabels.length - 1],
    maxClass: sortedLabels[0],
    imbalanceRatio: sortedLabels.length > 0 ? sortedLabels[0][1] / sortedLabels[sortedLabels.length - 1][1] : 1,
    sampleDetails,
    numSigners: new Set(sampleDetails.map((s) => s.signerId)).size,
    deviceTypes: [...new Set(sampleDetails.map((s) => s.deviceType))],
    lightingConditions: [...new Set(sampleDetails.map((s) => s.lighting))],
    augmentationPresets: [...new Set(sampleDetails.map((s) => s.augmentationPreset))],
  };
};

const mergedMetrics = () => {
  try {
    const metrics = readJson(path.join(ROOT, "models/fsl_unified/bilstm/metrics.json"));
    if (!metrics) return null;
    return {
      accuracy: metrics.testAccuracy,
      macroF1: metrics.macroF1,
      weightedF1: metrics.weightedF1,
      loss: metrics.testLoss,
    };
  } catch {
    return null;
  }
};

const datasets = DATASETS.map(analyzeDataset);

const existingDatasets = datasets.filter((d) => d.exists);
const totalSamplesAll = existingDatasets.reduce((s, d) => s + d.totalSamples, 0);
const totalTemporal = existingDatasets.reduce((s, d) => s + d.temporalSamples, 0);
const totalStatic = existingDatasets.reduce((s, d) => s + d.staticSamples, 0);

const allLabels = new Set();
for (const ds of existingDatasets) {
  for (const l of ds.labelList) allLabels.add(l);
}
for (const ds of existingDatasets) {
  for (const l of Object.keys(ds.classCounts)) allLabels.add(l);
}

const inferenceMetrics = mergedMetrics();

const report = {
  auditDate: new Date().toISOString(),
  summary: {
    totalDatasets: existingDatasets.length,
    totalSamples: totalSamplesAll,
    totalLabels: allLabels.size,
    totalTemporalSamples: totalTemporal,
    totalStaticSamples: totalStatic,
    overallTemporalRatio: totalSamplesAll > 0 ? totalTemporal / totalSamplesAll : 0,
  },
  datasets: datasets.map((d) => ({
    name: d.name,
    exists: d.exists,
    type: d.type,
    totalSamples: d.totalSamples,
    temporalSamples: d.temporalSamples,
    staticSamples: d.staticSamples,
    temporalRatio: d.temporalRatio,
    numClasses: d.numClasses,
    numSigners: d.numSigners,
    imbalanceRatio: d.imbalanceRatio,
    minClass: d.minClass,
    maxClass: d.maxClass,
    deviceTypes: d.deviceTypes,
    lightingConditions: d.lightingConditions,
    splits: d.splits,
    errors: d.errors || [],
  })),
  mergedTraining: {
    currentModel: "fsl_unified/bilstm",
    datasetsUsed: ["fsl_alphabet_v2", "fsl_105"],
    datasetsNotUsed: existingDatasets.filter((d) => !["fsl_alphabet_v2", "fsl_105"].includes(d.name)).map((d) => d.name),
    inferenceMetrics,
  },
  labelCoverage: {
    totalUniqueLabels: allLabels.size,
    labelsMissingFromTraining: [],
  },
};

const allTrainingLabels = new Set();
for (const ds of existingDatasets.filter((d) => ["fsl_alphabet_v2", "fsl_105"].includes(d.name))) {
  for (const l of Object.keys(ds.classCounts)) allTrainingLabels.add(l);
}

const allExistingLabels = new Set();
for (const ds of existingDatasets) {
  for (const l of Object.keys(ds.classCounts)) allExistingLabels.add(l);
}

report.labelCoverage.labelsMissingFromTraining = [...allExistingLabels].filter((l) => !allTrainingLabels.has(l));
report.labelCoverage.labelsInTrainingButNotInUniverse = [...allTrainingLabels].filter((l) => !allExistingLabels.has(l));

const outPath = path.join(ROOT, "scripts", "reports", "training-source-audit.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log("=== Training Source Audit ===");
console.log(`Datasets found: ${existingDatasets.length}/${DATASETS.length}`);
console.log(`Total samples: ${totalSamplesAll}`);
console.log(`Temporal: ${totalTemporal} (${(totalTemporal / totalSamplesAll * 100).toFixed(1)}%)`);
console.log(`Static: ${totalStatic} (${(totalStatic / totalSamplesAll * 100).toFixed(1)}%)`);
console.log(`Total unique labels: ${allLabels.size}`);
console.log(`Training datasets: fsl_alphabet_v2, fsl_105`);
console.log(`\nPer-dataset breakdown:`);
for (const d of report.datasets) {
  const status = d.exists ? `${d.totalSamples} samples, ${d.numClasses} classes` : "NOT FOUND";
  console.log(`  ${d.name}: ${status}`);
}
console.log(`\nSaved to ${outPath}`);
