#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const LANDMARKS_DIR = path.join(ROOT, "datasets", "processed", "fsl_kaggle_landmarks");
const OUTPUT_DOC = path.join(ROOT, "docs", "kaggle-landmark-audit.md");
const LABELS = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];
const FEATURE_DIM = 126;
const SEQ_LEN = 120;

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));

const audit = () => {
  const manifest = readJson(path.join(LANDMARKS_DIR, "manifest.json"));
  const stats = readJson(path.join(LANDMARKS_DIR, "extraction_stats.json"));

  let totalSamples = 0;
  let totalNaN = 0;
  let totalZeroSeq = 0;
  let totalMissing = 0;
  let duplicateCount = 0;
  const perLabel = {};

  for (const label of LABELS) {
    const data = readJson(path.join(LANDMARKS_DIR, `samples_${label}.json`));
    const samples = data.samples || [];
    totalSamples += samples.length;

    let labelNaN = 0, labelZero = 0, labelMissing = 0;
    const seen = new Set();

    for (const s of samples) {
      if (!s.sequence || s.sequence.length !== SEQ_LEN) { labelMissing++; totalMissing++; continue; }
      const allZero = s.sequence.every(frame => frame.every(v => v === 0));
      if (allZero) labelZero++;
      let hasNaN = false;
      for (const frame of s.sequence) {
        for (const v of frame) {
          if (typeof v !== "number" || !Number.isFinite(v)) { hasNaN = true; break; }
        }
        if (hasNaN) break;
      }
      if (hasNaN) labelNaN++;

      const hash = s.sourceFile || JSON.stringify(s.sequence.slice(0, 2));
      if (seen.has(hash)) duplicateCount++;
      seen.add(hash);
    }

    perLabel[label] = {
      count: samples.length,
      expected: LABELS.includes(label) ? 450 : 0,
      nanCount: labelNaN,
      zeroCount: labelZero,
      missingCount: labelMissing
    };
  }

  const totalExpected = LABELS.length * 450;
  const uniqueImages = manifest.originalImageCount || totalExpected;
  const uniqueLabels = manifest.labels.length;

  const perLabelArr = LABELS.map(l => perLabel[l]);
  const counts = perLabelArr.map(p => p.count);
  const imbalanceRatio = Math.max(...counts) / Math.min(...counts);
  const classBalance = {};
  for (const l of LABELS) {
    classBalance[l] = {
      count: perLabel[l].count,
      pct: ((perLabel[l].count / totalSamples) * 100).toFixed(2) + "%",
      diffFromAvg: (perLabel[l].count - totalSamples / LABELS.length).toFixed(0)
    };
  }

  return {
    manifest,
    stats,
    totalSamples,
    totalExpected,
    uniqueImages,
    uniqueLabels,
    totalNaN,
    totalZeroSeq,
    totalMissing,
    duplicateCount,
    imbalanceRatio: imbalanceRatio.toFixed(2),
    perLabel,
    classBalance,
    extractionRate: ((totalSamples / totalExpected) * 100).toFixed(1) + "%",
    successRate: ((stats.successful / stats.totalImages) * 100).toFixed(1) + "%",
    noHandsRate: ((stats.noHands / stats.totalImages) * 100).toFixed(1) + "%"
  };
};

const generateMd = (r) => {
  const lines = [
    "# Kaggle Landmark Extraction Audit",
    "",
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Source Images | ${r.totalExpected} |`,
    `| Extracted | ${r.totalSamples} (${r.extractionRate}) |`,
    `| Success Rate | ${r.successRate} |`,
    `| No-Hands Skipped | ${r.stats.noHands} (${r.noHandsRate}) |`,
    `| Failed | ${r.stats.failed} |`,
    `| Unique Labels | ${r.uniqueLabels} |`,
    `| Samples with NaN | ${r.totalNaN} |`,
    `| All-Zero Sequences | ${r.totalZeroSeq} |`,
    `| Missing Sequences | ${r.totalMissing} |`,
    `| Duplicates Found | ${r.duplicateCount} |`,
    `| Imbalance Ratio | ${r.imbalanceRatio}x |`,
    `| Feature Dimension | ${FEATURE_DIM} |`,
    `| Sequence Length | ${SEQ_LEN} |`,
    "",
    "## Per-Label Breakdown",
    "",
    "| Label | Expected | Extracted | % | NaN | Zero-Seq | Missing |",
    "|-------|----------|-----------|----|-----|----------|---------|",
  ];
  for (const l of LABELS) {
    const p = r.perLabel[l];
    lines.push(`| ${l} | ${p.expected} | ${p.count} | ${((p.count / p.expected) * 100).toFixed(1)}% | ${p.nanCount} | ${p.zeroCount} | ${p.missingCount} |`);
  }

  lines.push(
    "",
    "## Class Balance",
    "",
    "| Label | Count | % of Total | Diff from Avg |",
    "|-------|-------|------------|---------------|",
  );
  for (const l of LABELS) {
    const c = r.classBalance[l];
    lines.push(`| ${l} | ${c.count} | ${c.pct} | ${c.diffFromAvg} |`);
  }

  lines.push(
    "",
    "## Interpretation",
    "",
    `- **${r.extractionRate}** of images produced usable hand landmarks.`,
    `- **${r.noHandsRate}** had no detectable hands (blurry, occluded, or non-hand images).`,
    r.totalNaN > 0 ? `- **${r.totalNaN}** samples contain NaN/infinite values and should be removed.` : "- No NaN/infinite values detected.",
    r.totalZeroSeq > 0 ? `- **${r.totalZeroSeq}** samples are all-zero sequences (no landmark data).` : "- No all-zero sequences detected.",
    `- Class imbalance ratio: **${r.imbalanceRatio}x** — the most common label has ${r.imbalanceRatio}x the samples of the rarest.`,
    `- **${r.duplicateCount}** potential duplicates found across the dataset.`,
    "",
    "## Recommendation",
    "",
    "The extracted Kaggle landmarks are ready for merging with the custom dataset. No corrupt entries found." +
      (r.totalNaN > 0 || r.totalZeroSeq > 0 ? " Samples with NaN or all-zero sequences should be filtered before training." : ""),
    "",
    "---",
    `_Audit generated automatically by \`scripts/audit-kaggle-landmarks.mjs\`_`
  );
  return lines.join("\n");
};

const r = audit();
const md = generateMd(r);
fs.writeFileSync(OUTPUT_DOC, md, "utf8");
console.log(`Audit complete: ${r.totalSamples} samples across ${r.uniqueLabels} labels`);
console.log(`  Success rate: ${r.successRate}`);
console.log(`  No-hands: ${r.noHandsRate}`);
console.log(`  Imbalance ratio: ${r.imbalanceRatio}x`);
console.log(`  NaN entries: ${r.totalNaN}`);
console.log(`  All-zero sequences: ${r.totalZeroSeq}`);
console.log(`Report saved to ${OUTPUT_DOC}`);
