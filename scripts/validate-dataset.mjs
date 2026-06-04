import fs from "fs";
import path from "path";

const LABELS = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "ñ",
  "ng",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z"
];
const ROOT_DIR = path.join(process.cwd(), "datasets", "raw", "fsl_alphabet");
const STRICT = process.argv.includes("--strict");
const PILOT_MIN_SAMPLES = 3;
const TARGET_SAMPLES = (() => {
  const flag = "--target";
  const withValue = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (withValue) {
    const value = Number(withValue.split("=")[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const flagIndex = process.argv.indexOf(flag);
  if (flagIndex !== -1) {
    const value = Number(process.argv[flagIndex + 1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  return null;
})();

const COVERAGE_TARGET = TARGET_SAMPLES ?? PILOT_MIN_SAMPLES;

const formatNumber = (value) => value.toString().padStart(4, " ");

const getFrameCount = (payload) => {
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  if (typeof payload.frameCount === "number") {
    return payload.frameCount;
  }

  if (Array.isArray(payload.frames)) {
    return payload.frames.length;
  }

  return 0;
};

const isValidPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  if (typeof payload.frameCount === "number") {
    return true;
  }

  return Array.isArray(payload.frames);
};

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

const invalidJsonFiles = [];
const invalidStructureFiles = [];

const labelReport = LABELS.map((label) => {
  const labelDir = path.join(ROOT_DIR, label);
  const exists = fs.existsSync(labelDir);

  if (!exists) {
    return {
      label,
      exists: false,
      samples: 0,
      totalFrames: 0,
      avgFrames: 0
    };
  }

  const entries = fs.readdirSync(labelDir, { withFileTypes: true });
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(labelDir, entry.name));

  let totalFrames = 0;
  for (const filePath of jsonFiles) {
    try {
      const payload = readJson(filePath);
      if (!isValidPayload(payload)) {
        invalidStructureFiles.push(filePath);
        continue;
      }
      totalFrames += getFrameCount(payload);
    } catch (error) {
      invalidJsonFiles.push(filePath);
      console.warn(`Warning: Failed to read ${filePath}: ${error.message}`);
    }
  }

  const samples = jsonFiles.length;
  const avgFrames = samples > 0 ? Math.round(totalFrames / samples) : 0;

  return {
    label,
    exists: true,
    samples,
    totalFrames,
    avgFrames
  };
});

const missingLabels = labelReport.filter((item) => !item.exists);
const belowPilotLabels = labelReport.filter(
  (item) => item.samples < PILOT_MIN_SAMPLES
);
const belowTargetLabels = labelReport.filter(
  (item) => item.samples < COVERAGE_TARGET
);
const zeroSampleLabels = labelReport.filter((item) => item.exists && item.samples === 0);

console.log("FSL Alphabet Dataset Coverage");
console.log(`Root: ${ROOT_DIR}`);
console.log(`Pilot minimum samples: ${PILOT_MIN_SAMPLES}`);
console.log(`Coverage target samples: ${COVERAGE_TARGET}`);
console.log("");
console.log("Label | Samples | Total Frames | Avg Frames");
console.log("----- | ------- | ------------ | ----------");

for (const item of labelReport) {
  const sampleText = formatNumber(item.samples);
  const totalText = formatNumber(item.totalFrames);
  const avgText = formatNumber(item.avgFrames);
  console.log(`${item.label}     | ${sampleText}   | ${totalText}        | ${avgText}`);
}

const totalSamples = labelReport.reduce((sum, item) => sum + item.samples, 0);
const totalFrames = labelReport.reduce((sum, item) => sum + item.totalFrames, 0);

console.log("");
console.log(`Total samples: ${totalSamples}`);
console.log(`Total frames: ${totalFrames}`);

if (missingLabels.length > 0) {
  console.log("");
  console.log(
    `Missing label folders: ${missingLabels.map((item) => item.label).join(", ")}`
  );
}

if (zeroSampleLabels.length > 0) {
  console.log("");
  console.log(
    `Labels with zero samples: ${zeroSampleLabels
      .map((item) => item.label)
      .join(", ")}`
  );
}

if (belowPilotLabels.length > 0) {
  console.log("");
  console.log(
    `Labels below ${PILOT_MIN_SAMPLES} samples: ${belowPilotLabels
      .map((item) => `${item.label} (${item.samples})`)
      .join(", ")}`
  );
}

if (COVERAGE_TARGET !== PILOT_MIN_SAMPLES && belowTargetLabels.length > 0) {
  console.log("");
  console.log(
    `Labels below ${COVERAGE_TARGET} samples: ${belowTargetLabels
      .map((item) => `${item.label} (${item.samples})`)
      .join(", ")}`
  );
}

if (invalidJsonFiles.length > 0) {
  console.log("");
  console.log(`Invalid JSON files: ${invalidJsonFiles.length}`);
}

if (invalidStructureFiles.length > 0) {
  console.log("");
  console.log(`Invalid JSON structure files: ${invalidStructureFiles.length}`);
}

if (STRICT) {
  const strictFailures = missingLabels.length > 0 ||
    belowPilotLabels.length > 0 ||
    invalidJsonFiles.length > 0 ||
    invalidStructureFiles.length > 0;

  if (strictFailures) {
    console.error("");
    console.error("Strict mode failed: dataset coverage is incomplete.");
    process.exit(1);
  }
}
