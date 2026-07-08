#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { createHash } from "crypto";

const PROCESSED_DIR = path.join(process.cwd(), "datasets", "processed");
const HARD_CASES_DIR = path.join(process.cwd(), "datasets", "hard_cases");
const OUTPUT_DIR = path.join(PROCESSED_DIR, "fsl_unified_v4");
const ARCHIVE_DIR = path.join(process.cwd(), "datasets", "archive");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const RANDOM_SEED = 2026;

const ALPHABET_LABELS = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];

const FSL_105_LABELS_ORDERED = [
  "GOOD MORNING","GOOD AFTERNOON","GOOD EVENING","HELLO","HOW ARE YOU",
  "IM FINE","NICE TO MEET YOU","THANK YOU","YOURE WELCOME","SEE YOU TOMORROW",
  "UNDERSTAND","DON'T UNDERSTAND","KNOW","DON'T KNOW","NO","YES","WRONG",
  "CORRECT","SLOW","FAST","ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN",
  "EIGHT","NINE","TEN","JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
  "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER",
  "MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY",
  "TODAY","TOMORROW","YESTERDAY",
  "FATHER","MOTHER","SON","DAUGHTER","GRANDFATHER","GRANDMOTHER","UNCLE",
  "AUNTIE","COUSIN","PARENTS","BOY","GIRL","MAN","WOMAN","DEAF",
  "HARD OF HEARING","WHEELCHAIR PERSON","BLIND","DEAF BLIND","MARRIED",
  "BLUE","GREEN","RED","BROWN","BLACK","WHITE","YELLOW","ORANGE","GRAY",
  "PINK","VIOLET","LIGHT","DARK",
  "BREAD","EGG","FISH","MEAT","CHICKEN","SPAGHETTI","RICE","LONGANISA",
  "SHRIMP","CRAB","HOT","COLD","JUICE","MILK","COFFEE","TEA","BEER","WINE",
  "SUGAR","NO SUGAR"
];

const readJson = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8");
  try { return JSON.parse(content); } catch { return null; }
};

