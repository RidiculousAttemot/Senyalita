import fs from "fs";
import path from "path";

const DOCS_DIR = path.join(process.cwd(), "docs");
fs.mkdirSync(DOCS_DIR, { recursive: true });

const cm = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "models/fsl_unified/bilstm/confusion_matrix.json"), "utf8"
));
const metrics = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "models/fsl_unified/bilstm/metrics.json"), "utf8"
));

const numLabels = cm.labels.length;
const matrix = cm.matrix;
const correct = new Array(numLabels).fill(0);
const predicted = new Array(numLabels).fill(0);
const actual = new Array(numLabels).fill(0);
for (let i = 0; i < numLabels; i++) {
  for (let j = 0; j < numLabels; j++) {
    const count = matrix[i][j] || 0;
    if (i === j) correct[i] += count;
    predicted[j] += count;
    actual[i] += count;
  }
}

const allLabels = cm.labels.map((label, i) => {
  const prec = predicted[i] > 0 ? correct[i] / predicted[i] : 0;
  const rec = actual[i] > 0 ? correct[i] / actual[i] : 0;
  const f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0;
  let maxConf = 0, maxIdx = -1;
  for (let j = 0; j < numLabels; j++) {
    if (i !== j && matrix[i][j] > maxConf) {
      maxConf = matrix[i][j];
      maxIdx = j;
    }
  }
  return { label, support: actual[i], precision: prec, recall: rec, f1, topConfusion: maxIdx >= 0 ? { target: cm.labels[maxIdx], count: maxConf } : null };
});

const lowF1 = allLabels.filter(l => l.f1 < 0.50).sort((a, b) => a.f1 - b.f1);

// Categorize each low-F1 label
const remediations = {
  "IM FINE": { type: "confusion", detail: "Confused with HELLO (3/4 errors). Both are greeting responses collected from single signer. Need more samples with distinct motion patterns.", difficulty: "medium" },
  "RED": { type: "low-support", detail: "Only 4 test samples, confused with PINK. Color terms have similar hand positions (tapping chin).", difficulty: "medium" },
  "SEVEN": { type: "low-support", detail: "Only 4 test samples, confused with FOUR. Numbers 1-10 are single-hand gestures with subtle finger differences.", difficulty: "hard" },
  "APRIL": { type: "low-support", detail: "Only 4 test samples, 3 confused with AUGUST. Calendar terms have similar signing structure (first letter + motion).", difficulty: "hard" },
  "JANUARY": { type: "low-support", detail: "Only 4 test samples, confused with JULY. Both start with J-handshape.", difficulty: "medium" },
  "JULY": { type: "low-support", detail: "Only 4 test samples, confused with JUNE. Both start with J-handshape near chin.", difficulty: "medium" },
  "FATHER": { type: "low-support", detail: "Only 4 test samples. Single confusion with SIX confirms low support, not actual similarity.", difficulty: "easy" },
  "MOTHER": { type: "low-support", detail: "Only 4 test samples. Single confusion with TWO confirms low support.", difficulty: "easy" },
  "FOUR": { type: "low-support", detail: "Only 4 test samples, confused with TWO. Both are one-hand number gestures.", difficulty: "easy" },
  "NINE": { type: "low-support", detail: "Only 4 test samples, confused with FOUR. Number system confusion.", difficulty: "easy" },
  "BLUE": { type: "low-support", detail: "Only 4 test samples, confused with HELLO. Very different gestures - suggests noise from low support.", difficulty: "easy" }
};

let doc = `# Low-F1 Recovery Analysis

Generated: ${new Date().toISOString().split("T")[0]}

## Summary

Overall model macro F1: **${(metrics.macroF1 * 100).toFixed(2)}%**
Labels with F1 < 0.50: **${lowF1.length}** of ${numLabels}

## Per-Label Analysis

| Label | Support | Precision | Recall | F1 | Top Confusion | Impact Score |
|-------|:-------:|:---------:|:------:|:-:|:-------------:|:----------:|
`;

// Compute impact score: (1 - f1) * log(support + 1) — prioritizes poor performance on reasonable support
for (const l of lowF1) {
  l.impactScore = ((1 - l.f1) * Math.log(l.support + 1)).toFixed(3);
  const rem = remediations[l.label] || { type: "unknown", detail: "Low support sample", difficulty: "unknown" };
  doc += `| ${l.label} | ${l.support} | ${(l.precision*100).toFixed(1)}% | ${(l.recall*100).toFixed(1)}% | ${(l.f1*100).toFixed(1)}% | ${l.topConfusion ? `${l.topConfusion.target} (${l.topConfusion.count})` : "none"} | ${l.impactScore} |\n`;
}

doc += `\n## Detailed Remediation Plan

`;

for (const l of lowF1) {
  const rem = remediations[l.label] || { type: "unknown", detail: "Low support", difficulty: "unknown" };
  doc += `### ${l.label} (F1: ${(l.f1*100).toFixed(1)}%)\n\n`;
  doc += `- **Support**: ${l.support} test samples\n`;
  doc += `- **Precision**: ${(l.precision*100).toFixed(1)}% | **Recall**: ${(l.recall*100).toFixed(1)}%\n`;
  doc += `- **Top Confusion**: ${l.topConfusion ? `${l.topConfusion.target} (${l.topConfusion.count} errors)` : "none"}\n`;
  doc += `- **Diagnosis**: ${rem.detail}\n`;
  doc += `- **Difficulty**: ${rem.difficulty}\n`;
  if (rem.type === "low-support") {
    doc += `- **Remediation**: Collect 5-10 more samples from at least 3 signers. This is primarily a data quantity issue.\n`;
  } else if (rem.type === "confusion") {
    doc += `- **Remediation**: Collect targeted samples emphasizing differentiation. Add confusion pair to hard-case training.\n`;
  }
  doc += `\n`;
}

doc += `## Ranked by Impact

`;

const ranked = [...lowF1].sort((a, b) => parseFloat(b.impactScore) - parseFloat(a.impactScore));
doc += `| Rank | Label | F1 | Impact Score | Difficulty |
|:----:|-------|:-:|:----------:|:--------:|\n`;
ranked.forEach((l, i) => {
  const rem = remediations[l.label] || { difficulty: "unknown" };
  doc += `| ${i + 1} | ${l.label} | ${(l.f1*100).toFixed(1)}% | ${l.impactScore} | ${rem.difficulty} |\n`;
});

doc += `\n## Recommended Actions

1. **Immediate (Phase 33)**: Collect 5+ samples each for IM FINE, RED, SEVEN, APRIL, JANUARY — these have the highest impact scores and lowest F1.
2. **Short-term**: Add FATHER, MOTHER, BLUE samples — these are easy fixes (low support, not real confusion).
3. **Medium-term**: Calendar and number confusion pairs need targeted augmentation.
4. **Ongoing**: Monitor all 133 labels; any label below 10 test samples risks unreliable F1 measurement.

## Expected Gain

If all 11 low-F1 labels receive 5+ new diverse samples each:
- Estimated macro F1 improvement: **+2 to 5 percentage points** (from 83.45% to ~85-88%)
- This alone brings F1 close to the 85% target threshold
`;

fs.writeFileSync(path.join(DOCS_DIR, "low-f1-analysis.md"), doc, "utf8");
console.log(`Report: docs/low-f1-analysis.md`);
