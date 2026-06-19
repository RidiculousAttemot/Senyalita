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

const perClass = cm.labels.map((label, i) => {
  const prec = predicted[i] > 0 ? correct[i] / predicted[i] : 0;
  const rec = actual[i] > 0 ? correct[i] / actual[i] : 0;
  const f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0;
  return { label, support: actual[i], precision: prec, recall: rec, f1 };
});

const lowF1Count = perClass.filter(l => l.f1 < 0.50).length;
const classesBelow5Support = perClass.filter(l => l.support < 5).length;

const scores = {
  recognitionQuality: {
    score: 0,
    max: 100,
    criteria: [
      { name: "Test accuracy", pct: metrics.testAccuracy, target: 0.90, weight: 25, valueLabel: `${(metrics.testAccuracy * 100).toFixed(2)}%` },
      { name: "Macro F1", pct: metrics.macroF1, target: 0.85, weight: 25, valueLabel: `${(metrics.macroF1 * 100).toFixed(2)}%` },
      { name: "Classes with F1<0.50", pct: 1 - lowF1Count / numLabels, target: 0.95, weight: 25, valueLabel: `${lowF1Count}/${numLabels}` },
      { name: "Classes with <5 test samples", pct: 1 - classesBelow5Support / numLabels, target: 1.0, weight: 25, valueLabel: `${classesBelow5Support}/${numLabels}` },
    ]
  },
  stability: {
    score: 0,
    max: 100,
    criteria: [
      { name: "Hysteresis smoothing", value: true, target: true, weight: 20 },
      { name: "Motion detection", value: true, target: true, weight: 20 },
      { name: "Voting window (5 frames)", value: true, target: true, weight: 20 },
      { name: "Flicker control", value: true, target: true, weight: 20 },
      { name: "Adaptive thresholds", value: false, target: true, weight: 20 },
    ]
  },
  mobilePerformance: {
    score: 0,
    max: 100,
    criteria: [
      { name: "Model size", value: 195.5, target: 500, unit: "KB", lowerBetter: true, weight: 20, valueLabel: "195.5KB" },
      { name: "Load time", value: 11, target: 250, unit: "ms", lowerBetter: true, weight: 20, valueLabel: "11ms" },
      { name: "Inference time", value: 9.04, target: 50, unit: "ms", lowerBetter: true, weight: 20, valueLabel: "9.04ms" },
      { name: "FPS", value: 110.7, target: 30, lowerBetter: false, weight: 20, valueLabel: "110.7" },
      { name: "Memory", value: 31.3, target: 150, unit: "MB", lowerBetter: true, weight: 20, valueLabel: "31.3MB" },
    ]
  },
  accessibility: {
    score: 0,
    max: 100,
    criteria: [
      { name: "Camera-based input", value: true, target: true, weight: 20 },
      { name: "Real-time feedback", value: true, target: true, weight: 20 },
      { name: "Text-to-speech output", value: true, target: true, weight: 20 },
      { name: "Visual cue overlay", value: true, target: true, weight: 20 },
      { name: "Multi-language support", value: false, target: true, weight: 20 },
    ]
  },
  conversationWorkflow: {
    score: 0,
    max: 100,
    criteria: [
      { name: "AI reply generation", value: true, target: true, weight: 20 },
      { name: "Suggested replies", value: true, target: true, weight: 20 },
      { name: "Conversation history", value: true, target: true, weight: 20 },
      { name: "Reply ranking", value: true, target: true, weight: 20 },
      { name: "Full 105-phrase coverage", value: 20 / 105, target: 1.0, weight: 20 },  // Only 20 have replies
    ]
  },
  adminWorkflow: {
    score: 0,
    max: 100,
    criteria: [
      { name: "Admin dashboard", value: true, target: true, weight: 20 },
      { name: "Coverage tracking", value: true, target: true, weight: 20 },
      { name: "Model health monitoring", value: true, target: true, weight: 20 },
      { name: "Analytics page", value: true, target: true, weight: 20 },
      { name: "User management", value: true, target: true, weight: 20 },
    ]
  },
  datasetQuality: {
    score: 0,
    max: 100,
    criteria: [
      { name: "Dataset size", value: 5481, target: 10000, unit: "samples", lowerBetter: false, weight: 15, valueLabel: "5,481" },
      { name: "Class balance", value: 1.22, target: 1.5, unit: "ratio", lowerBetter: true, weight: 15, valueLabel: "1.22x" },
      { name: "Signer diversity (alpha)", value: 6, target: 10, lowerBetter: false, weight: 15, valueLabel: "6 signers" },
      { name: "Signer diversity (FSL)", value: 105, target: 105, lowerBetter: false, weight: 10, valueLabel: "105 signers" },
      { name: "Low-F1 labels", value: lowF1Count, target: 0, lowerBetter: true, weight: 15, valueLabel: `${lowF1Count} labels` },
      { name: "Hard cases", value: 741, target: 1000, unit: "samples", lowerBetter: false, weight: 10, valueLabel: "741" },
      { name: "Real-world diversity", value: false, target: true, weight: 10 },
      { name: "Reference videos", value: 0, target: 133, unit: "videos", lowerBetter: false, weight: 10, valueLabel: "0/133" },
    ]
  },
  monitoring: {
    score: 0,
    max: 100,
    criteria: [
      { name: "Translation logging", value: true, target: true, weight: 20 },
      { name: "Feedback collection", value: true, target: true, weight: 20 },
      { name: "Telemetry events", value: true, target: true, weight: 20 },
      { name: "Model metrics dashboard", value: true, target: true, weight: 20 },
      { name: "Dataset quality tracking", value: true, target: true, weight: 20 },
    ]
  },
  security: {
    score: 80,
    max: 100,
    criteria: [
      { name: "Row Level Security", value: true, target: true, weight: 25 },
      { name: "Service role for writes", value: true, target: true, weight: 25 },
      { name: "Anonymous auth for inference", value: true, target: true, weight: 25 },
      { name: "No secrets in client", value: true, target: true, weight: 25 },
    ]
  },
  thesisReadiness: {
    score: 0,
    max: 100,
    criteria: [
      { name: "Novel approach (BiLSTM + FSL)", value: true, target: true, weight: 15 },
      { name: "Reproducible pipeline", value: true, target: true, weight: 10 },
      { name: "Comprehensive evaluation", value: true, target: true, weight: 15 },
      { name: "Real-time demonstration", value: true, target: true, weight: 15 },
      { name: "Cross-platform (mobile/web)", value: true, target: true, weight: 10 },
      { name: "Meeting accuracy target", value: metrics.testAccuracy, target: 0.90, weight: 15, valueLabel: `${(metrics.testAccuracy * 100).toFixed(2)}%` },
      { name: "Meeting F1 target", value: metrics.macroF1, target: 0.85, weight: 15, valueLabel: `${(metrics.macroF1 * 100).toFixed(2)}%` },
      { name: "Documentation & reports", value: true, target: true, weight: 5 },
    ]
  }
};

