import fs from "fs";
import path from "path";

const LABELS = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];

const INPUT_DIR = path.join(process.cwd(), "datasets", "raw", "fsl_alphabet");
const OUTPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_v2");
const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const RANDOM_SEED = 1337;
const SPLIT_RATIOS = { train: 0.7, validation: 0.15, test: 0.15 };

const labelToId = Object.fromEntries(LABELS.map((label, index) => [label, index]));
const idToLabel = Object.fromEntries(LABELS.map((label, index) => [index, label]));

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const isValidNumber = (value) => typeof value === "number" && Number.isFinite(value);

const validateLandmarkPoint = (point) => {
  return point && typeof point === "object" && isValidNumber(point.x) && isValidNumber(point.y) && isValidNumber(point.z);
};

const normalizeHand = (landmarks) => {
  if (!Array.isArray(landmarks) || landmarks.length !== 21) return null;
  const wrist = landmarks[0];
  if (!validateLandmarkPoint(wrist)) return null;
  const centered = landmarks.map((point) => {
    if (!validateLandmarkPoint(point)) return null;
    return { x: point.x - wrist.x, y: point.y - wrist.y, z: point.z - wrist.z };
  });
  if (centered.some((point) => !point)) return null;
  let maxAbs = 0;
  for (const point of centered) { maxAbs = Math.max(maxAbs, Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)); }
  if (maxAbs === 0) return centered;
  return centered.map((point) => ({ x: point.x / maxAbs, y: point.y / maxAbs, z: point.z / maxAbs }));
};

const resolveHandSlot = (handedness) => {
  if (!handedness || typeof handedness !== "string") return null;
  const normalized = handedness.toLowerCase();
  if (normalized.includes("left")) return 0;
  if (normalized.includes("right")) return 1;
  return null;
};

const buildFrameFeatures = (frame) => {
  if (!frame || typeof frame !== "object") return null;
  const hands = Array.isArray(frame.hands) ? frame.hands : [];
  const handSlots = [null, null];
  for (const hand of hands) {
    if (!hand || typeof hand !== "object") continue;
    const normalizedHand = normalizeHand(hand.landmarks);
    if (!normalizedHand) continue;
    const slot = resolveHandSlot(hand.handedness);
    if (slot !== null && !handSlots[slot]) { handSlots[slot] = normalizedHand; continue; }
    const firstEmpty = handSlots.findIndex((entry) => !entry);
    if (firstEmpty !== -1) handSlots[firstEmpty] = normalizedHand;
  }
  const features = [];
  for (const slot of handSlots) {
    if (!slot) { for (let i = 0; i < 21; i += 1) features.push(0, 0, 0); continue; }
    for (const point of slot) features.push(point.x, point.y, point.z);
  }
  if (features.length !== FEATURE_DIMENSION) return null;
  return features;
};

const padSequence = (sequence) => {
  const padded = sequence.slice(0, SEQUENCE_LENGTH);
  while (padded.length < SEQUENCE_LENGTH) padded.push(new Array(FEATURE_DIMENSION).fill(0));
  return padded;
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let value = Math.imul(t ^ (t >>> 15), 1 | t); value ^= value + Math.imul(value ^ (value >>> 7), 61 | value); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; };
};

const shuffle = (items, seed) => {
  const rng = mulberry32(seed);
  for (let i = items.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
};

const ensureDir = (dirPath) => { if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true }); };

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) { hash = (hash << 5) - hash + value.charCodeAt(i); hash |= 0; }
  return Math.abs(hash);
};

const computeLabelSplitCounts = (total) => {
  const rawValidation = Math.round(total * SPLIT_RATIOS.validation);
  const rawTest = Math.round(total * SPLIT_RATIOS.test);
  let validationCount = Math.max(1, rawValidation);
  let testCount = Math.max(1, rawTest);
  let trainCount = total - validationCount - testCount;
  if (trainCount < 1) { trainCount = 1; const remaining = total - trainCount; validationCount = Math.min(validationCount, remaining - 1); testCount = remaining - validationCount; }
  if (validationCount < 1) { validationCount = 1; trainCount = Math.max(1, total - validationCount - testCount); }
  if (testCount < 1) { testCount = 1; trainCount = Math.max(1, total - validationCount - testCount); }
  return { trainCount, validationCount, testCount };
};

