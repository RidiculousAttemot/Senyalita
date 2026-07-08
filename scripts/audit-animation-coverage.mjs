// Audit script to verify every deployed model class has:
//   - trained model label
//   - database gesture entry
//   - reference video
//   - animation asset
//
// Usage: node scripts/audit-animation-coverage.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const LABELS_PATH = path.join(
  ROOT,
  "public",
  "models",
  "fsl_unified",
  "bilstm_tfjs",
  "labels.json",
);
const ANIMATIONS_DIR = path.join(ROOT, "public", "animations");
const GESTURE_DB_PATH = path.join(ROOT, "scripts", "reports");

function loadModelLabels() {
  const raw = fs.readFileSync(LABELS_PATH, "utf-8");
  const data = JSON.parse(raw);
  return data.labels ?? [];
}

function loadAnimationManifest() {
  const manifestPath = path.join(ANIMATIONS_DIR, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
}

function checkAnimationAsset(label) {
  const filename = label.replace(/\s+/g, "_") + ".json";
  return fs.existsSync(path.join(ANIMATIONS_DIR, filename));
}

// Check for DB entries (gesture seed files)
function checkDatabaseEntry(label) {
  const dbFiles = [
    path.join(ROOT, "supabase", "seed-gestures.sql"),
    path.join(ROOT, "scripts", "db-seed-gestures.mjs"),
  ];
  const normalized = label.toLowerCase();
  for (const f of dbFiles) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, "utf-8").toLowerCase();
      if (content.includes(normalized)) return true;
    }
  }
  // Check gloss dictionary
  const glossPath = path.join(
    ROOT,
    "src",
    "features",
    "gesture-mapping",
    "glossDictionary.ts",
  );
  if (fs.existsSync(glossPath)) {
    const content = fs.readFileSync(glossPath, "utf-8").toLowerCase();
    if (content.includes(`"${normalized}"`)) return true;
  }
  return false;
}

// Check for reference video in public directory
function checkReferenceVideo(label) {
  const publicDir = path.join(ROOT, "public");
  const normalized = label.toLowerCase().replace(/\s+/g, "_");

  // Check common video locations
  const videoGlobs = [
    path.join(publicDir, "videos", `${normalized}.mp4`),
    path.join(publicDir, "videos", `${normalized}.webm`),
    path.join(publicDir, "signs", `${normalized}.mp4`),
  ];

  for (const v of videoGlobs) {
    if (fs.existsSync(v)) return true;
  }

  // Recursively search for any video file containing the label name
  try {
    const searchDirs = [
      path.join(publicDir, "videos"),
      path.join(publicDir, "signs"),
    ];
    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir, { recursive: true });
      for (const file of files) {
        if (typeof file === "string" && file.toLowerCase().includes(normalized)) {
          const ext = path.extname(file).toLowerCase();
          if ([".mp4", ".webm", ".mov", ".avi"].includes(ext)) return true;
        }
      }
    }
  } catch {}

  return false;
}

function runAudit() {
  console.log("=== Dataset Integration Audit ===\n");

  const modelLabels = loadModelLabels();
  const manifest = loadAnimationManifest();

  console.log(`Model labels: ${modelLabels.length}`);
  console.log(`Animation manifest: ${manifest ? manifest.totalGestures + " gestures" : "NOT FOUND"}\n`);

  const header = "Gesture".padEnd(25) + "Model".padEnd(8) + "DB".padEnd(6) + "Video".padEnd(8) + "Animation".padEnd(10) + "Status";
  console.log(header);
  console.log("-".repeat(header.length));

  let modelOk = 0;
  let dbOk = 0;
  let videoOk = 0;
  let animOk = 0;
  let totalOk = 0;

  for (const label of modelLabels) {
    const hasModel = true;
    const hasDb = checkDatabaseEntry(label);
    const hasVideo = checkReferenceVideo(label);
    const hasAnim = checkAnimationAsset(label);

    modelOk += hasModel ? 1 : 0;
    dbOk += hasDb ? 1 : 0;
    videoOk += hasVideo ? 1 : 0;
    animOk += hasAnim ? 1 : 0;

    const allOk = hasModel && hasDb && hasVideo && hasAnim;
    totalOk += allOk ? 1 : 0;

    const status = allOk ? "✓" : "✗";
    console.log(
      label.padEnd(25) +
        (hasModel ? "✓".padEnd(8) : "✗".padEnd(8)) +
        (hasDb ? "✓".padEnd(6) : "✗".padEnd(6)) +
        (hasVideo ? "✓".padEnd(8) : "✗".padEnd(8)) +
        (hasAnim ? "✓".padEnd(10) : "✗".padEnd(10)) +
        status,
    );
  }

  const total = modelLabels.length;

  console.log("\n" + "=".repeat(header.length));
  console.log("Summary:");
  console.log(`  Model labels:   ${modelOk}/${total} (${((modelOk / total) * 100).toFixed(0)}%)`);
  console.log(`  DB entries:     ${dbOk}/${total} (${((dbOk / total) * 100).toFixed(0)}%)`);
  console.log(`  Videos:         ${videoOk}/${total} (${((videoOk / total) * 100).toFixed(0)}%)`);
  console.log(`  Animations:     ${animOk}/${total} (${((animOk / total) * 100).toFixed(0)}%)`);
  console.log(`  Full coverage:  ${totalOk}/${total} (${((totalOk / total) * 100).toFixed(0)}%)`);
  console.log("\nTarget: 100% coverage");
}

runAudit();
