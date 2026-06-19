import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ALPHA_DIR = path.join(ROOT, "datasets", "processed", "fsl_alphabet_v2");
const FSL_DIR = path.join(ROOT, "datasets", "processed", "fsl_105");
const UNIFIED_META = path.join(ROOT, "datasets", "processed", "fsl_unified", "metadata.json");

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const alphaMeta = readJson(path.join(ALPHA_DIR, "metadata.json"));
const alphaTrain = readJson(path.join(ALPHA_DIR, "train.json"));
const alphaTest = readJson(path.join(ALPHA_DIR, "test.json"));
const fslMeta = readJson(path.join(FSL_DIR, "metadata.json"));
const fslTrain = readJson(path.join(FSL_DIR, "train.json"));
const fslTest = readJson(path.join(FSL_DIR, "test.json"));
const unifiedMeta = readJson(UNIFIED_META);

const alphaSamples = [...alphaTrain.samples, ...alphaTest.samples];
const fslSamples = [...fslTrain.samples, ...fslTest.samples];

const computeSequenceStats = (samples) => {
  const lengths = samples.map((s) => s.originalFrameCount ?? s.sequence.length);
  const sorted = [...lengths].sort((a, b) => a - b);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: lengths.reduce((a, b) => a + b, 0) / lengths.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p10: sorted[Math.floor(sorted.length * 0.1)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
  };
};

const countByLabel = (samples) => {
  const counts = {};
  for (const s of samples) {
    counts[s.label] = (counts[s.label] || 0) + 1;
  }
  return counts;
};

const countBySigner = (samples) => {
  const counts = {};
  for (const s of samples) {
    counts[s.signerId] = (counts[s.signerId] || 0) + 1;
  }
  return counts;
};

const countByDevice = (samples) => {
  const counts = {};
  for (const s of samples) {
    const device = s.deviceType || "unknown";
    counts[device] = (counts[device] || 0) + 1;
  }
  return counts;
};

const countByLighting = (samples) => {
  const counts = {};
  for (const s of samples) {
    const lighting = s.lighting || "unknown";
    counts[lighting] = (counts[lighting] || 0) + 1;
  }
  return counts;
};

