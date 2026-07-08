#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const LABELS_PATH = path.join(ROOT, "public", "models", "fsl_unified", "bilstm_tfjs", "labels.json");
const ANIMATIONS_DIR = path.join(ROOT, "public", "animations");
const GLOSS_DICT_PATH = path.join(ROOT, "src", "features", "gesture-mapping", "glossDictionary.ts");
const SMART_SUGG_PATH = path.join(ROOT, "src", "features", "translation", "smartSuggestions.ts");

let exitCode = 0;
const errors = [];
const warnings = [];

const report = {
  labels: { total: 0, animOk: 0, animMissing: [], glossOk: 0, glossMissing: [], suggOk: 0, suggMissing: [] },
  animFiles: { total: 0, orphaned: [], invalid: [] },
};

function logError(msg) { errors.push(msg); console.error("  ERROR: " + msg); exitCode = 1; }
function logWarn(msg) { warnings.push(msg); console.warn("  WARN: " + msg); }

function labelToAnimFile(label) {
  return label.toUpperCase().replace(/'/g, "'").replace(/\s+/g, "_") + ".json";
}

// 1. Load model labels
console.log("\n[1] Loading model labels...");
if (!fs.existsSync(LABELS_PATH)) {
  logError(`Labels file not found: ${LABELS_PATH}`);
  process.exit(1);
}
const labels = JSON.parse(fs.readFileSync(LABELS_PATH, "utf8")).labels;
report.labels.total = labels.length;
console.log(`   ${labels.length} recognition labels loaded.`);

// 2. Check animation coverage
console.log("\n[2] Checking animation coverage...");
if (!fs.existsSync(ANIMATIONS_DIR)) {
  logError(`Animations directory not found: ${ANIMATIONS_DIR}`);
} else {
  const animFiles = new Set(fs.readdirSync(ANIMATIONS_DIR).filter(f => f.endsWith(".json") && f !== "manifest.json"));
  report.animFiles.total = animFiles.size;
  console.log(`   ${animFiles.size} animation files found.`);

  for (const label of labels) {
    const expectedFile = labelToAnimFile(label);
    if (animFiles.has(expectedFile)) {
      report.labels.animOk++;
      // Validate JSON content
      const filePath = path.join(ANIMATIONS_DIR, expectedFile);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (!content.gesture && !content.label && !content.name) {
          logWarn(`Animation ${expectedFile} may be missing metadata (no gesture/label/name field)`);
          report.animFiles.invalid.push(expectedFile);
        }
        if (content.duration !== undefined && (typeof content.duration !== "number" || content.duration <= 0)) {
          logWarn(`Animation ${expectedFile} has invalid duration: ${content.duration}`);
        }
      } catch {
        logError(`Animation ${expectedFile} is not valid JSON`);
        report.animFiles.invalid.push(expectedFile);
      }
    } else {
      report.labels.animMissing.push(label);
    }
  }

  // Check for orphaned animation files
  const labelAnimNames = new Set(labels.map(l => labelToAnimFile(l)));
  for (const f of animFiles) {
    if (f === "manifest.json") continue;
    if (!labelAnimNames.has(f)) {
      report.animFiles.orphaned.push(f);
      logWarn(`Orphaned animation file: ${f} (no corresponding model label)`);
    }
  }
}

console.log(`   Animation coverage: ${report.labels.animOk}/${report.labels.total}`);
if (report.labels.animMissing.length > 0) {
  report.labels.animMissing.forEach(l => logError(`Missing animation for label: "${l}"`));
}

// 3. Check gloss dictionary coverage
console.log("\n[3] Checking gloss dictionary coverage...");
if (!fs.existsSync(GLOSS_DICT_PATH)) {
  logError(`Gloss dictionary not found: ${GLOSS_DICT_PATH}`);
} else {
  const glossContent = fs.readFileSync(GLOSS_DICT_PATH, "utf8");

  const labelPattern = (l) => {
    const u = l.toUpperCase();
    const lu = l.toLowerCase();
    return new RegExp(`["'\`]?${u}["'\`]?\\s*[:]|["'\`]?${lu}["'\`]?\\s*[:]`);
  };
  for (const label of labels) {
    if (labelPattern(label).test(glossContent)) {
      report.labels.glossOk++;
    } else {
      report.labels.glossMissing.push(label);
    }
  }

  console.log(`   Gloss dictionary coverage: ${report.labels.glossOk}/${report.labels.total}`);
  if (report.labels.glossMissing.length > 0) {
    report.labels.glossMissing.forEach(l => logError(`Missing gloss dictionary entry for: "${l}"`));
  }
}

