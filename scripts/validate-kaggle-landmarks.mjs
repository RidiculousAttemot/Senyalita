#!/usr/bin/env node
/**
 * Validate the extracted Kaggle FSL landmarks for the training pipeline.
 *
 * Checks for every sample:
 *   - sequence.length === 120
 *   - each frame.length === 126
 *   - no NaN, no Infinity
 *   - not all-zero (i.e. contains real landmark data)
 *   - valid label and labelId (labelId must be 0-25)
 *   - value range within [-1.5, 1.5] (allows tiny floating point slack)
 *
 * Removes invalid samples in-place. Writes:
 *   - `docs/fsl-kaggle-filtered-samples.md` — human-readable filter report
 *   - `datasets/processed/fsl_kaggle_landmarks/validation.json` — raw counts
 *
 * Usage: node scripts/validate-kaggle-landmarks.mjs
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const INPUT_DIR = path.join(ROOT, "datasets", "processed", "fsl_kaggle_landmarks");
const DOC_PATH = path.join(ROOT, "docs", "fsl-kaggle-filtered-samples.md");
const REPORT_JSON = path.join(INPUT_DIR, "validation.json");

const LABELS = "abcdefghijklmnopqrstuvwxyz".split("");
const EXPECTED_SEQ_LEN = 120;
const EXPECTED_FEATURE_DIM = 126;
const MIN_NONZERO = 6; // any hand would have 21*3 = 63 non-zero, 6 is the bar for "not all zero"
const VALUE_LO = -1.5;
const VALUE_HI = 1.5;

const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const main = () => {
  const perLabel = {};
  let kept = 0, removed = 0;
  const reasons = { badShape: 0, nan: 0, allZero: 0, badLabel: 0, badValue: 0 };

  for (const label of LABELS) {
    const fp = path.join(INPUT_DIR, `samples_${label}.json`);
    if (!fs.existsSync(fp)) { perLabel[label] = { original: 0, kept: 0, removed: 0, reasons: {} }; continue; }
    const j = JSON.parse(fs.readFileSync(fp, "utf-8"));
    const original = (j.samples || []).length;
    const good = [];
    const localReasons = { badShape: 0, nan: 0, allZero: 0, badLabel: 0, badValue: 0 };

    for (const s of j.samples) {
      const seq = s.sequence;
      if (!Array.isArray(seq) || seq.length !== EXPECTED_SEQ_LEN) { localReasons.badShape++; continue; }
      let badShape = false, badValue = false, nanFound = false;
      let nonZero = 0;
      for (const frame of seq) {
        if (!Array.isArray(frame) || frame.length !== EXPECTED_FEATURE_DIM) { badShape = true; break; }
        for (const v of frame) {
          if (Number.isNaN(v) || !Number.isFinite(v)) { nanFound = true; break; }
          if (v < VALUE_LO || v > VALUE_HI) badValue = true;
          if (Math.abs(v) > 1e-6) nonZero++;
        }
        if (badShape || nanFound) break;
      }
      if (badShape) { localReasons.badShape++; continue; }
      if (nanFound) { localReasons.nan++; continue; }
      if (nonZero < MIN_NONZERO) { localReasons.allZero++; continue; }
      if (badValue) { localReasons.badValue++; continue; }
      if (typeof s.label !== "string" || LABELS.indexOf(s.label) === -1) { localReasons.badLabel++; continue; }
      if (typeof s.labelId !== "number" || s.labelId < 0 || s.labelId > 25) { localReasons.badLabel++; continue; }
      good.push(s);
    }

    j.totalSamples = good.length;
    j.samples = good;
    fs.writeFileSync(fp, JSON.stringify(j, null, 2));

    perLabel[label] = { original, kept: good.length, removed: original - good.length, reasons: localReasons };
    kept += good.length;
    removed += original - good.length;
    for (const k of Object.keys(localReasons)) reasons[k] = (reasons[k] || 0) + localReasons[k];
  }

  const report = {
    generatedAt: new Date().toISOString(),
    expectedSequenceLength: EXPECTED_SEQ_LEN,
    expectedFeatureDimension: EXPECTED_FEATURE_DIM,
    minNonZero: MIN_NONZERO,
    valueRange: [VALUE_LO, VALUE_HI],
    totals: { kept, removed, reasons },
    perLabel
  };
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  ensureDir(path.dirname(DOC_PATH));
  const lines = [];
  lines.push("# FSL Kaggle Filtered Samples Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Validation rules");
  lines.push("");
  lines.push(`- \`sequence.length === ${EXPECTED_SEQ_LEN}\``);
  lines.push(`- Each frame has exactly \`${EXPECTED_FEATURE_DIM}\` features`);
  lines.push(`- No \`NaN\` or \`Infinity\``);
  lines.push(`- At least \`${MIN_NONZERO}\` non-zero values in the whole sequence (one real hand has 63)`);
  lines.push(`- All values within \`[${VALUE_LO}, ${VALUE_HI}]\``);
  lines.push(`- \`label\` ∈ [a-z], \`labelId\` ∈ [0-25]`);
  lines.push("");
  lines.push("## Headline");
  lines.push("");
  lines.push(`- Samples kept: **${kept}**`);
  lines.push(`- Samples removed: ${removed}`);
  lines.push(`- Reasons:`);
  for (const [k, v] of Object.entries(reasons)) lines.push(`  - \`${k}\`: ${v}`);
  lines.push("");
  lines.push("## Per-label");
  lines.push("");
  lines.push("| Label | Original | Kept | Removed |");
  lines.push("|-------|----------|------|---------|");
  for (const l of LABELS) {
    const r = perLabel[l];
    lines.push(`| ${l.toUpperCase()} | ${r.original} | ${r.kept} | ${r.removed} |`);
  }
  lines.push("");
  lines.push("## Files");
  lines.push("");
  lines.push("- Per-label samples (overwritten in place): `datasets/processed/fsl_kaggle_landmarks/samples_<a-z>.json`");
  lines.push("- Raw report: `datasets/processed/fsl_kaggle_landmarks/validation.json`");
  fs.writeFileSync(DOC_PATH, lines.join("\n"));
  console.log(`Wrote validation: ${DOC_PATH}`);
  console.log(`Wrote raw:        ${REPORT_JSON}`);
  console.log(`Kept ${kept}, removed ${removed}`);
};

main();
