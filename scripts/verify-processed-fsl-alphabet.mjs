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
const EXPECTED_SEQUENCE_LENGTH = 120;
const EXPECTED_FEATURE_DIMENSION = 126;
const RATIO_TOLERANCE = 0.03;

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

const validateLabelMappings = (labelsJson, errors) => {
  if (!labelsJson || typeof labelsJson !== "object") {
    errors.push("labels.json is missing or invalid.");
    return null;
  }

  const { labels, labelToId, idToLabel } = labelsJson;
  if (!Array.isArray(labels) || labels.length === 0) {
    errors.push("labels.json is missing labels array.");
    return null;
  }
  if (!labelToId || typeof labelToId !== "object") {
    errors.push("labels.json is missing labelToId map.");
    return null;
  }
  if (!idToLabel || typeof idToLabel !== "object") {
    errors.push("labels.json is missing idToLabel map.");
    return null;
  }

  for (const label of labels) {
    if (!(label in labelToId)) {
      errors.push(`labels.json missing labelToId entry for ${label}.`);
      continue;
    }
    const id = labelToId[label];
    if (!Number.isInteger(id)) {
      errors.push(`labels.json has non-integer id for ${label}.`);
      continue;
    }
    if (!(String(id) in idToLabel)) {
      errors.push(`labels.json missing idToLabel entry for ${label}.`);
      continue;
    }
    if (idToLabel[String(id)] !== label) {
      errors.push(`labels.json idToLabel mismatch for ${label}.`);
    }
  }

  return { labels, labelToId, idToLabel };
};

const validateMetadata = (metadata, labels, errors) => {
  if (!metadata || typeof metadata !== "object") {
    errors.push("metadata.json is missing or invalid.");
    return null;
  }

  if (!Array.isArray(metadata.expectedLabels) || metadata.expectedLabels.length === 0) {
    errors.push("metadata.json missing expectedLabels.");
  } else if (labels && metadata.expectedLabels.join("|") !== labels.join("|")) {
    errors.push("metadata.json expectedLabels do not match labels.json.");
  }

  if (metadata.sequenceLength !== EXPECTED_SEQUENCE_LENGTH) {
    errors.push("metadata.json sequenceLength does not match expected value.");
  }
  if (metadata.featureDimension !== EXPECTED_FEATURE_DIMENSION) {
    errors.push("metadata.json featureDimension does not match expected value.");
  }

  return metadata;
};

const validateSamples = (splitName, payload, labelsData, errors, warnings) => {
  if (!payload || typeof payload !== "object") {
    errors.push(`${splitName}.json is missing or invalid.`);
    return { samples: [], labelCounts: {} };
  }

  const { samples } = payload;
  if (!Array.isArray(samples) || samples.length === 0) {
    errors.push(`${splitName}.json samples are missing or empty.`);
    return { samples: [], labelCounts: {} };
  }

  const labelCounts = Object.fromEntries(labelsData.labels.map((label) => [label, 0]));

  for (const [index, sample] of samples.entries()) {
    if (!sample || typeof sample !== "object") {
      errors.push(`${splitName}.json sample ${index} is invalid.`);
      continue;
    }

    if (!Array.isArray(sample.sequence)) {
      errors.push(`${splitName}.json sample ${index} missing sequence.`);
      continue;
    }

    if (sample.sequence.length !== EXPECTED_SEQUENCE_LENGTH) {
      errors.push(`${splitName}.json sample ${index} has invalid sequence length.`);
      continue;
    }

    if (typeof sample.label !== "string" || !(sample.label in labelsData.labelToId)) {
      errors.push(`${splitName}.json sample ${index} has invalid label.`);
      continue;
    }

    if (!Number.isInteger(sample.labelId)) {
      errors.push(`${splitName}.json sample ${index} has invalid labelId.`);
      continue;
    }

    if (labelsData.labelToId[sample.label] !== sample.labelId) {
      errors.push(`${splitName}.json sample ${index} labelId mismatch.`);
      continue;
    }

    if (labelsData.idToLabel[String(sample.labelId)] !== sample.label) {
      errors.push(`${splitName}.json sample ${index} idToLabel mismatch.`);
      continue;
    }

    for (const frame of sample.sequence) {
      if (!Array.isArray(frame) || frame.length !== EXPECTED_FEATURE_DIMENSION) {
        errors.push(`${splitName}.json sample ${index} has invalid frame shape.`);
        break;
      }

      for (const value of frame) {
        if (!isValidNumber(value)) {
          errors.push(`${splitName}.json sample ${index} has invalid feature value.`);
          break;
        }
      }
    }

    labelCounts[sample.label] += 1;
  }

  for (const label of labelsData.labels) {
    if (labelCounts[label] === 0) {
      warnings.push(`${splitName} split missing label ${label}.`);
    }
  }

  return { samples, labelCounts };
};

const checkSplitRatios = (total, counts, ratios, warnings) => {
  if (!ratios || typeof ratios !== "object") {
    return;
  }

  for (const [splitName, ratio] of Object.entries(ratios)) {
    if (typeof ratio !== "number") {
      continue;
    }
    const expected = total * ratio;
    const actual = counts[splitName] ?? 0;
    if (total > 0 && Math.abs(actual - expected) / total > RATIO_TOLERANCE) {
      warnings.push(`Split ratio for ${splitName} deviates from expected.`);
    }
  }
};

const main = () => {
  const errors = [];
  const warnings = [];

  const missingFiles = checkRequiredFiles();
  if (missingFiles.length > 0) {
    console.error("Missing required files:");
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

  const labelsData = validateLabelMappings(labelsJson, errors);
  if (!labelsData) {
    errors.push("labels.json validation failed.");
  }

  const metadata = validateMetadata(metadataJson, labelsData?.labels ?? null, errors);

  if (labelsData) {
    const trainCheck = validateSamples("train", trainJson, labelsData, errors, warnings);
    const validationCheck = validateSamples("validation", validationJson, labelsData, errors, warnings);
    const testCheck = validateSamples("test", testJson, labelsData, errors, warnings);

    const totalSamples =
      trainCheck.samples.length + validationCheck.samples.length + testCheck.samples.length;

    const totalLabelCounts = Object.fromEntries(labelsData.labels.map((label) => [label, 0]));
    for (const label of labelsData.labels) {
      totalLabelCounts[label] =
        trainCheck.labelCounts[label] +
        validationCheck.labelCounts[label] +
        testCheck.labelCounts[label];
    }

    for (const label of labelsData.labels) {
      if (totalLabelCounts[label] === 0) {
        errors.push(`No samples found for label ${label}.`);
      }
    }

    const splitCounts = {
      train: trainCheck.samples.length,
      validation: validationCheck.samples.length,
      test: testCheck.samples.length
    };

    checkSplitRatios(totalSamples, splitCounts, metadata?.splitRatios, warnings);

    console.log("Processed dataset verification report");
    console.log(`Total samples: ${totalSamples}`);
    console.log(`Split counts -> train: ${splitCounts.train}, validation: ${splitCounts.validation}, test: ${splitCounts.test}`);
    console.log("Label counts by split:");
    for (const split of ["train", "validation", "test"]) {
      const counts = split === "train" ? trainCheck.labelCounts : split === "validation" ? validationCheck.labelCounts : testCheck.labelCounts;
      const formatted = labelsData.labels.map((label) => `${label}:${counts[label]}`).join(" ");
      console.log(`- ${split}: ${formatted}`);
    }
  }

  if (warnings.length > 0) {
    console.warn("Warnings:");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error("Verification failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Verification passed.");
};

main();
