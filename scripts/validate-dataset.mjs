import fs from "fs";
import path from "path";

const LABELS = "abcdefghijklmnopqrstuvwxyz".split("");
const ROOT_DIR = path.join(process.cwd(), "datasets", "raw", "fsl_alphabet");
const STRICT = process.argv.includes("--strict");

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

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

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
      totalFrames += getFrameCount(payload);
    } catch (error) {
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
const lowSampleLabels = labelReport.filter(
  (item) => item.exists && item.samples > 0 && item.samples < 3
);
const zeroSampleLabels = labelReport.filter(
  (item) => item.exists && item.samples === 0
);

console.log("FSL Alphabet Dataset Coverage");
console.log(`Root: ${ROOT_DIR}`);
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

if (lowSampleLabels.length > 0) {
  console.log("");
  console.log(
    `Labels below 3 samples: ${lowSampleLabels
      .map((item) => `${item.label} (${item.samples})`)
      .join(", ")}`
  );
}

if (STRICT) {
  const strictFailures = missingLabels.length > 0 ||
    zeroSampleLabels.length > 0 ||
    lowSampleLabels.length > 0;

  if (strictFailures) {
    console.error("");
    console.error("Strict mode failed: dataset coverage is incomplete.");
    process.exit(1);
  }
}