// Compute scores
for (const [key, section] of Object.entries(scores)) {
  let weighted = 0;
  let totalWeight = 0;
  for (const c of section.criteria) {
    totalWeight += c.weight;
    if (typeof c.pct === "number") {
      const ratio = Math.min(c.pct / c.target, 1);
      weighted += c.weight * ratio * 100;
    } else if (typeof c.value === "number" && c.target !== undefined) {
      if (c.lowerBetter) {
        const ratio = c.value <= c.target ? 1 : Math.max(0, 1 - (c.value - c.target) / c.target);
        weighted += c.weight * ratio * 100;
      } else {
        const ratio = Math.min(c.value / c.target, 1);
        weighted += c.weight * ratio * 100;
      }
    } else if (typeof c.value === "boolean") {
      weighted += c.value === c.target ? c.weight * 100 : 0;
    }
  }
  section.score = Math.round(weighted / totalWeight);
}

const overall = Math.round(Object.values(scores).reduce((s, sec) => s + sec.score, 0) / Object.keys(scores).length);

function rating(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Adequate";
  return "Needs Improvement";
}

let doc = `# Production Readiness Review

Generated: ${new Date().toISOString().split("T")[0]}

## Overall Score

**${overall}/100 — ${rating(overall)}**

| Category | Score | Rating |
|----------|:-----:|:------:|
${Object.entries(scores).map(([key, sec]) => `| ${key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())} | ${sec.score}/100 | ${rating(sec.score)} |`).join("\n")}

## Category Breakdown

`;

