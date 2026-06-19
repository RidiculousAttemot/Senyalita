#!/usr/bin/env node
import fs from "fs";
import path from "path";
import os from "os";

const V45_EXPECTED_PATH = path.join(os.homedir(), ".cache", "kagglehub", "datasets", "japorton", "fsl-dataset", "versions", "4.5");
const V45_CONFIG_PATH = path.join(process.cwd(), "datasets", "fsl_v45");
const OUTPUT_DIR = path.join(process.cwd(), "docs");

const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };

const EXISTING_133 = [
  "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","ñ","ng",
  "GOOD MORNING","GOOD AFTERNOON","GOOD EVENING","HELLO","HOW ARE YOU","IM FINE","NICE TO MEET YOU","THANK YOU","YOURE WELCOME","SEE YOU TOMORROW",
  "UNDERSTAND","DON'T UNDERSTAND","KNOW","DON'T KNOW","NO","YES","WRONG","CORRECT","SLOW","FAST",
  "ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN",
  "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER",
  "MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY","TODAY","TOMORROW","YESTERDAY",
  "FATHER","MOTHER","SON","DAUGHTER","GRANDFATHER","GRANDMOTHER","UNCLE","AUNTIE","COUSIN","PARENTS",
  "BOY","GIRL","MAN","WOMAN","DEAF","HARD OF HEARING","WHEELCHAIR PERSON","BLIND","DEAF BLIND","MARRIED",
  "BLUE","GREEN","RED","BROWN","BLACK","WHITE","YELLOW","ORANGE","GRAY","PINK","VIOLET","LIGHT","DARK",
  "BREAD","EGG","FISH","MEAT","CHICKEN","SPAGHETTI","RICE","LONGANISA","SHRIMP","CRAB",
  "HOT","COLD","JUICE","MILK","COFFEE","TEA","BEER","WINE","SUGAR","NO SUGAR"
];

const detectDatasetPath = () => {
  const locations = [
    V45_EXPECTED_PATH,
    V45_CONFIG_PATH,
    path.join(process.cwd(), "datasets", "raw", "fsl_v45"),
    path.join(process.cwd(), "datasets", "external", "fsl_v45"),
    path.join(os.homedir(), ".cache", "kagglehub", "datasets", "japorton", "fsl-dataset", "versions", "1"),
  ];
  for (const loc of locations) {
    if (fs.existsSync(loc)) return loc;
  }
  return null;
};

const countVideosInDir = (dirPath) => {
  let count = 0;
  const videoExts = new Set([".mp4", ".avi", ".mov", ".webm", ".jpg", ".jpeg", ".png"]);
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) count += countVideosInDir(path.join(dirPath, entry.name));
      else if (videoExts.has(path.extname(entry.name).toLowerCase())) count++;
    }
  } catch { /* skip inaccessible */ }
  return count;
};

const scanStructure = (root) => {
  const structure = { directories: [], files: [], totalSize: 0 };
  const walk = (dir, depth = 0) => {
    if (depth > 5) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          structure.directories.push(fullPath);
          walk(fullPath, depth + 1);
        } else {
          structure.files.push(fullPath);
          try { structure.totalSize += fs.statSync(fullPath).size; } catch {}
        }
      }
    } catch { /* skip */ }
  };
  walk(root);
  return structure;
};

const deduplicateBySize = (files) => {
  const seen = new Map();
  const duplicates = [];
  const unique = [];
  for (const f of files) {
    try {
      const size = fs.statSync(f).size;
      if (seen.has(size)) { duplicates.push({ original: seen.get(size), duplicate: f, size }); }
      else { seen.set(size, f); unique.push(f); }
    } catch { unique.push(f); }
  }
  return { unique, duplicates };
};

const identifyNewClasses = (labels) =>{
  const existingSet = new Set(EXISTING_133.map((l) => l.toUpperCase()));
  const newOnes = [];
  const matched = [];
  for (const l of labels) {
    const upper = l.toUpperCase();
    if (existingSet.has(upper)) matched.push(l);
    else newOnes.push(l);
  }
  return { matched, newOnes };
};

