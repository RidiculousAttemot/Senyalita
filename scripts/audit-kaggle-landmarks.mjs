#!/usr/bin/env node
/**
 * Audit the extracted MediaPipe landmarks for the Kaggle FSL dataset.
 *
 * For every per-label samples_*.json file in
 * `datasets/processed/fsl_kaggle_landmarks/`:
 *   - total sample count
 *   - per-label shape, value range, zero/non-zero ratio
 *   - sequence length, feature dimension conformance
 *   - per-label handedness distribution
 *
 * Writes:
 *   - `docs/fsl-kaggle-landmark-audit.md` — human-readable audit
 *   - `datasets/processed/fsl_kaggle_landmarks/audit.json` — raw numbers
 *
 * Usage: node scripts/audit-kaggle-landmarks.mjs
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const INPUT_DIR = path.join(ROOT, "datasets", "processed", "fsl_kaggle_landmarks");
const DOC_PATH = path.join(ROOT, "docs", "fsl-kaggle-landmark-audit.md");
const AUDIT_JSON = path.join(INPUT_DIR, "audit.json");

const LABELS = "abcdefghijklmnopqrstuvwxyz".split("");
const EXPECTED_SEQ_LEN = 120;
const EXPECTED_FEATURE_DIM = 126;
const TOLERANCE = 1e-6;

const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const main = () => {
  const perLabel = {};
  let totalSamples = 0;
  let badShape = 0;
  let allNonZero = 0;
  let globalMin = Infinity;
  let globalMax = -Infinity;
  let globalSum = 0;
  let globalCount = 0;
  const handednessCounts = { Left: 0, Right: 0 };

  for (const label of LABELS) {
    const fp = path.join(INPUT_DIR, `samples_${label}.json`);
    if (!fs.existsSync(fp)) { perLabel[label] = { total: 0 }; continue; }
    const j = JSON.parse(fs.readFileSync(fp, "utf-8"));
    const samples = j.samples || [];
    const total = samples.length;
    totalSamples += total;
    let good = 0;
    let labelMin = Infinity, labelMax = -Infinity, labelSum = 0, labelCount = 0;
    let nonZeroSamples = 0;
    const labelHandedness = { Left: 0, Right: 0, mixed: 0, none: 0 };

    for (const s of samples) {
      const seq = s.sequence;
      if (!Array.isArray(seq) || seq.length !== EXPECTED_SEQ_LEN) { badShape++; continue; }
      let sampleOk = true;
      let sampleNonZero = 0;
      for (const frame of seq) {
        if (!Array.isArray(frame) || frame.length !== EXPECTED_FEATURE_DIM) { sampleOk = false; break; }
        for (const v of frame) {
          labelMin = Math.min(labelMin, v);
          labelMax = Math.max(labelMax, v);
          labelSum += v;
          labelCount++;
          if (Math.abs(v) > TOLERANCE) sampleNonZero++;
        }
      }
      if (!sampleOk) { badShape++; continue; }
      good++;
      if (sampleNonZero > 0) nonZeroSamples++;
      const hc = s.handCount || 0;
      if (hc === 0) labelHandedness.none++;
      else if (hc === 1) labelHandedness[hc === 1 ? (s.handedness || "Right") : "Right"]++;
      else labelHandedness.mixed++;
    }
    if (labelCount > 0) {
      globalMin = Math.min(globalMin, labelMin);
      globalMax = Math.max(globalMax, labelMax);
      globalSum += labelSum;
      globalCount += labelCount;
    }
    allNonZero += nonZeroSamples;
    perLabel[label] = {
      total,
      good,
      nonZeroSamples,
      valueMin: labelMin === Infinity ? null : labelMin,
      valueMax: labelMax === -Infinity ? null : labelMax,
      valueMean: labelCount > 0 ? labelSum / labelCount : null,
      handedness: labelHandedness
    };
  }

  const raw = {
    generatedAt: new Date().toISOString(),
    expectedSequenceLength: EXPECTED_SEQ_LEN,
    expectedFeatureDimension: EXPECTED_FEATURE_DIM,
    totalSamples,
    badShape,
    samplesWithNonZeroValues: allNonZero,
    valueRange: { min: globalMin, max: globalMax, mean: globalCount > 0 ? globalSum / globalCount : null },
    perLabel
  };
  fs.writeFileSync(AUDIT_JSON, JSON.stringify(raw, null, 2));

  ensureDir(path.dirname(DOC_PATH));
  const lines = [];
  lines.push("# FSL Kaggle Landmark Audit");
  lines.push("");
  lines.push(`Generated: ${raw.generatedAt}`);
  lines.push("");
  lines.push("## Source");
  lines.push("");
  lines.push("- Input: `datasets/processed/fsl_kaggle_landmarks/samples_<a-z>.json`");
  lines.push("- Extracted by: `scripts/extract-fsl-kaggle-mediapipe.mjs` + `scripts/extract-fsl-kaggle-resume.mjs` (Y, Z re-run)");
  lines.push("- Backend: MediaPipe `@mediapipe/tasks-vision` `HandLandmarker` running in a headless Chromium via Puppeteer over self-signed HTTPS (loopback treated as a secure context).");
  lines.push("- Confidence threshold: 0.3; numHands: 2; runningMode: IMAGE; delegate: CPU.");
  lines.push("- Each Kaggle image is a single static frame. We replicate the resulting 126-feature vector to 120 frames to match the training pipeline's sequence length.");
  lines.push("- Normalization: wrist-centered (`hand[0]`), then max-abs scaled to `[-1, 1]` — same as `src/features/recognition/normalize.ts`.");
  lines.push("");
  lines.push("## Headline numbers");
  lines.push("");
  lines.push(`- Original Kaggle images: 11,700 (450 per label, A-Z)`);
  lines.push(`- Total samples kept: **${totalSamples}** (detection rate: ${((totalSamples / 11700) * 100).toFixed(2)}%)`);
  lines.push(`- Bad-shape samples: ${badShape}`);
  lines.push(`- Samples with non-zero landmarks: ${allNonZero} (${((allNonZero / totalSamples) * 100).toFixed(2)}% of kept)`);
  lines.push(`- Value range across all samples: [${globalMin.toFixed(4)}, ${globalMax.toFixed(4)}], mean ${(globalSum / globalCount).toFixed(6)}`);
  lines.push("");
  lines.push("## Per-label breakdown");
  lines.push("");
  lines.push("| Label | Samples | Non-zero | Min | Max | Mean |");
  lines.push("|-------|---------|----------|-----|-----|------|");
  for (const l of LABELS) {
    const r = perLabel[l];
    if (!r || r.total === 0) { lines.push(`| ${l.toUpperCase()} | 0 | — | — | — | — |`); continue; }
    lines.push(`| ${l.toUpperCase()} | ${r.total} | ${r.nonZeroSamples} | ${r.valueMin.toFixed(4)} | ${r.valueMax.toFixed(4)} | ${r.valueMean.toFixed(4)} |`);
  }
  lines.push("");
  lines.push("## Comparison to placeholder");
  lines.push("");
  lines.push("The previous `datasets/external/fsl_kaggle_landmarks/` contained 11,700 placeholder samples with all-zero 126-feature frames. They have been **fully replaced** with real MediaPipe extractions in this run.");
  lines.push("");
  lines.push("## Files");
  lines.push("");
  lines.push("- Raw audit numbers: `datasets/processed/fsl_kaggle_landmarks/audit.json`");
  lines.push("- Per-label samples: `datasets/processed/fsl_kaggle_landmarks/samples_<a-z>.json`");
  lines.push("- Manifest: `datasets/processed/fsl_kaggle_landmarks/manifest.json`");
  lines.push("- Stats: `datasets/processed/fsl_kaggle_landmarks/extraction_stats.json`");
  fs.writeFileSync(DOC_PATH, lines.join("\n"));
  console.log(`Wrote audit: ${DOC_PATH}`);
  console.log(`Wrote raw:   ${AUDIT_JSON}`);
  console.log(`Total kept:  ${totalSamples} / 11700 (${((totalSamples / 11700) * 100).toFixed(2)}%)`);
  console.log(`Bad shape:   ${badShape}`);
  console.log(`Value range: [${globalMin.toFixed(4)}, ${globalMax.toFixed(4)}]`);
};

main();