for (const [key, section] of Object.entries(scores)) {
  const name = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
  doc += `### ${name}: ${section.score}/100\n\n`;
  doc += `| Criterion | Value | Target | Score |\n|----------|:-----:|:------:|:----:|\n`;
  for (const c of section.criteria) {
    const cScore = (() => {
      if (typeof c.pct === "number") return Math.round(Math.min(c.pct / c.target, 1) * 100);
      if (typeof c.value === "number" && c.target !== undefined) {
        if (c.lowerBetter) return c.value <= c.target ? 100 : Math.round(Math.max(0, 1 - (c.value - c.target) / c.target) * 100);
        return Math.round(Math.min(c.value / c.target, 1) * 100);
      }
      if (typeof c.value === "boolean") return c.value === c.target ? 100 : 0;
      return 0;
    })();
    const displayValue = c.valueLabel || (typeof c.value === "boolean" ? (c.value ? "✅" : "❌") : c.value);
    const displayTarget = typeof c.target === "boolean" ? (c.target ? "✅" : "❌") : (c.unit ? `${c.target}${c.unit}` : c.target);
    doc += `| ${c.name} | ${displayValue} | ${displayTarget} | ${cScore}/100 |\n`;
  }
  doc += "\n";
}

doc += `## Deployment Readiness

| Decision | Status |
|----------|:------:|
| Ready for thesis defense | ${overall >= 70 ? "✅ Yes" : "❌ No"} (${overall}/100) |
| Ready for pilot deployment | ${overall >= 65 ? "✅ Yes" : "❌ No"} (${overall}/100) |
| Ready for public deployment | ${overall >= 85 ? "✅ Yes" : "❌ No"} (${overall}/100) |

## Final Recommendation

${overall >= 85
  ? "**Ready for public deployment.** All categories meet or exceed targets. Focus on maintaining monitoring and collecting real-world feedback."
  : overall >= 70
    ? `**Ready for thesis defense and pilot deployment.** The system demonstrates core functionality with ${metrics.testAccuracy * 100}% accuracy and ${metrics.macroF1 * 100}% F1. Primary improvement areas: dataset quality (reference videos, more signers, environmental diversity) and recognition quality (low-F1 labels).`
    : "**Needs significant improvement before deployment.** Focus on dataset quality and model accuracy first."
}

### Key Strengths
- Mobile performance (size, speed, memory all within targets)
- Stability pipeline (hysteresis, motion detection, voting)
- Admin workflow (dashboard, monitoring, analytics)
- Security (RLS, service roles, anonymous auth)

### Key Weaknesses
- Recognition quality (88.84% accuracy, 83.45% F1 — both below targets)
- Dataset quality (low signer diversity for alphabet, no reference videos)
- Conversation workflow (only 20 of 105 phrases have suggested replies)
- Accessibility (multi-language support not implemented)

### Recommended Next Actions
1. **Phase 33**: Targeted data collection for 11 low-F1 labels + 5 new signers
2. **Reference videos**: Upload top 20 priority videos (greetings + survival phrases)
3. **Suggested replies**: Add replies for remaining 85 phrases
4. **Real-world collection**: Execute planned diversity collection (545 samples)
5. **Retrain**: Use combined dataset for BiLSTM v1 retraining
`;

fs.writeFileSync(path.join(DOCS_DIR, "production-readiness-review.md"), doc, "utf8");
console.log(`Report: docs/production-readiness-review.md`);