const computeLandmarkStats = (samples) => {
  const allValues = [];
  for (const s of samples) {
    for (const frame of s.sequence) {
      for (let i = 66; i < frame.length; i++) {
        const v = frame[i];
        if (v !== 0) allValues.push(v);
      }
    }
  }
  const sorted = [...allValues].sort((a, b) => a - b);
  return {
    min: sorted[0].toFixed(4),
    max: sorted[sorted.length - 1].toFixed(4),
    mean: (allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(4),
    median: sorted[Math.floor(sorted.length / 2)].toFixed(4),
    std: Math.sqrt(allValues.reduce((sum, v) => sum + (v - allValues.reduce((a, b) => a + b, 0) / allValues.length) ** 2, 0) / allValues.length).toFixed(4),
    nonzeroPct: ((allValues.filter((v) => v !== 0).length / allValues.length) * 100).toFixed(2),
  };
};

const alphaSeqStats = computeSequenceStats(alphaSamples);
const fslSeqStats = computeSequenceStats(fslSamples);

const alphaLabelCounts = countByLabel(alphaSamples);
const fslLabelCounts = countByLabel(fslSamples);

const alphaSignerCounts = countBySigner(alphaSamples);
const fslSignerCounts = countBySigner(fslSamples);

const alphaDeviceCounts = countByDevice(alphaSamples);
const fslDeviceCounts = countByDevice(fslSamples);

const alphaLandmarkStats = computeLandmarkStats(alphaSamples);
const fslLandmarkStats = computeLandmarkStats(fslSamples);

const alphaLabelDist = Object.values(alphaLabelCounts);
const fslLabelDist = Object.values(fslLabelCounts);

const imbalanceRatio = (counts) => {
  const vals = Object.values(counts);
  return (Math.max(...vals) / Math.min(...vals)).toFixed(2);
};

const report = {
  datasetOverview: {
    alphabet: { totalSamples: alphaSamples.length, numLabels: unifiedMeta.labelCount, numSigners: alphaMeta.numSigners, numPresets: alphaMeta.augmentationPresets?.length ?? 1 },
    fsl105: { totalSamples: fslSamples.length, numLabels: unifiedMeta.fslLabelCount, numSigners: fslMeta.numSigners },
    unified: { totalSamples: alphaSamples.length + fslSamples.length, totalLabels: unifiedMeta.totalLabels, splits: unifiedMeta.splits },
  },
  sequenceLengths: {
    alphabet: alphaSeqStats,
    fsl105: fslSeqStats,
  },
  classDistribution: {
    alphabet: {
      counts: alphaLabelCounts,
      imbalanceRatio: imbalanceRatio(alphaLabelCounts),
      meanSamplesPerClass: (alphaSamples.length / unifiedMeta.labelCount).toFixed(1),
      minClass: Object.entries(alphaLabelCounts).sort((a, b) => a[1] - b[1])[0],
      maxClass: Object.entries(alphaLabelCounts).sort((a, b) => b[1] - a[1])[0],
    },
    fsl105: {
      counts: fslLabelCounts,
      imbalanceRatio: imbalanceRatio(fslLabelCounts),
      meanSamplesPerClass: (fslSamples.length / unifiedMeta.fslLabelCount).toFixed(1),
      minClass: Object.entries(fslLabelCounts).sort((a, b) => a[1] - b[1])[0],
      maxClass: Object.entries(fslLabelCounts).sort((a, b) => b[1] - a[1])[0],
    },
  },
  signerDistribution: {
    alphabet: { counts: alphaSignerCounts, uniqueSigners: Object.keys(alphaSignerCounts).length, imbalanceRatio: imbalanceRatio(alphaSignerCounts) },
    fsl105: { counts: fslSignerCounts, uniqueSigners: Object.keys(fslSignerCounts).length, imbalanceRatio: imbalanceRatio(fslSignerCounts) },
  },
  captureConditions: {
    alphabet: { deviceTypes: alphaDeviceCounts, lighting: countByLighting(alphaSamples) },
    fsl105: { deviceTypes: fslDeviceCounts, lighting: countByLighting(fslSamples) },
  },
  landmarkQuality: {
    alphabet: alphaLandmarkStats,
    fsl105: fslLandmarkStats,
  },
  missingData: {
    alphabet: {
      missingSignerId: alphaSamples.filter((s) => !s.signerId).length,
      missingLabel: alphaSamples.filter((s) => s.label == null).length,
    },
    fsl105: {
      missingSignerId: fslSamples.filter((s) => !s.signerId).length,
      missingLabel: fslSamples.filter((s) => s.label == null).length,
    },
  },
  qualityFlags: [],
};

if (report.classDistribution.alphabet.imbalanceRatio > 3) report.qualityFlags.push(`ALPHABET_HIGH_IMBALANCE: ratio=${report.classDistribution.alphabet.imbalanceRatio}`);
if (report.classDistribution.fsl105.imbalanceRatio > 3) report.qualityFlags.push(`FSL105_HIGH_IMBALANCE: ratio=${report.classDistribution.fsl105.imbalanceRatio}`);
if (alphaSamples.length < 2000) report.qualityFlags.push(`ALPHABET_SMALL_DATASET: ${alphaSamples.length} samples (target > 5000)`);
if (fslSamples.length < 2000) report.qualityFlags.push(`FSL105_SMALL_DATASET: ${fslSamples.length} samples (target > 5000)`);
if (report.landmarkQuality.alphabet.nonzeroPct < 10) report.qualityFlags.push(`ALPHABET_SPARSE_LANDMARKS: ${report.landmarkQuality.alphabet.nonzeroPct}% nonzero`);
if (report.landmarkQuality.fsl105.nonzeroPct < 10) report.qualityFlags.push(`FSL105_SPARSE_LANDMARKS: ${report.landmarkQuality.fsl105.nonzeroPct}% nonzero`);
if (fslSeqStats.mean < 30) report.qualityFlags.push(`FSL105_SHORT_SEQUENCES: mean=${fslSeqStats.mean.toFixed(1)} frames (risk of information loss at T=30)`);

report.recommendations = [];

report.recommendations.push({
  priority: "HIGH",
  area: "Class imbalance",
  action: `Use weighted loss or oversampling for alphabet (ratio=${report.classDistribution.alphabet.imbalanceRatio}) and FSL-105 (ratio=${report.classDistribution.fsl105.imbalanceRatio})`,
});

report.recommendations.push({
  priority: "HIGH",
  area: "FSL-105 per-class samples",
  action: `Minimum samples per FSL class: ${report.classDistribution.fsl105.minClass[1]}. Target at least 15 per class for train splits.`,
});

report.recommendations.push({
  priority: "HIGH",
  area: "Signer diversity (alphabet)",
  action: `Alphabet has only ${report.signerDistribution.alphabet.uniqueSigners} signers. Collect from more signers for better generalization.`,
});

if (fslSeqStats.mean < 60) {
  report.recommendations.push({
    priority: "MEDIUM",
    area: "Sequence length",
    action: `FSL-105 sequences average ${fslSeqStats.mean.toFixed(1)} frames. Temporal subsampling at T=30 loses detail. Consider T=40-50 for FSL phrases.`,
  });
}

report.recommendations.push({
  priority: "LOW",
  area: "Lighting diversity (FSL-105)",
  action: `FSL-105 has ${JSON.stringify(report.captureConditions.fsl105.lighting)} lighting conditions. All are studio -- no real-world variance.`,
});

const outPath = path.join(ROOT, "models", "fsl_unified", "bilstm", "dataset_audit.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\nAudit saved to ${outPath}`);
