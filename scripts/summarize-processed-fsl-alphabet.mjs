import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet");
const REQUIRED_FILES = [
  "labels.json",
  "metadata.json",
  "train.json",
  "validation.json",
  "test.json"
];

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

const isValidNumber = (value) => typeof value === "number" && Number.isFinite(value);

const checkRequiredFiles = () => {
  const missing = [];
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(OUTPUT_DIR, file);
    if (!fs.existsSync(filePath)) {
      missing.push(file);
    }
  }
  return missing;
};

const countLabelOccurrences = (labels) => {
  return Object.fromEntries(labels.map((label) => [label, 0]));
};

const analyzeSplit = (splitName, payload, labels, stats) => {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.samples)) {
    stats.errors.push(`${splitName}.json samples missing or invalid.`);
    return { labelCounts: countLabelOccurrences(labels), sampleCount: 0 };
  }

  const labelCounts = countLabelOccurrences(labels);
  let sampleCount = 0;

  for (const sample of payload.samples) {
    if (!sample || typeof sample !== "object") {
      stats.errors.push(`${splitName}.json contains invalid sample.`);
      continue;
    }

    const label = sample.label;
    if (typeof label === "string" && label in labelCounts) {
      labelCounts[label] += 1;
    }

    if (!Array.isArray(sample.sequence)) {
      continue;
    }

    sampleCount += 1;
    for (const frame of sample.sequence) {
      if (!Array.isArray(frame)) {
        continue;
      }

      let frameAllZero = true;
      for (const value of frame) {
        if (!isValidNumber(value)) {
          stats.suspiciousValues += 1;
          frameAllZero = false;
          continue;
        }
        if (value !== 0) {
          frameAllZero = false;
        }
        stats.minValue = Math.min(stats.minValue, value);
        stats.maxValue = Math.max(stats.maxValue, value);
        stats.sumValues += value;
        stats.valueCount += 1;
      }

      if (frameAllZero) {
        stats.allZeroFrames += 1;
      }
    }
  }

  return { labelCounts, sampleCount };
};

const formatLabelMapping = (labels, labelToId) => {
  return labels.map((label) => `${label}:${labelToId[label]}`).join(" ");
};

const computeImbalanceWarnings = (labels, countsBySplit, warnings) => {
  for (const splitName of Object.keys(countsBySplit)) {
    for (const label of labels) {
      if (countsBySplit[splitName][label] === 0) {
        warnings.push(`${splitName} split missing label ${label}.`);
      }
    }
  }
};

const main = () => {
  const missingFiles = checkRequiredFiles();
  if (missingFiles.length > 0) {
    console.error("Missing required processed files:");
    for (const file of missingFiles) {
      console.error(`- ${file}`);
    }
    process.exit(1);
  }

  const labelsJson = readJson(path.join(OUTPUT_DIR, "labels.json"));
  const metadataJson = readJson(path.join(OUTPUT_DIR, "metadata.json"));
  const trainJson = readJson(path.join(OUTPUT_DIR, "train.json"));
  const validationJson = readJson(path.join(OUTPUT_DIR, "validation.json"));
  const testJson = readJson(path.join(OUTPUT_DIR, "test.json"));

  const labels = Array.isArray(labelsJson.labels) ? labelsJson.labels : [];
  const labelToId = labelsJson.labelToId ?? {};

  const stats = {
    minValue: Number.POSITIVE_INFINITY,
    maxValue: Number.NEGATIVE_INFINITY,
    sumValues: 0,
    valueCount: 0,
    allZeroFrames: 0,
    suspiciousValues: 0,
    errors: [],
    warnings: []
  };

  const trainStats = analyzeSplit("train", trainJson, labels, stats);
  const validationStats = analyzeSplit("validation", validationJson, labels, stats);
  const testStats = analyzeSplit("test", testJson, labels, stats);

  const totalSamples =
    trainStats.sampleCount + validationStats.sampleCount + testStats.sampleCount;

  const avgValue = stats.valueCount > 0 ? stats.sumValues / stats.valueCount : 0;

  console.log("Processed FSL alphabet dataset summary");
  console.log(`Total labels: ${labels.length}`);
  console.log(`Labels: ${labels.join(" ")}`);
  console.log(`Label mapping: ${formatLabelMapping(labels, labelToId)}`);
  console.log(`Sequence length: ${metadataJson.sequenceLength ?? "unknown"}`);
  console.log(`Feature dimension: ${metadataJson.featureDimension ?? "unknown"}`);
  console.log(`Total samples: ${totalSamples}`);
  console.log(
    `Split counts -> train: ${trainStats.sampleCount}, validation: ${validationStats.sampleCount}, test: ${testStats.sampleCount}`
  );

  console.log("Label counts by split:");
  for (const split of ["train", "validation", "test"]) {
    const counts =
      split === "train"
        ? trainStats.labelCounts
        : split === "validation"
          ? validationStats.labelCounts
          : testStats.labelCounts;
    const formatted = labels.map((label) => `${label}:${counts[label]}`).join(" ");
    console.log(`- ${split}: ${formatted}`);
  }

  if (stats.valueCount > 0) {
    console.log(
      `Feature values -> min: ${stats.minValue.toFixed(4)}, max: ${stats.maxValue.toFixed(4)}, avg: ${avgValue.toFixed(6)}`
    );
  }

  console.log(`All-zero frames: ${stats.allZeroFrames}`);

  if (stats.suspiciousValues > 0) {
    stats.warnings.push(`Suspicious feature values found: ${stats.suspiciousValues}`);
  }

  computeImbalanceWarnings(
    labels,
    {
      train: trainStats.labelCounts,
      validation: validationStats.labelCounts,
      test: testStats.labelCounts
    },
    stats.warnings
  );

  if (stats.errors.length > 0) {
    console.error("Errors:");
    for (const error of stats.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  if (stats.warnings.length > 0) {
    console.warn("Warnings:");
    for (const warning of stats.warnings) {
      console.warn(`- ${warning}`);
    }
  }

  console.log("Summary complete.");
};

main();
