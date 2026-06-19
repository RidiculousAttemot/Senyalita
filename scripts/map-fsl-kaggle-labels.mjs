#!/usr/bin/env node
/**
 * Map and Verify FSL Kaggle Labels
 * 
 * Verifies that all FSL alphabet labels are present in the Kaggle dataset,
 * identifies missing labels, and generates mapping documentation.
 * 
 * Usage: node scripts/map-fsl-kaggle-labels.mjs
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const KAGGLE_EXTRACTION_DIR = path.join(process.cwd(), 'datasets', 'external', 'fsl_kaggle_landmarks');
const CUSTOM_DATASET_DIR = path.join(process.cwd(), 'datasets', 'processed', 'fsl_alphabet');
const MAPPING_OUTPUT = path.join(process.cwd(), 'docs', 'fsl-kaggle-label-mapping.md');

// FSL alphabet labels (26 total)
const EXPECTED_LABELS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
  'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
];

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const getKaggleLabelMapping = () => {
  const manifest = path.join(KAGGLE_EXTRACTION_DIR, 'manifest.json');
  
  if (!fs.existsSync(manifest)) {
    console.error(`❌ Kaggle manifest not found at ${manifest}`);
    console.error(`Run: node scripts/extract-fsl-kaggle-landmarks.mjs`);
    return null;
  }

  const manifestData = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const kaggleLabels = manifestData.labels || [];

  return {
    kaggleLabels,
    kaggleCounts: manifestData.labelCounts,
    total: manifestData.totalSamples
  };
};

const getCustomLabelMapping = () => {
  const labelsFile = path.join(CUSTOM_DATASET_DIR, 'labels.json');
  
  if (!fs.existsSync(labelsFile)) {
    console.warn(`⚠️  Custom dataset labels not found at ${labelsFile}`);
    return null;
  }

  const labelsData = JSON.parse(fs.readFileSync(labelsFile, 'utf8'));
  return {
    labels: labelsData.labels,
    labelToId: labelsData.labelToId,
    idToLabel: labelsData.idToLabel
  };
};

const analyzeLabelMapping = (kaggleData, customData) => {
  const mapping = {
    matched: [],
    missing: [],
    kaggleOnly: [],
    analysis: {
      coverage: 0,
      missingCount: 0,
      kaggleOnlyCount: 0
    }
  };

  // Check each expected label
  for (const label of EXPECTED_LABELS) {
    if (kaggleData.kaggleLabels.includes(label)) {
      mapping.matched.push({
        label,
        source: 'kaggle',
        count: kaggleData.kaggleCounts[label] || 0,
        customCount: customData?.labelToId?.[label] !== undefined ? 
          (customData.labelToId[label] || 0) : null
      });
    } else {
      mapping.missing.push(label);
      mapping.analysis.missingCount += 1;
    }
  }

  // Check for Kaggle-only labels
  for (const label of kaggleData.kaggleLabels) {
    if (!EXPECTED_LABELS.includes(label)) {
      mapping.kaggleOnly.push({
        label,
        count: kaggleData.kaggleCounts[label]
      });
      mapping.analysis.kaggleOnlyCount += 1;
    }
  }

  mapping.analysis.coverage = ((EXPECTED_LABELS.length - mapping.analysis.missingCount) / EXPECTED_LABELS.length * 100).toFixed(2);

  return mapping;
};

const generateMappingReport = (mapping, kaggleData, customData) => {
  let report = `# FSL Kaggle Dataset Label Mapping\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;

  // Coverage Summary
  report += `## Label Coverage Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Expected FSL Labels | ${EXPECTED_LABELS.length} |\n`;
  report += `| Kaggle Labels Found | ${kaggleData.kaggleLabels.length} |\n`;
  report += `| Matched Labels | ${mapping.matched.length} |\n`;
  report += `| Missing Labels | ${mapping.missing.length} |\n`;
  report += `| Coverage | ${mapping.analysis.coverage}% |\n`;
  report += `| Total Kaggle Samples | ${kaggleData.total} |\n\n`;

  // Detailed Label Mapping
  report += `## Label Mapping Details\n\n`;
  report += `### Matched Labels ✓\n\n`;
  report += `| Label | Kaggle Count | Custom Count | Total |\n`;
  report += `|-------|--------------|--------------|-------|\n`;

  for (const match of mapping.matched) {
    const customCount = match.customCount || 0;
    const total = match.count + customCount;
    report += `| ${match.label.padEnd(5)} | ${String(match.count).padStart(12)} | ${String(customCount).padStart(12)} | ${total} |\n`;
  }

  report += `\n`;

  if (mapping.missing.length > 0) {
    report += `### Missing Labels ⚠️\n\n`;
    report += `These FSL alphabet labels are not present in the Kaggle dataset:\n\n`;
    for (const label of mapping.missing) {
      const customCount = customData?.labelToId?.[label];
      const status = customCount ? `(Available in custom: ${customCount})` : '(Not in custom either)';
      report += `- **${label}** ${status}\n`;
    }
    report += `\n`;
  }

  if (mapping.kaggleOnly.length > 0) {
    report += `### Kaggle-Only Labels\n\n`;
    report += `These labels are in Kaggle but not in the standard FSL alphabet set:\n\n`;
    for (const extra of mapping.kaggleOnly) {
      report += `- ${extra.label}: ${extra.count} samples\n`;
    }
    report += `\n`;
  }

  // Label Distribution
  report += `## Label Distribution Comparison\n\n`;
  report += `Showing samples per label for combined dataset (Kaggle + Custom).\n\n`;

  const allLabels = [...new Set([
    ...EXPECTED_LABELS,
    ...kaggleData.kaggleLabels.filter(l => !EXPECTED_LABELS.includes(l))
  ])];

  const maxCount = Math.max(
    ...allLabels.map(l => {
      const kaggleCount = kaggleData.kaggleCounts[l] || 0;
      const customCount = customData?.labelToId?.[l] || 0;
      return kaggleCount + customCount;
    })
  );

  report += `| Label | Kaggle | Custom | Total | Distribution |\n`;
  report += `|-------|--------|--------|-------|---------------|\n`;

  for (const label of allLabels) {
    const kaggleCount = kaggleData.kaggleCounts[label] || 0;
    const customCount = customData?.labelToId?.[label] || 0;
    const total = kaggleCount + customCount;
    const barLength = Math.ceil((total / maxCount) * 30);
    const bar = '█'.repeat(barLength);
    report += `| ${label.padEnd(5)} | ${String(kaggleCount).padStart(6)} | ${String(customCount).padStart(6)} | ${String(total).padStart(5)} | ${bar} |\n`;
  }

  report += `\n`;

  // Mapping Status
  report += `## Mapping Status\n\n`;

  if (mapping.missing.length === 0) {
    report += `✅ **All FSL alphabet labels are present in the Kaggle dataset**\n\n`;
  } else {
    report += `⚠️ **Missing FSL labels:**\n`;
    report += `- Count: ${mapping.missing.length}/${EXPECTED_LABELS.length}\n`;
    report += `- Labels: ${mapping.missing.join(', ')}\n\n`;
    report += `**Recommendation:** These missing labels can be filled from the custom SignLangVisual dataset during merge.\n\n`;
  }

  // Recommendations
  report += `## Recommendations\n\n`;
  report += `1. **Label Mapping:** Use 1:1 mapping between Kaggle labels and FSL alphabet\n`;
  report += `2. **Missing Labels:** Will be supplemented from custom dataset\n`;
  report += `3. **Data Augmentation:** Kaggle data is already augmented (multiple crops per sign)\n`;
  report += `4. **Class Balance:** After merge, perform stratified sampling to balance classes\n`;
  report += `5. **Validation:** Ensure merged dataset maintains label distribution during split\n\n`;

  // Next Steps
  report += `## Next Steps\n\n`;
  report += `1. Run: \`npm run merge:fsl-datasets\`\n`;
  report += `2. Run: \`npm run validate:dataset\`\n`;
  report += `3. Run: \`npm run train:fsl-alphabet:bilstm-v3\`\n`;

  return report;
};

const main = async () => {
  console.log('🗂️  FSL Kaggle Label Mapping');
  console.log('=' .repeat(45));

  // Load Kaggle data
  const kaggleData = getKaggleLabelMapping();
  if (!kaggleData) {
    process.exit(1);
  }

  // Load custom data
  const customData = getCustomLabelMapping();

  console.log(`\n📊 Label Analysis:`);
  console.log(`   Kaggle labels found: ${kaggleData.kaggleLabels.length}`);
  console.log(`   Expected FSL labels: ${EXPECTED_LABELS.length}`);
  if (customData) {
    console.log(`   Custom labels: ${customData.labels.length}`);
  }

  // Analyze mapping
  const mapping = analyzeLabelMapping(kaggleData, customData);

  console.log(`\n✓ Mapping Analysis Complete:`);
  console.log(`   Matched: ${mapping.matched.length}`);
  console.log(`   Missing: ${mapping.missing.length}`);
  console.log(`   Coverage: ${mapping.analysis.coverage}%\n`);

  if (mapping.missing.length > 0) {
    console.warn(`⚠️  Missing labels: ${mapping.missing.join(', ')}`);
  }

  // Generate report
  const report = generateMappingReport(mapping, kaggleData, customData);

  // Save report
  ensureDir(path.dirname(MAPPING_OUTPUT));
  fs.writeFileSync(MAPPING_OUTPUT, report);
  console.log(`\n📝 Mapping report saved to: ${MAPPING_OUTPUT}`);

  // Save mapping as JSON
  const mappingJsonPath = path.join(process.cwd(), 'datasets', 'external', 'fsl_kaggle_mapping.json');
  ensureDir(path.dirname(mappingJsonPath));
  fs.writeFileSync(mappingJsonPath, JSON.stringify(mapping, null, 2));
  console.log(`📋 Mapping JSON saved to: ${mappingJsonPath}\n`);

  console.log('✓ Label mapping complete!');
};

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
