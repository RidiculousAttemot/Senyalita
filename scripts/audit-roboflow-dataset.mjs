#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROBOFLOW_DIR = path.join(process.cwd(), "roboflow");
const TRAIN_DIR = path.join(ROBOFLOW_DIR, "train");
const DOCS_DIR = path.join(process.cwd(), "docs");

const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };

const readCsv = (csvPath) => {
  const lines = fs.readFileSync(csvPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length >= header.length) {
      const row = {};
      for (let j = 0; j < header.length; j++) row[header[j].trim()] = cols[j].trim();
      rows.push(row);
    }
  }
  return { header, rows };
};

const scanStructure = (root) => {
  const structure = { directories: [], files: [], totalSize: 0 };
  const walk = (dir, depth = 0) => {
    if (depth > 5) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { structure.directories.push(full); walk(full, depth + 1); }
        else { structure.files.push(full); try { structure.totalSize += fs.statSync(full).size; } catch {} }
      }
    } catch {}
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
      if (seen.has(size)) duplicates.push({ original: seen.get(size), duplicate: f, size });
      else { seen.set(size, f); unique.push(f); }
    } catch { unique.push(f); }
  }
  return { unique, duplicates };
};

const identifyLongTail = (perClass, threshold) => {
  return Object.entries(perClass).filter(([, count]) => count < threshold).map(([cls]) => cls);
};

const writeReport = (audit) => {
  ensureDir(DOCS_DIR);
  const sortedClasses = Object.entries(audit.perClass).sort(([, a], [, b]) => b - a);
  const totalAnnotated = Object.values(audit.perClass).reduce((s, c) => s + c, 0);
  const longTail = identifyLongTail(audit.perClass, 10);

  const report = `# Roboflow Dataset Audit Report

Generated: ${new Date().toISOString().split("T")[0]}

## Overview

| Metric | Value |
|--------|-------|
| Dataset path | \`${audit.datasetPath}\` |
| Total JPG images | ${audit.totalImages} |
| Total annotated entries | ${totalAnnotated} |
| Unique annotated images | ${audit.uniqueAnnotatedImages} |
| Total classes | ${audit.totalClasses} |
| Total size | ${audit.totalSizeMB.toFixed(2)} MB |
| Has valid split | ${audit.hasValid} |
| Has test split | ${audit.hasTest} |
| Duplicate groups (by size) | ${audit.duplicates.length} |

## Split Detection

| Split | Directory Exists |
|-------|-----------------|
| train | ✅ (${audit.totalImages} images) |
| valid | ${audit.hasValid ? "✅" : "❌ Not found"} |
| test | ${audit.hasTest ? "✅" : "❌ Not found"} |

## Per-Class Distribution

| Class | Samples | Percentage |
|-------|---------|------------|
${sortedClasses.map(([cls, count]) => `| ${cls} | ${count} | ${((count / totalAnnotated) * 100).toFixed(2)}% |`).join("\n")}

## Class Balance

| Statistic | Value |
|-----------|-------|
| Min samples per class | ${Math.min(...Object.values(audit.perClass))} |
| Max samples per class | ${Math.max(...Object.values(audit.perClass))} |
| Mean samples per class | ${(totalAnnotated / audit.totalClasses).toFixed(1)} |
| Total annotated entries | ${totalAnnotated} |

## Long-Tail Classes (< 10 samples)

${longTail.length > 0 ? longTail.map((cls) => `- **${cls}**: ${audit.perClass[cls]} samples`).join("\n") : "No long-tail classes detected."}

## Duplicates

${audit.duplicates.length > 0 ? `Found ${audit.duplicates.length} duplicate groups by file size:\n${audit.duplicates.map((d) => `- ${path.basename(d.duplicate)} (same size as ${path.basename(d.original)})`).join("\n")}` : "No duplicates detected by file size."}

## Recommendations

${longTail.length > 0 ? `- **Collect more data** for ${longTail.length} long-tail classes: ${longTail.join(", ")}` : "- Class distribution is relatively balanced."}
${!audit.hasValid || !audit.hasTest ? "- **No valid/test splits found.** All data is in train/. Consider splitting before training." : ""}
${audit.duplicates.length > 0 ? `- Remove ${audit.duplicates.length} duplicate files.` : ""}
- Proceed with landmark extraction: \`node scripts/extract-roboflow-landmarks.mjs\`
- Then merge into unified dataset: \`node scripts/merge-unified-datasets-v3.mjs\`
`;
  const reportPath = path.join(DOCS_DIR, "roboflow-dataset-audit-report.md");
  fs.writeFileSync(reportPath, report);
  console.log(`Report written to ${reportPath}`);
};

const main = () => {
  console.log("Roboflow Dataset Audit");
  console.log("=".repeat(55));

  if (!fs.existsSync(ROBOFLOW_DIR)) {
    console.log("Roboflow dataset not found. Expected at ./roboflow/");
    process.exit(0);
  }

  const structure = scanStructure(ROBOFLOW_DIR);
  const imageFiles = structure.files.filter((f) => /\.jpg$/i.test(f));
  const totalImages = imageFiles.length;
  const totalSizeMB = structure.totalSize / (1024 * 1024);

  const csvPath = path.join(TRAIN_DIR, "_annotations.csv");
  let perClass = {};
  let uniqueAnnotatedImages = 0;
  let uniqueFilenames = new Set();
  let hasValid = false;
  let hasTest = false;

  if (fs.existsSync(csvPath)) {
    const { header, rows } = readCsv(csvPath);
    for (const row of rows) {
      const cls = row.class;
      perClass[cls] = (perClass[cls] || 0) + 1;
      uniqueFilenames.add(row.filename);
    }
    uniqueAnnotatedImages = uniqueFilenames.size;
  }

  const checkSplits = () => {
    for (const entry of fs.readdirSync(ROBOFLOW_DIR, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "valid") hasValid = true;
        if (entry.name === "test") hasTest = true;
        if (entry.name === "train") {} // known
      }
    }
  };
  checkSplits();

  const { duplicates } = deduplicateBySize(imageFiles);
  const totalClasses = Object.keys(perClass).length;
  const longTail = identifyLongTail(perClass, 10);

  const audit = {
    datasetPath: ROBOFLOW_DIR,
    totalImages,
    totalSizeMB,
    totalClasses,
    perClass,
    uniqueAnnotatedImages,
    hasValid,
    hasTest,
    duplicates,
    longTail
  };

  writeReport(audit);

  console.log("\nAudit Summary:");
  console.log(`  Total images: ${totalImages}`);
  console.log(`  Total annotated entries: ${Object.values(perClass).reduce((s, c) => s + c, 0)}`);
  console.log(`  Unique annotated images: ${uniqueAnnotatedImages}`);
  console.log(`  Classes: ${totalClasses}`);
  console.log(`  Valid split: ${hasValid ? "Yes" : "No (train only)"}`);
  console.log(`  Test split: ${hasTest ? "Yes" : "No (train only)"}`);
  console.log(`  Duplicates: ${duplicates.length}`);
  console.log(`  Size: ${totalSizeMB.toFixed(2)} MB`);

  if (longTail.length > 0) {
    console.log(`\n  ⚠ Long-tail classes (<10 samples):`);
    for (const cls of longTail) console.log(`    - ${cls}: ${perClass[cls]}`);
  }
};

main();