const streamNdjson = (filePath) => {
  return new Promise((resolve, reject) => {
    const samples = [];
    const stream = fs.createReadStream(filePath, { encoding: "utf8", highWaterMark: 1 << 20 });
    let leftover = "";
    stream.on("data", (chunk) => {
      const text = leftover + chunk;
      let start = 0;
      let newlineIdx;
      while ((newlineIdx = text.indexOf("\n", start)) !== -1) {
        const line = text.slice(start, newlineIdx);
        start = newlineIdx + 1;
        if (!line) continue;
        const obj = JSON.parse(line);
        if (obj._header) continue;
        samples.push(obj);
      }
      leftover = text.slice(start);
    });
    stream.on("end", () => { resolve(samples); });
    stream.on("error", reject);
  });
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const fixLabel = (label) => {
  let l = label;
  l = l.replace("WEELCHAIR", "WHEELCHAIR");
  l = l.replace(/\u2018|\u2019|\u201A|\u201B|�/g, "'");
  l = l.replace(/'{2,}/g, "'");
  return l;
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let v = Math.imul(t ^ (t >>> 15), 1 | t);
    v ^= v + Math.imul(v ^ (v >>> 7), 61 | v);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = (items, rng) => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

const makeDedupKey = (sample) => `${sample.datasetOrigin || "?"}|${sample.signerId || "?"}|${sample.sessionId || "?"}|${sample.augmentationPreset || "original"}`;

const UNIFIED_VOCABULARY = [...ALPHABET_LABELS, ...FSL_105_LABELS_ORDERED];
const labelToId = Object.fromEntries(UNIFIED_VOCABULARY.map((l, i) => [l, i]));

const loadKaggleV2 = async () => {
  const dir = path.join(PROCESSED_DIR, "fsl_alphabet_kaggle_v2");
  if (!fs.existsSync(dir)) return null;

  const labels = readJson(path.join(dir, "labels.json"));
  const splits = {};

  for (const split of ["train", "validation", "test"]) {
    const ndPath = path.join(dir, `${split}.ndjson`);
    const jsonPath = path.join(dir, `${split}.json`);

    if (fs.existsSync(ndPath)) {
      splits[split] = await streamNdjson(ndPath);
    } else if (fs.existsSync(jsonPath)) {
      const data = readJson(jsonPath);
      splits[split] = data ? data.samples || [] : [];
    } else {
      splits[split] = [];
    }
  }

  return { label: "fsl_alphabet_kaggle_v2", type: "alphabet", splits, labels: labels ? labels.labels : ALPHABET_LABELS };
};

const loadAugmented = async () => {
  const dir = path.join(PROCESSED_DIR, "fsl_unified_augmented");
  if (!fs.existsSync(dir)) return null;

  // Try NDJSON first (streaming), fall back to JSON
  const ndPath = path.join(dir, "train_augmented.ndjson");
  const jsonPath = path.join(dir, "train_augmented.json");
  let trainSamples;

  if (fs.existsSync(ndPath)) {
    trainSamples = await streamNdjson(ndPath);
  } else if (fs.existsSync(jsonPath)) {
    const data = readJson(jsonPath);
    trainSamples = data ? data.trainSamples || [] : [];
  } else {
    return null;
  }

  return {
    label: "fsl_unified_augmented",
    type: "alphabet",
    splits: { train: trainSamples, validation: [], test: [] },
    labels: null
  };
};

const loadHardCases = () => {
  if (!fs.existsSync(HARD_CASES_DIR)) return null;

  const data = readJson(path.join(HARD_CASES_DIR, "hard_cases.json"));
  const meta = readJson(path.join(HARD_CASES_DIR, "metadata.json"));

  if (!data || !data.samples) return null;

  return {
    label: "hard_cases",
    type: "alphabet",
    splits: { train: data.samples, validation: [], test: [] },
    labels: null,
    metadata: meta
  };
};

const loadFs105 = () => {
  const dir = path.join(PROCESSED_DIR, "fsl_105");
  if (!fs.existsSync(dir)) return null;

  const train = readJson(path.join(dir, "train.json"));
  const test = readJson(path.join(dir, "test.json"));

  if (!train || !test) return null;

  return {
    label: "fsl_105",
    type: "phrase",
    splits: { train: train.samples, validation: [], test: test.samples },
    labels: readJson(path.join(dir, "labels.json")).labels
  };
};

const normalizeSample = (raw, datasetLabel, vocabulary) => {
  const label = fixLabel(raw.label);
  if (!(label in vocabulary)) {
    console.warn(`  [${datasetLabel}] Skipping unknown label: "${raw.label}" → fixed: "${label}"`);
    return null;
  }

  let sequence = raw.sequence;
  if (!Array.isArray(sequence) || sequence.length === 0) {
    console.warn(`  [${datasetLabel}] Empty sequence for ${label}`);
    return null;
  }

  if (sequence[0] && Array.isArray(sequence[0]) && sequence[0].length !== FEATURE_DIMENSION) {
    console.warn(`  [${datasetLabel}] Feature dimension mismatch: ${sequence[0].length} vs ${FEATURE_DIMENSION}`);
    return null;
  }

  const paddedSequence = sequence.length >= SEQUENCE_LENGTH
    ? sequence.slice(0, SEQUENCE_LENGTH)
    : [...sequence, ...Array.from({ length: SEQUENCE_LENGTH - sequence.length }, () => new Array(FEATURE_DIMENSION).fill(0))];

  return {
    label,
    labelId: vocabulary[label],
    originalFrameCount: raw.originalFrameCount || paddedSequence.length,
    signerId: raw.signerId || "UNKNOWN",
    sessionId: raw.sessionId || "unknown",
    deviceType: raw.deviceType || "unknown",
    lighting: raw.lighting || "unknown",
    handedness: raw.handedness || "right",
    augmentationPreset: raw.augmentationPreset || null,
    originalFile: raw.originalFile || null,
    source: raw.source || datasetLabel,
    datasetOrigin: datasetLabel,
    sequence: paddedSequence
  };
};

const collectSamples = async () => {
  const datasets = [];
  const seen = new Set();
  const allSamples = [];
  const stats = {};

  const kaggleV2 = await loadKaggleV2();
  if (kaggleV2) {
    console.log(`\n=== fsl_alphabet_kaggle_v2 ===`);
    console.log(`  labels: ${kaggleV2.labels.length} (a-z)`);
    for (const split of ["train", "validation", "test"]) {
      console.log(`  ${split}: ${kaggleV2.splits[split].length}`);
    }
    datasets.push(kaggleV2);
  }

  const fsl105 = loadFs105();
  if (fsl105) {
    console.log(`\n=== fsl_105 ===`);
    console.log(`  labels: ${fsl105.labels.length} (phrases)`);
    for (const split of ["train", "validation", "test"]) {
      console.log(`  ${split}: ${fsl105.splits[split].length}`);
    }
    datasets.push(fsl105);
  }

  const augmented = await loadAugmented();
  if (augmented) {
    console.log(`\n=== fsl_unified_augmented ===`);
    console.log(`  total: ${augmented.splits.train.length}`);
    datasets.push(augmented);
  }

  const hardCases = loadHardCases();
  if (hardCases) {
    console.log(`\n=== hard_cases ===`);
    console.log(`  total: ${hardCases.splits.train.length}`);
    if (hardCases.metadata) {
      console.log(`  confusion pairs: ${Object.keys(hardCases.metadata.pairs).length}`);
    }
    datasets.push(hardCases);
  }

  console.log(`\n=== Normalizing samples ===`);
  for (const ds of datasets) {
    let dsCount = 0;
    let dsSkipped = 0;
    for (const split of ["train", "validation", "test"]) {
      for (const raw of ds.splits[split]) {
        const normalized = normalizeSample(raw, ds.label, labelToId);
        if (!normalized) { dsSkipped++; continue; }

        const dk = makeDedupKey(normalized);
        if (seen.has(dk)) {
          dsSkipped++;
          continue;
        }
        seen.add(dk);
        allSamples.push(normalized);
        dsCount++;
      }
    }
    console.log(`  ${ds.label}: ${dsCount} samples kept (${dsSkipped} skipped)`);
    stats[ds.label] = { kept: dsCount, skipped: dsSkipped };
  }

  return { samples: allSamples, stats };
};

const splitStratified = (samples, vocabulary) => {
  const grouped = {};
  for (const s of samples) {
    if (!grouped[s.label]) grouped[s.label] = [];
    grouped[s.label].push(s);
  }

  const train = [];
  const validation = [];
  const test = [];

  for (const label of vocabulary) {
    const group = grouped[label];
    if (!group || group.length === 0) continue;

    const rng = mulberry32(RANDOM_SEED + labelToId[label]);
    const shuffled = shuffle([...group], rng);
    const total = shuffled.length;

    let testCount = Math.max(1, Math.round(total * 0.15));
    let valCount = Math.max(1, Math.round(total * 0.15));

    if (testCount + valCount >= total) {
      testCount = Math.max(1, Math.floor(total * 0.15));
      valCount = Math.max(1, Math.floor(total * 0.15));
      if (testCount + valCount >= total) {
        valCount = Math.max(1, total - testCount - 1);
      }
    }

    const trainCount = total - testCount - valCount;

    train.push(...shuffled.slice(0, trainCount));
    validation.push(...shuffled.slice(trainCount, trainCount + valCount));
    test.push(...shuffled.slice(trainCount + valCount));
  }

  return { train, validation, test };
};

const writeNdjson = (filePath, samples) => {
  const fd = fs.openSync(filePath, "w");
  const encode = (str) => Buffer.from(str, "utf8");
  const write = (str) => fs.writeSync(fd, encode(str));

  const header = JSON.stringify({
    _header: true,
    sequenceLength: SEQUENCE_LENGTH,
    featureDimension: FEATURE_DIMENSION,
    totalSamples: samples.length,
    labels: UNIFIED_VOCABULARY
  });
  write(header + "\n");

  for (const s of samples) {
    write(JSON.stringify(s) + "\n");
  }
  fs.closeSync(fd);
};

const writeLargeJson = (filePath, samples) => {
  const fd = fs.openSync(filePath, "w");
  const encode = (str) => Buffer.from(str, "utf8");
  const write = (str) => fs.writeSync(fd, encode(str));

  write(`{\n  "sequenceLength": ${SEQUENCE_LENGTH},\n  "featureDimension": ${FEATURE_DIMENSION},\n  "samples": [\n`);

  for (let i = 0; i < samples.length; i++) {
    write(JSON.stringify(samples[i]));
    if (i < samples.length - 1) write(",\n");
    if ((i + 1) % 5000 === 0) console.log(`    ${path.basename(filePath)}: ${i + 1}/${samples.length}`);
  }

  write("\n  ]\n}\n");
  fs.closeSync(fd);
};

const main = async () => {
  console.log("=".repeat(60));
  console.log("  BUILD UNIFIED DATASET V4");
  console.log("  Merging all compatible datasets into fsl_unified_v4");
  console.log("=".repeat(60));

  console.log(`\nVocabulary: ${UNIFIED_VOCABULARY.length} total classes`);
  console.log(`  Alphabet: ${ALPHABET_LABELS.length} (a-z)`);
  console.log(`  Phrases: ${FSL_105_LABELS_ORDERED.length} (FSL-105)`);

  const { samples, stats } = await collectSamples();

  console.log(`\n=== Total unique samples: ${samples.length} ===`);

  const splits = splitStratified(samples, UNIFIED_VOCABULARY);

  console.log(`\n=== Split results ===`);
  console.log(`  Train: ${splits.train.length}`);
  console.log(`  Validation: ${splits.validation.length}`);
  console.log(`  Test: ${splits.test.length}`);
  console.log(`  Total: ${splits.train.length + splits.validation.length + splits.test.length}`);

  const perLabelCounts = {};
  for (const label of UNIFIED_VOCABULARY) {
    const count = samples.filter((s) => s.label === label).length;
    if (count > 0) perLabelCounts[label] = count;
  }

  const perLabelSplitCounts = {};
  for (const split of ["train", "validation", "test"]) {
    perLabelSplitCounts[split] = {};
    for (const label of UNIFIED_VOCABULARY) {
      const count = splits[split].filter((s) => s.label === label).length;
      if (count > 0) perLabelSplitCounts[split][label] = count;
    }
  }

  const signerCounts = {};
  for (const s of samples) {
    const sid = s.signerId;
    signerCounts[sid] = (signerCounts[sid] || 0) + 1;
  }

  const datasetOrigins = {};
  for (const s of samples) {
    const origin = s.datasetOrigin;
    datasetOrigins[origin] = (datasetOrigins[origin] || 0) + 1;
  }

  const labelsOut = {
    labels: UNIFIED_VOCABULARY,
    alphabetCount: ALPHABET_LABELS.length,
    phraseCount: FSL_105_LABELS_ORDERED.length,
    labelToId,
    idToLabel: Object.fromEntries(UNIFIED_VOCABULARY.map((l, i) => [String(i), l]))
  };

  console.log(`\n=== Writing ${OUTPUT_DIR} ===`);
  ensureDir(OUTPUT_DIR);

  fs.writeFileSync(path.join(OUTPUT_DIR, "labels.json"), JSON.stringify(labelsOut, null, 2));
  console.log("  labels.json written");

  const allSamplesList = [...splits.train, ...splits.validation, ...splits.test];

  for (const split of ["train", "validation", "test"]) {
    console.log(`\n  Writing ${split}...`);
    const jsonPath = path.join(OUTPUT_DIR, `${split}.json`);
    const ndPath = path.join(OUTPUT_DIR, `${split}.ndjson`);

    writeLargeJson(jsonPath, splits[split]);
    console.log(`    ${split}.json: ${splits[split].length} samples`);

    writeNdjson(ndPath, splits[split]);
    console.log(`    ${split}.ndjson: ${splits[split].length} samples`);
  }

  const metadata = {
    version: "4.0",
    description: "Unified dataset: fsl_alphabet_kaggle_v2 + fsl_105 + fsl_unified_augmented + hard_cases",
    builtAt: new Date().toISOString(),
    totalSamples: allSamplesList.length,
    totalClasses: UNIFIED_VOCABULARY.length,
    alphabetClasses: ALPHABET_LABELS.length,
    phraseClasses: FSL_105_LABELS_ORDERED.length,
    sequenceLength: SEQUENCE_LENGTH,
    featureDimension: FEATURE_DIMENSION,
    randomSeed: RANDOM_SEED,
    splitStrategy: "stratified-70-15-15",
    splitCounts: {
      train: splits.train.length,
      validation: splits.validation.length,
      test: splits.test.length
    },
    perLabelCounts,
    perLabelSplitCounts,
    signerCounts: Object.keys(signerCounts).length,
    signers: Object.keys(signerCounts).sort(),
    datasetOrigins,
    sourceDatasets: Object.keys(stats),
    perDatasetStats: stats,
    labelNormalization: {
      fixedLabels: ["WEELCHAIR PERSON → WHEELCHAIR PERSON"],
      fixedEncoding: ["Unicode right-quote → ASCII apostrophe in DON'T labels"]
    },
    mergedFrom: Object.keys(stats)
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, "metadata.json"), JSON.stringify(metadata, null, 2));
  console.log("  metadata.json written");

  console.log(`\n=== Summary ===`);
  console.log(`  Total samples: ${allSamplesList.length}`);
  console.log(`  Total classes: ${UNIFIED_VOCABULARY.length} (${ALPHABET_LABELS.length} alphabet + ${FSL_105_LABELS_ORDERED.length} phrases)`);
  console.log(`  Unique signers: ${Object.keys(signerCounts).length}`);
  console.log(`  Dataset origins: ${JSON.stringify(datasetOrigins)}`);
  console.log(`  Train/Val/Test: ${splits.train.length}/${splits.validation.length}/${splits.test.length}`);

  const minClass = Math.min(...Object.values(perLabelCounts));
  const maxClass = Math.max(...Object.values(perLabelCounts));
  console.log(`  Per-class range: ${minClass} - ${maxClass}`);

  console.log(`\n✓ Unified dataset v4 saved to ${OUTPUT_DIR}`);
};

main().catch((err) => { console.error("Build failed:", err); process.exit(1); });
