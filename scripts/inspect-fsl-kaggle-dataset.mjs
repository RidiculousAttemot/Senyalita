#!/usr/bin/env node
/**
 * Inspect FSL Kaggle Dataset
 * 
 * Analyzes the downloaded FSL dataset structure, counts samples per label,
 * and identifies missing or problematic labels.
 * 
 * Usage: node scripts/inspect-fsl-kaggle-dataset.mjs
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const KAGGLE_CACHE_PATH = path.join(os.homedir(), '.cache', 'kagglehub', 'datasets', 'japorton', 'fsl-dataset', 'versions', '1');
const OUTPUT_DIR = path.join(process.cwd(), 'datasets', 'external');
const AUDIT_OUTPUT = path.join(process.cwd(), 'docs', 'fsl-kaggle-dataset-audit.md');

// FSL alphabet labels (28 total)
const EXPECTED_LABELS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
  'ñ', 'ng', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
];

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const getFileHash = (filePath) => {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
};

const findDatasetPath = () => {
  // Try primary cache location
  if (fs.existsSync(KAGGLE_CACHE_PATH)) {
    return KAGGLE_CACHE_PATH;
  }

  // Try alternative locations
  const alternatives = [
    path.join(process.cwd(), 'datasets', 'fsl-kaggle'),
    path.join(process.cwd(), 'datasets', 'external', 'fsl_kaggle')
  ];

  for (const alt of alternatives) {
    if (fs.existsSync(alt)) {
      return alt;
    }
  }

  return null;
};

const inspectDataset = (datasetPath) => {
  const stats = {
    totalSamples: 0,
    totalSize: 0,
    labels: {},
    supportedFormats: {},
    unsupportedFormats: {},
    missingLabels: [],
    duplicateFiles: [],
    issues: []
  };

  // Scan Collated directory
  const collatedPath = path.join(datasetPath, 'Collated');
  if (!fs.existsSync(collatedPath)) {
    stats.issues.push(`Collated directory not found at ${collatedPath}`);
    return stats;
  }

  const fileHashes = new Map();

  // Iterate through label directories
  const labelDirs = fs.readdirSync(collatedPath);
  for (const labelDir of labelDirs) {
    const labelPath = path.join(collatedPath, labelDir);
    const stat = fs.statSync(labelPath);

    if (!stat.isDirectory()) continue;

    // Normalize label name (handle special characters)
    let labelKey = labelDir.toLowerCase();
    
    // Check if this is a valid FSL label
    if (!EXPECTED_LABELS.includes(labelKey)) {
      // Try to map it
      if (labelKey === 'ñ' || labelKey === '√±' || labelKey === 'n-tilde') {
        labelKey = 'ñ';
      } else if (labelKey === 'ng') {
        labelKey = 'ng';
      }
    }

    stats.labels[labelKey] = {
      count: 0,
      size: 0,
      files: []
    };

    // Count files in this label directory
    const files = fs.readdirSync(labelPath);
    for (const file of files) {
      const filePath = path.join(labelPath, file);
      const fileStat = fs.statSync(filePath);

      if (!fileStat.isFile()) continue;

      const ext = path.extname(file).toLowerCase();
      
      // Check file format support
      if (['.jpg', '.jpeg', '.png', '.mp4', '.avi', '.mov', '.webm'].includes(ext)) {
        stats.supportedFormats[ext] = (stats.supportedFormats[ext] || 0) + 1;
      } else {
        stats.unsupportedFormats[ext] = (stats.unsupportedFormats[ext] || 0) + 1;
        stats.issues.push(`Unsupported format: ${ext} in ${labelKey}/${file}`);
      }

      // Track file info
      const fileHash = getFileHash(filePath);
      if (fileHashes.has(fileHash)) {
        stats.duplicateFiles.push({
          hash: fileHash,
          files: [fileHashes.get(fileHash), `${labelKey}/${file}`]
        });
      } else {
        fileHashes.set(fileHash, `${labelKey}/${file}`);
      }

      stats.labels[labelKey].count += 1;
      stats.labels[labelKey].size += fileStat.size;
      stats.labels[labelKey].files.push(file);
      stats.totalSamples += 1;
      stats.totalSize += fileStat.size;
    }
  }

  // Check for missing labels
  for (const label of EXPECTED_LABELS) {
    if (!stats.labels[label]) {
      stats.missingLabels.push(label);
    }
  }

  return stats;
};

const generateAuditReport = (stats, datasetPath) => {
  let report = `# FSL Kaggle Dataset Audit Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Dataset Path:** ${datasetPath}\n\n`;

  // Summary
  report += `## Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Samples | ${stats.totalSamples} |\n`;
  report += `| Total Size | ${(stats.totalSize / (1024 ** 3)).toFixed(2)} GB |\n`;
  report += `| Unique Labels | ${Object.keys(stats.labels).length} |\n`;
  report += `| Missing Labels | ${stats.missingLabels.length} |\n`;
  report += `| Issues Detected | ${stats.issues.length} |\n\n`;

  // Label Coverage
  report += `## Label Coverage\n\n`;
  report += `Expected labels: ${EXPECTED_LABELS.length}\n`;
  report += `Found labels: ${Object.keys(stats.labels).filter(l => stats.labels[l].count > 0).length}\n\n`;

  report += `### Samples per Label\n\n`;
  report += `| Label | Count | Size (MB) | Status |\n`;
  report += `|-------|-------|-----------|--------|\n`;

  for (const label of EXPECTED_LABELS) {
    const labelStats = stats.labels[label];
    if (labelStats) {
      const status = labelStats.count > 0 ? '✓ Present' : '✗ Empty';
      report += `| ${label} | ${labelStats.count} | ${(labelStats.size / (1024 ** 2)).toFixed(2)} | ${status} |\n`;
    } else {
      report += `| ${label} | 0 | 0 | ✗ Missing |\n`;
    }
  }

  report += `\n`;

  // File Formats
  report += `## File Formats\n\n`;
  report += `### Supported Formats\n\n`;
  for (const [ext, count] of Object.entries(stats.supportedFormats)) {
    report += `- ${ext}: ${count} files\n`;
  }

  if (Object.keys(stats.unsupportedFormats).length > 0) {
    report += `\n### Unsupported Formats\n\n`;
    for (const [ext, count] of Object.entries(stats.unsupportedFormats)) {
      report += `- ${ext}: ${count} files ⚠️\n`;
    }
  }

  report += `\n`;

  // Missing Labels
  if (stats.missingLabels.length > 0) {
    report += `## Missing Labels ⚠️\n\n`;
    for (const label of stats.missingLabels) {
      report += `- ${label}\n`;
    }
    report += `\n`;
  }

  // Class Distribution
  report += `## Class Distribution Analysis\n\n`;
  const sortedLabels = Object.entries(stats.labels)
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  const avgSamples = sortedLabels.reduce((sum, [_, data]) => sum + data.count, 0) / sortedLabels.length;
  const maxSamples = Math.max(...sortedLabels.map(([_, data]) => data.count));
  const minSamples = Math.min(...sortedLabels.map(([_, data]) => data.count));

  report += `- Average samples per label: ${avgSamples.toFixed(2)}\n`;
  report += `- Max samples: ${maxSamples}\n`;
  report += `- Min samples: ${minSamples}\n`;
  report += `- Imbalance ratio: ${(maxSamples / minSamples).toFixed(2)}x\n\n`;

  report += `### Samples by Label (descending)\n\n`;
  for (const [label, data] of sortedLabels) {
    const bar = '█'.repeat(Math.ceil(data.count / 20));
    report += `${label.padEnd(5)} | ${bar} ${data.count}\n`;
  }

  report += `\n`;

  // Issues
  if (stats.issues.length > 0) {
    report += `## Issues Detected ⚠️\n\n`;
    report += `Total issues: ${stats.issues.length}\n\n`;
    
    // Group issues by type
    const issuesByType = {};
    for (const issue of stats.issues) {
      const type = issue.split(':')[0];
      issuesByType[type] = (issuesByType[type] || 0) + 1;
    }

    for (const [type, count] of Object.entries(issuesByType)) {
      report += `### ${type} (${count})\n\n`;
      const typedIssues = stats.issues.filter(i => i.startsWith(type));
      for (const issue of typedIssues.slice(0, 10)) {
        report += `- ${issue}\n`;
      }
      if (typedIssues.length > 10) {
        report += `- ... and ${typedIssues.length - 10} more\n`;
      }
      report += `\n`;
    }
  }

  // Duplicates
  if (stats.duplicateFiles.length > 0) {
    report += `## Duplicate Files\n\n`;
    report += `Found ${stats.duplicateFiles.length} potential duplicate files.\n\n`;
    for (const dup of stats.duplicateFiles.slice(0, 10)) {
      report += `- Hash: ${dup.hash}\n`;
      report += `  Files: ${dup.files.join(', ')}\n`;
    }
    if (stats.duplicateFiles.length > 10) {
      report += `\n... and ${stats.duplicateFiles.length - 10} more duplicates\n`;
    }
    report += `\n`;
  }

  // Recommendations
  report += `## Recommendations\n\n`;
  report += `1. **Data Imbalance**: Consider stratified sampling during training\n`;
  report += `2. **Missing Labels**: ${stats.missingLabels.length > 0 ? `Missing: ${stats.missingLabels.join(', ')}` : 'All labels present'}\n`;
  report += `3. **Duplicates**: ${stats.duplicateFiles.length > 0 ? 'Consider removing duplicate files before training' : 'No duplicates detected'}\n`;
  report += `4. **Format Support**: Focus on ${Object.keys(stats.supportedFormats).join(', ')} formats for extraction\n`;
  report += `5. **Preprocessing**: Need to extract hand landmarks using MediaPipe Hands\n\n`;

  report += `---\n\n`;
  report += `**Next Steps:**\n`;
  report += `1. Run \`npm run extract:fsl-kaggle:landmarks\` to extract MediaPipe landmarks\n`;
  report += `2. Run \`npm run map:fsl-kaggle:labels\` to verify label mapping\n`;
  report += `3. Run \`npm run merge:fsl-datasets\` to combine with custom dataset\n`;

  return report;
};

const main = async () => {
  console.log('🔍 FSL Kaggle Dataset Inspector');
  console.log('================================\n');

  const datasetPath = findDatasetPath();

  if (!datasetPath) {
    console.error('❌ FSL Kaggle dataset not found.');
    console.error(`Expected at: ${KAGGLE_CACHE_PATH}`);
    console.error('\nRun: npm run download:fsl-dataset');
    process.exit(1);
  }

  console.log(`📂 Dataset path: ${datasetPath}\n`);
  console.log('📊 Analyzing dataset structure...');

  const stats = inspectDataset(datasetPath);

  console.log(`✓ Analysis complete\n`);
  console.log(`📈 Dataset Statistics:`);
  console.log(`   Total samples: ${stats.totalSamples}`);
  console.log(`   Total size: ${(stats.totalSize / (1024 ** 3)).toFixed(2)} GB`);
  console.log(`   Unique labels: ${Object.keys(stats.labels).length}`);
  console.log(`   Missing labels: ${stats.missingLabels.length}`);
  console.log(`   Issues detected: ${stats.issues.length}\n`);

  // Generate report
  const report = generateAuditReport(stats, datasetPath);

  // Save report
  ensureDir(path.dirname(AUDIT_OUTPUT));
  fs.writeFileSync(AUDIT_OUTPUT, report);
  console.log(`📝 Audit report saved to: ${AUDIT_OUTPUT}\n`);

  // Save stats as JSON
  const statsOutput = path.join(OUTPUT_DIR, 'fsl_kaggle_stats.json');
  ensureDir(OUTPUT_DIR);
  fs.writeFileSync(statsOutput, JSON.stringify({
    datasetPath,
    timestamp: new Date().toISOString(),
    ...stats
  }, null, 2));
  console.log(`📋 Stats saved to: ${statsOutput}\n`);

  if (stats.missingLabels.length > 0) {
    console.warn(`⚠️  Missing labels: ${stats.missingLabels.join(', ')}`);
  }

  console.log('✓ Inspection complete!');
};

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