const writeReport = (audit) => {
  ensureDir(OUTPUT_DIR);
  const report = `# FSL Dataset v4.5 Audit Report

Generated: ${new Date().toISOString().split("T")[0]}

## Overview

| Metric | Value |
|--------|-------|
| Dataset path | \`${audit.datasetPath || "NOT FOUND"}\` |
| Status | ${audit.found ? "Found" : "Not found locally"} |
| Total files | ${audit.structure?.files?.length ?? "N/A"} |
| Total directories | ${audit.structure?.directories?.length ?? "N/A"} |
| Total size | ${audit.totalSizeMB !== null ? audit.totalSizeMB.toFixed(2) + " MB" : "N/A"} |

## Video / Image Count

| Metric | Value |
|--------|-------|
| Media files (videos + images) | ${audit.mediaCount ?? "N/A"} |

## Class Coverage

| Metric | Value |
|--------|-------|
| Detected classes | ${audit.detectedClasses ?? "N/A"} |
| Overlap with existing 133 | ${audit.overlapCount ?? "N/A"} |
| New potential classes | ${audit.newClassCount ?? "N/A"} |
| New classes | ${(audit.newClasses ?? []).join(", ") || "N/A"} |

## Duplicates

${audit.duplicates?.length ? `| Duplicate groups | ${audit.duplicates.length} |` : "| Duplicate files | 0 |"}

## Quality

- ${audit.notes ?? "Dataset not found locally; run download steps first."}

## Recommendations

${audit.recommendations ?? "1. Download the dataset to proceed with integration."}
`;
  fs.writeFileSync(path.join(OUTPUT_DIR, "fsl-v45-audit-report.md"), report);
  console.log(`Report written to docs/fsl-v45-audit-report.md`);
  return report;
};

const main = () => {
  console.log("FSL Dataset v4.5 Audit");
  console.log("=".repeat(55));

  const datasetPath = detectDatasetPath();
  const audit = {
    datasetPath,
    found: datasetPath !== null,
    structure: null,
    totalSizeMB: null,
    mediaCount: null,
    detectedClasses: null,
    overlapCount: null,
    newClassCount: null,
    newClasses: [],
    duplicates: [],
    notes: "",
    recommendations: ""
  };

  if (!datasetPath) {
    audit.notes = "Dataset v4.5 not found locally. The Kaggle FSL dataset v4.5 must be downloaded first.";
    audit.recommendations = [
      "1. Download the FSL Dataset v4.5 from Kaggle: https://www.kaggle.com/datasets/japorton/fsl-dataset",
      "2. Place it in ~/.cache/kagglehub/datasets/japorton/fsl-dataset/versions/4.5/",
      "3. Alternatively, place it in datasets/fsl_v45/",
      "4. Refer to scripts/download-fsl-dataset.py for Kaggle download instructions",
    ].join("\n");
    writeReport(audit);
    console.log(audit.notes);
    console.log(audit.recommendations);
    process.exit(0);
  }

  console.log(`Dataset found at: ${datasetPath}`);

  const structure = scanStructure(datasetPath);
  audit.structure = structure;
  audit.totalSizeMB = structure.totalSize / (1024 * 1024);

  const mediaFiles = structure.files.filter((f) => /\.(mp4|avi|mov|webm|jpg|jpeg|png)$/i.test(f));
  audit.mediaCount = mediaFiles.length;

  const labelDirs = structure.directories.filter((d) => {
    const basename = path.basename(d);
    return /^[a-zA-Z\s]+$/.test(basename) && basename.length > 0;
  });
  const detectedLabels = [...new Set(labelDirs.map((d) => path.basename(d).toUpperCase()))].sort();
  audit.detectedClasses = detectedLabels.length;

  const { matched, newOnes } = identifyNewClasses(detectedLabels);
  audit.overlapCount = matched.length;
  audit.newClassCount = newOnes.length;
  audit.newClasses = newOnes;

  const result = deduplicateBySize(mediaFiles);
  audit.duplicates = result.duplicates;
  audit.uniqueFiles = result.unique.length;

  audit.notes = [
    `Found ${audit.mediaCount} media files across ${audit.detectedClasses} classes.`,
    `Overlap with existing 133 labels: ${audit.overlapCount}/${audit.detectedClasses}`,
    `New classes not in existing set: ${audit.newClassCount}`,
    `Duplicate files detected: ${audit.duplicates.length}`,
  ].join("\n");

  audit.recommendations = [
    "1. Review new classes for manual label mapping",
    "2. Run scripts/map-fsl-v45-labels.mjs for detailed mapping",
    "3. Run scripts/extract-fsl-v45-landmarks.mjs for MediaPipe landmark extraction",
    "4. Proceed with dataset merge and model retraining",
  ].join("\n");

  writeReport(audit);

  console.log("\nAudit Summary:");
  console.log(`  Media files: ${audit.mediaCount}`);
  console.log(`  Classes detected: ${audit.detectedClasses}`);
  console.log(`  Overlap with existing: ${audit.overlapCount}`);
  console.log(`  New classes: ${audit.newClassCount}`);
  console.log(`  Duplicates: ${audit.duplicates.length}`);
  console.log(`  Size: ${audit.totalSizeMB.toFixed(2)} MB`);
};

main();
