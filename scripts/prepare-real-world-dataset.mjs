import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const RW_DIR = path.join(ROOT, "datasets", "real_world");
const DOCS_DIR = path.join(ROOT, "docs");

const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const TARGET_SIGNERS = 5;
const TARGET_SIGNS = ["a","b","c","d","e","f","g","h","i","j","THANK YOU","GOOD MORNING","HELLO","YES","NO"];

const plan = {
  name: "Real-World Collection Pipeline",
  created: new Date().toISOString(),
  targetSigners: TARGET_SIGNERS,
  diversityRequirements: {
    skinTones: ["light", "medium", "dark", "olive", "brown"],
    lightingConditions: ["bright-indoor", "dim-indoor", "outdoor-shade", "outdoor-sun", "backlit", "side-lit"],
    cameraPositions: ["chest-level", "face-level", "slightly-above", "slightly-below", "angled-left", "angled-right"],
    backgrounds: ["solid-wall", "cluttered", "window", "outdoor", "dark"],
  },
  signsToCollect: TARGET_SIGNS,
  collectionPipeline: [
    { step: 1, description: "Setup MediaPipe hand tracking in browser" },
    { step: 2, description: "Capture 120-frame sequence at 30fps per sign" },
    { step: 3, description: "Extract 126 MediaPipe landmarks per frame" },
    { step: 4, description: "Validate landmark quality (>60% nonzero)" },
    { step: 5, description: "Store as JSON with metadata (signer, lighting, background, position)" },
    { step: 6, description: "Review and label each capture" },
  ],
  validationCriteria: {
    minFrames: 30,
    maxFrames: 300,
    landmarkCompleteness: 0.6,
    minConfidence: 0.7,
  },
};

const outDir = path.join(RW_DIR, "metadata.json");
ensureDir(RW_DIR);
fs.writeFileSync(outDir, JSON.stringify(plan, null, 2));

const doc = `# Real-World Dataset Collection Plan

Generated: ${plan.created.split("T")[0]}

## Goal

Collect recordings from ${TARGET_SIGNERS}+ signers with diverse skin tones, lighting, camera positions, and backgrounds.

## Diversity Targets

| Category | Targets |
|----------|---------|
| **Skin tones** | ${plan.diversityRequirements.skinTones.join(", ")} |
| **Lighting** | ${plan.diversityRequirements.lightingConditions.join(", ")} |
| **Camera positions** | ${plan.diversityRequirements.cameraPositions.join(", ")} |
| **Backgrounds** | ${plan.diversityRequirements.backgrounds.join(", ")} |

## Signs to Collect

${TARGET_SIGNS.map((s,i) => `${i+1}. ${s}`).join("\n")}

## Collection Pipeline

${plan.collectionPipeline.map((s) => `**Step ${s.step}:** ${s.description}`).join("\n\n")}

## Validation Criteria

| Criterion | Threshold |
|-----------|:---------:|
| Minimum frames | ${plan.validationCriteria.minFrames} |
| Maximum frames | ${plan.validationCriteria.maxFrames} |
| Landmark completeness | ${(plan.validationCriteria.landmarkCompleteness*100).toFixed(0)}% |
| Min confidence | ${(plan.validationCriteria.minConfidence*100).toFixed(0)}% |

## Output Structure

\`\`\`
datasets/real_world/
  metadata.json
  signer_001/
    a.json
    b.json
    ...
  signer_002/
    ...
  ...
\`\`\`

## Usage

\`\`\`
node scripts/prepare-real-world-dataset.mjs
\`\`\`

This creates the directory structure and metadata. Collection must be done via the web app's data collection interface.
`;

fs.writeFileSync(path.join(DOCS_DIR, "real-world-dataset-plan.md"), doc);
console.log(`Real-world dataset plan saved to ${DOCS_DIR}`);
console.log(`Output directory: ${RW_DIR}`);