const collectSamples = () => {
  const samples = [];
  const sampleCountsByLabel = Object.fromEntries(LABELS.map((label) => [label, 0]));
  const sampleCountsBySigner = {};
  const errors = [];

  for (const label of LABELS) {
    const labelDir = path.join(INPUT_DIR, label);
    if (!fs.existsSync(labelDir)) { errors.push(`Missing label folder: ${label}`); continue; }

    const entries = fs.readdirSync(labelDir, { withFileTypes: true });
    const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => path.join(labelDir, entry.name)).sort();

    for (const filePath of jsonFiles) {
      let payload;
      try { payload = readJson(filePath); } catch { errors.push(`Invalid JSON: ${filePath}`); continue; }
      if (!payload || typeof payload !== "object" || !Array.isArray(payload.frames)) { errors.push(`Invalid structure: ${filePath}`); continue; }

      const sequence = [];
      for (const frame of payload.frames) {
        const features = buildFrameFeatures(frame);
        if (!features) { errors.push(`Invalid frame: ${filePath}`); sequence.length = 0; break; }
        sequence.push(features);
      }
      if (sequence.length === 0) continue;

      const signerId = payload.signerId || "S01";
      const sample = {
        label, labelId: labelToId[label],
        sequence: padSequence(sequence),
        originalFrameCount: payload.frames.length,
        signerId,
        sessionId: payload.sessionId || `session-${filePath.replace(/\.json$/, "").split("_").pop()}`,
        deviceType: payload.deviceType || "webcam",
        lighting: payload.lighting || "indoor",
        handedness: payload.handedness || "right",
        augmentationPreset: payload.augmentationPreset || null,
        originalFile: payload.originalFile || null
      };

      samples.push(sample);
      sampleCountsByLabel[label] += 1;
      sampleCountsBySigner[signerId] = (sampleCountsBySigner[signerId] || 0) + 1;
    }
  }

  return { samples, sampleCountsByLabel, sampleCountsBySigner, errors };
};

const splitSamplesStratified = (samples) => {
  const train = [];
  const validation = [];
  const test = [];

  for (const label of LABELS) {
    const labelSamples = samples.filter((sample) => sample.label === label);
    if (labelSamples.length === 0) continue;

    const labelSeed = RANDOM_SEED + hashString(label);
    const shuffled = shuffle([...labelSamples], labelSeed);
    const { trainCount, validationCount, testCount } = computeLabelSplitCounts(shuffled.length);

    train.push(...shuffled.slice(0, trainCount));
    validation.push(...shuffled.slice(trainCount, trainCount + validationCount));
    test.push(...shuffled.slice(trainCount + validationCount));
  }

  return { train, validation, test, counts: { train: train.length, validation: validation.length, test: test.length } };
};

const writeJson = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

const writeLargeSplitJson = (filePath, meta, samples) => {
  const stream = fs.createWriteStream(filePath, { encoding: "utf8" });
  stream.write(`{\n  "sequenceLength": ${meta.sequenceLength},\n  "featureDimension": ${meta.featureDimension},\n  "samples": [\n`);
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i];
    const sample = {
      label: s.label, labelId: s.labelId, originalFrameCount: s.originalFrameCount,
      signerId: s.signerId, sessionId: s.sessionId, deviceType: s.deviceType,
      lighting: s.lighting, handedness: s.handedness,
      augmentationPreset: s.augmentationPreset, originalFile: s.originalFile,
      sequence: s.sequence
    };
    stream.write(JSON.stringify(sample));
    if (i < samples.length - 1) stream.write(",\n");
  }
  stream.write("\n  ]\n}\n");
  stream.end();
};

const main = () => {
  ensureDir(OUTPUT_DIR);
  const { samples, sampleCountsByLabel, sampleCountsBySigner, errors } = collectSamples();

  if (errors.length > 0) {
    console.error("Preprocessing v2 failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const split = splitSamplesStratified(samples);

  writeJson(path.join(OUTPUT_DIR, "labels.json"), { labels: LABELS, labelToId, idToLabel });

  const signersList = Object.keys(sampleCountsBySigner).sort();
  writeJson(path.join(OUTPUT_DIR, "metadata.json"), {
    expectedLabels: LABELS,
    labelToId,
    totalSamples: samples.length,
    sequenceLength: SEQUENCE_LENGTH,
    featureDimension: FEATURE_DIMENSION,
    splitRatios: SPLIT_RATIOS,
    splitCounts: split.counts,
    sampleCountsByLabel,
    sampleCountsBySigner,
    signers: signersList,
    numSigners: signersList.length,
    randomSeed: RANDOM_SEED,
    splitStrategy: "stratified-by-label",
    augmentationPresets: ["original", "rotation", "scale", "landmark-noise", "temporal-occlusion", "mixed"],
    createdAt: new Date().toISOString()
  });

  for (const splitName of ["train", "validation", "test"]) {
    const filePath = path.join(OUTPUT_DIR, `${splitName}.json`);
    console.log(`Writing ${splitName}.json (${split[splitName].length} samples)...`);
    writeLargeSplitJson(filePath, { sequenceLength: SEQUENCE_LENGTH, featureDimension: FEATURE_DIMENSION }, split[splitName]);
  }

  console.log("Preprocessing v2 complete.");
  console.log(`Total samples: ${samples.length}`);
  console.log(`Signers: ${signersList.join(", ")}`);
  console.log(`Split counts -> train: ${split.counts.train}, validation: ${split.counts.validation}, test: ${split.counts.test}`);
};

main();
