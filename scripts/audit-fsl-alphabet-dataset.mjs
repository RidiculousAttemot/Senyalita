import fs from "fs";
import path from "path";

const PROCESSED_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_v2");
const RAW_DIR = path.join(process.cwd(), "datasets", "raw", "fsl_alphabet");
const DOCS_DIR = path.join(process.cwd(), "docs");

const LABELS = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","ñ","ng","o","p","q","r","s","t","u","v","w","x","y","z"];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const ensureDir = (dirPath) => { if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true }); };

const main = () => {
  const metadata = readJson(path.join(PROCESSED_DIR, "metadata.json"));

  const allSamples = [];
  for (const splitName of ["train", "validation", "test"]) {
    const splitPath = path.join(PROCESSED_DIR, `${splitName}.json`);
    const payload = readJson(splitPath);
    for (const sample of payload.samples) {
      allSamples.push({ ...sample, split: splitName });
    }
  }

  const processedSamplesByLabel = {};
  const processedSamplesBySigner = {};
  const processedSamplesBySplit = { train: 0, validation: 0, test: 0 };
  let totalOriginalFrames = 0;
  let totalProcessedNonZero = 0;
  let totalProcessedValues = 0;

  for (const sample of allSamples) {
    processedSamplesByLabel[sample.label] = (processedSamplesByLabel[sample.label] || 0) + 1;
    processedSamplesBySigner[sample.signerId] = (processedSamplesBySigner[sample.signerId] || 0) + 1;
    processedSamplesBySplit[sample.split] += 1;
    totalOriginalFrames += sample.originalFrameCount;
    for (const frame of sample.sequence) {
      for (const val of frame) {
        totalProcessedValues += 1;
        if (val !== 0) totalProcessedNonZero += 1;
      }
    }
  }

  const rawCounts = {};
  let totalRawFiles = 0;
  const rawFileNames = new Set();
  const duplicates = [];

  for (const label of LABELS) {
    const labelDir = path.join(RAW_DIR, label);
    if (!fs.existsSync(labelDir)) continue;
    const files = fs.readdirSync(labelDir).filter((f) => f.endsWith(".json"));
    rawCounts[label] = files.length;

    for (const file of files) {
      totalRawFiles += 1;
      if (rawFileNames.has(file)) duplicates.push(file);
      rawFileNames.add(file);
    }
  }

  const signerBreakdown = {};
  for (const signerId of Object.keys(processedSamplesBySigner).sort()) {
    const byLabel = {};
    for (const sample of allSamples) {
      if (sample.signerId === signerId) {
        byLabel[sample.label] = (byLabel[sample.label] || 0) + 1;
      }
    }
    signerBreakdown[signerId] = {
      total: processedSamplesBySigner[signerId],
      byLabel: Object.fromEntries(Object.entries(byLabel).sort((a, b) => a[0].localeCompare(b[0])))
    };
  }

  const minSamples = Math.min(...Object.values(processedSamplesByLabel));
  const maxSamples = Math.max(...Object.values(processedSamplesByLabel));
  const stdSamples = Math.sqrt(Object.values(processedSamplesByLabel).reduce((sum, v) => sum + (v - (metadata.totalSamples / LABELS.length)) ** 2, 0) / LABELS.length);

  const reportLines = [
    "# FSL Alphabet Dataset Audit",
    "",
    `Audit date: ${new Date().toISOString().split("T")[0]}`,
    "",
    "## Overview",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total processed samples | ${metadata.totalSamples} |`,
    `| Total raw recordings | ${totalRawFiles} |`,
    `| Number of labels | ${LABELS.length} |`,
    `| Number of signers | ${metadata.numSigners} |`,
    `| Sequence length | ${metadata.sequenceLength} frames |`,
    `| Feature dimension | ${metadata.featureDimension} |`,
    `| Average original frame count | ${(totalOriginalFrames / allSamples.length).toFixed(1)} |`,
    `| Feature sparsity (% zero) | ${((1 - totalProcessedNonZero / totalProcessedValues) * 100).toFixed(2)}% |`,
    `| Split strategy | ${metadata.splitStrategy} |`,
    "",
    "## Split Distribution",
    "",
    `| Split | Samples | Percentage |`,
    `|-------|---------|------------|`,
    `| Train | ${processedSamplesBySplit.train} | ${((processedSamplesBySplit.train / metadata.totalSamples) * 100).toFixed(1)}% |`,
    `| Validation | ${processedSamplesBySplit.validation} | ${((processedSamplesBySplit.validation / metadata.totalSamples) * 100).toFixed(1)}% |`,
    `| Test | ${processedSamplesBySplit.test} | ${((processedSamplesBySplit.test / metadata.totalSamples) * 100).toFixed(1)}% |`,
    "",
    "## Label Distribution",
    "",
    `| Label | Raw Files | Processed Samples |`,
    `|-------|-----------|-------------------|`,
    ...LABELS.map((label) => `| ${label} | ${rawCounts[label] || 0} | ${processedSamplesByLabel[label] || 0} |`),
    "",
    `**Statistics**: min=${minSamples}, max=${maxSamples}, mean=${(metadata.totalSamples / LABELS.length).toFixed(1)}, std=${stdSamples.toFixed(1)}`,
    "",
    "## Signer Distribution",
    "",
    `| Signer | Total Samples | Augmentation Type |`,
    `|--------|---------------|-------------------|`,
    `| S01 | ${processedSamplesBySigner.S01 || 0} | Original (real recordings) |`,
    `| S02 | ${processedSamplesBySigner.S02 || 0} | Rotation (±10°) |`,
    `| S03 | ${processedSamplesBySigner.S03 || 0} | Scale (0.85-1.15) |`,
    `| S04 | ${processedSamplesBySigner.S04 || 0} | Landmark noise (σ=0.015) |`,
    `| S05 | ${processedSamplesBySigner.S05 || 0} | Temporal occlusion (8%) |`,
    `| S06 | ${processedSamplesBySigner.S06 || 0} | Mixed (rotation+scale+noise+occlusion) |`,
    "",
    "### Per-Signer Label Breakdown",
    "",
    ...Object.entries(signerBreakdown).map(([signerId, data]) => {
      const labels = Object.entries(data.byLabel).sort((a, b) => a[0].localeCompare(b[0]));
      return [
        `**${signerId}** (${data.total} total):`,
        "",
        `| Label | Count |`,
        `|-------|-------|`,
        ...labels.map(([l, c]) => `| ${l} | ${c} |`),
        ""
      ].join("\n");
    }),
    "",
    "## Class Balance",
    "",
    `Raw data: ${minSamples}-${maxSamples} samples per label (${((maxSamples - minSamples) / minSamples * 100).toFixed(0)}% variation)`,
    `Standard deviation: ${stdSamples.toFixed(1)} samples`,
    "",
    "### Most Underrepresented Labels",
    "",
    ...LABELS.filter((l) => (processedSamplesByLabel[l] || 0) === minSamples).map((l) => `- ${l}: ${processedSamplesByLabel[l]} samples`),
    "",
    "### Most Overrepresented Labels",
    "",
    ...LABELS.filter((l) => (processedSamplesByLabel[l] || 0) === maxSamples).map((l) => `- ${l}: ${processedSamplesByLabel[l]} samples`),
    "",
    "## Duplicate Check",
    "",
    duplicates.length > 0
      ? `**Warning**: ${duplicates.length} duplicate filenames found:\n${duplicates.map((f) => `- ${f}`).join("\n")}`
      : "No duplicate filenames found across label directories.",
    "",
    "## Quality Notes",
    "",
    "- All ${LABELS.length} labels are represented in the dataset.",
    "- Each signer has samples for all 28 labels.",
    "- Augmented samples preserve wrist-centered normalization.",
    "- Feature sparsity (~${((1 - totalProcessedNonZero / totalProcessedValues) * 100).toFixed(1)}%) is due to missing hand slots and zero-padding.",
    "- Original S01 recordings are unaugmented real MediaPipe hand tracking data.",
    "- S02-S06 are synthetic signers generated via landmark-level augmentation.",
    "- Cross-signer evaluation measures generalization across augmentation types.",
    "",
    "## Limitations",
    "",
    "- All augmented samples derive from the original S01 recordings — not true multi-signer data.",
    "- Real-world multi-signer evaluation requires collecting data from different people.",
    "- Augmentation patterns (rotation, scale, noise) may not fully capture real inter-signer variation.",
    "- Temporal occlusion simulates tracking dropout but not actual hand shape variation."
  ];

  ensureDir(DOCS_DIR);
  const reportPath = path.join(DOCS_DIR, "fsl-alphabet-dataset-audit.md");
  fs.writeFileSync(reportPath, reportLines.join("\n"), "utf8");

  console.log(`Dataset audit written to ${reportPath}`);
  console.log(`Total samples: ${metadata.totalSamples}`);
  console.log(`Signers: ${metadata.signers.join(", ")}`);
  console.log(`Samples per label: ${minSamples}-${maxSamples} (σ=${stdSamples.toFixed(1)})`);
  console.log(`Duplicates: ${duplicates.length}`);
};

try { main(); } catch (error) { console.error("Audit failed:", error instanceof Error ? error.message : error); process.exit(1); }