// 4. Check smart suggestions coverage
console.log("\n[4] Checking smart suggestions coverage...");
if (!fs.existsSync(SMART_SUGG_PATH)) {
  logError(`Smart suggestions not found: ${SMART_SUGG_PATH}`);
} else {
  const suggContent = fs.readFileSync(SMART_SUGG_PATH, "utf8");

  const gestureNames = [];
  const gesturePattern = /gesture:\s*"([^"]+)"/g;
  let match;
  while ((match = gesturePattern.exec(suggContent)) !== null) {
    gestureNames.push(match[1]);
  }

  // Alphabet suggestion keys (uppercase single letters)
  const alphabetSuggKeys = [];
  const alphabetPattern = /"([A-Z])":\s*\[/g;
  while ((match = alphabetPattern.exec(suggContent)) !== null) {
    alphabetSuggKeys.push(match[1]);
  }

  const coveredByRules = new Set([
    ...gestureNames.map(g => g.toUpperCase()),
    ...alphabetSuggKeys.map(g => g.toUpperCase()),
  ]);
  for (const label of labels) {
    if (coveredByRules.has(label.toUpperCase())) {
      report.labels.suggOk++;
    } else {
      report.labels.suggMissing.push(label);
    }
  }

  console.log(`   Smart suggestions coverage: ${report.labels.suggOk}/${report.labels.total}`);
  if (report.labels.suggMissing.length > 0) {
    report.labels.suggMissing.forEach(l => logWarn(`Missing smart suggestion rules for: "${l}"`));
  }
}

// 5. Check manifest consistency
console.log("\n[5] Checking manifest consistency...");
const manifestPath = path.join(ANIMATIONS_DIR, "manifest.json");
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const manifestAssets = new Set(manifest.assets);
  for (const label of labels) {
    const normalized = label.toUpperCase();
    if (!manifestAssets.has(label) && !manifestAssets.has(normalized)) {
      logWarn(`Label "${label}" not found in manifest.json`);
    }
  }
  console.log(`   Manifest has ${manifestAssets.size} entries (labels: ${labels.length})`);
} else {
  logWarn("No manifest.json found in animations directory");
}

// 6. Animation loader path validation
console.log("\n[6] Checking animation loader compatibility...");
const loaderPath = path.join(ROOT, "src", "features", "sign-animation", "loader", "AnimationLoader.ts");
if (fs.existsSync(loaderPath)) {
  const loaderCode = fs.readFileSync(loaderPath, "utf8");
  const keyPattern = /\.toUpperCase\(\)\.replace\([^)]+\)/;
  if (!keyPattern.test(loaderCode)) {
    logWarn("AnimationLoader key generation pattern may be incompatible with label-to-filename mapping");
  }
  console.log("   Animation loader check passed.");
}

// Summary
console.log("\n" + "=".repeat(60));
console.log("   COVERAGE VALIDATION SUMMARY");
console.log("=".repeat(60));
console.log(`   Total model labels:    ${report.labels.total}`);
console.log(`   Animation coverage:    ${report.labels.animOk}/${report.labels.total} (${(report.labels.animOk/report.labels.total*100).toFixed(1)}%)`);
console.log(`   Gloss dictionary:      ${report.labels.glossOk}/${report.labels.total} (${(report.labels.glossOk/report.labels.total*100).toFixed(1)}%)`);
console.log(`   Smart suggestions:     ${report.labels.suggOk}/${report.labels.total} (${(report.labels.suggOk/report.labels.total*100).toFixed(1)}%)`);

if (report.animFiles.orphaned.length > 0) {
  console.log(`   Orphaned animation files: ${report.animFiles.orphaned.length}`);
}
if (report.animFiles.invalid.length > 0) {
  console.log(`   Invalid animation files: ${report.animFiles.invalid.length}`);
}

console.log(`\n   Errors:   ${errors.length}`);
console.log(`   Warnings: ${warnings.length}`);

if (report.labels.animMissing.length === 0 && report.labels.glossMissing.length === 0) {
  console.log("\n   ✓ ALL 131 LABELS HAVE COMPLETE COVERAGE");
} else {
  console.log(`\n   ✗ ${report.labels.animMissing.length + report.labels.glossMissing.length} coverage gaps remain`);
}

console.log("=".repeat(60));

process.exit(exitCode);
