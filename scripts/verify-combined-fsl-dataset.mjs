#!/usr/bin/env node
/**
 * Verify FSL Combined Dataset (Kaggle + Custom)
 * 
 * Validates the merged dataset structure, checks all splits,
 * and verifies label coverage.
 * 
 * Usage: node scripts/verify-combined-fsl-dataset.mjs
 */

import fs from 'fs';
import path from 'path';

const DATASET_DIR = path.join(process.cwd(), 'datasets', 'processed', 'fsl_alphabet_combined');
const OUTPUT_FILE = path.join(process.cwd(), 'docs', 'fsl-combined-dataset-validation.md');

const EXPECTED_LABELS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
  'ñ', 'ng', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
];

const REQUIRED_FILES = [
  'labels.json',
  'metadata.json',
  'train.json',
  'validation.json',
  'test.json'
];

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const validateRequiredFiles = () => {
  const missing = [];
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(DATASET_DIR, file);
    if (!fs.existsSync(filePath)) {
      missing.push(file);
    }
  }
  return missing;
};

const validateLabels = () => {
  const labelsFile = path.join(DATASET_DIR, 'labels.json');
  try {
    const labelsData = JSON.parse(fs.readFileSync(labelsFile, 'utf8'));
    
    if (!Array.isArray(labelsData.labels)) {
      return { error: 'labels is not an array' };
    }
    
    if (labelsData.labels.length !== EXPECTED_LABELS.length) {
      return { error: `Expected ${EXPECTED_LABELS.length} labels, got ${labelsData.labels.length}` };
    }
    
    return { labels: labelsData.labels };
  } catch (err) {
    return { error: err.message };
  }
};

const validateMetadata = () => {
  const metadataFile = path.join(DATASET_DIR, 'metadata.json');
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    
    const issues = [];
    
    if (metadata.sequenceLength !== SEQUENCE_LENGTH) {
      issues.push(`sequenceLength: expected ${SEQUENCE_LENGTH}, got ${metadata.sequenceLength}`);
    }
    
    if (metadata.featureDimension !== FEATURE_DIMENSION) {
      issues.push(`featureDimension: expected ${FEATURE_DIMENSION}, got ${metadata.featureDimension}`);
    }
    
    if (!metadata.splitCounts) {
      issues.push('splitCounts missing');
    }
    
    if (!metadata.sampleCountsByLabel) {
      issues.push('sampleCountsByLabel missing');
    }

    return { metadata, issues };
  } catch (err) {
    return { error: err.message };
  }
};

const validateSplit = (splitName) => {
  const splitFile = path.join(DATASET_DIR, `${splitName}.json`);
  const issues = [];
  let sampleCount = 0;
  let labelCounts = {};

  try {
    const content = fs.readFileSync(splitFile, 'utf8');
    const splitData = JSON.parse(content);

    if (!Array.isArray(splitData.samples)) {
      return { error: 'samples is not an array' };
    }

    sampleCount = splitData.samples.length;

    for (const sample of splitData.samples) {
      // Check required fields
      if (!sample.label) issues.push(`sample missing label in ${splitName}`);
      if (sample.labelId === undefined) issues.push(`sample missing labelId in ${splitName}`);
      if (!sample.sequence) issues.push(`sample missing sequence in ${splitName}`);

      // Count labels
      if (sample.label) {
        labelCounts[sample.label] = (labelCounts[sample.label] || 0) + 1;
      }

      // Validate sequence
      if (sample.sequence && Array.isArray(sample.sequence)) {
        if (sample.sequence.length !== SEQUENCE_LENGTH) {
          issues.push(`sequence length: expected ${SEQUENCE_LENGTH}, got ${sample.sequence.length}`);
          break; // Don't report every sample
        }

        for (let i = 0; i < sample.sequence.length; i++) {
          const frame = sample.sequence[i];
          if (!Array.isArray(frame) || frame.length !== FEATURE_DIMENSION) {
            issues.push(`frame ${i}: expected ${FEATURE_DIMENSION} features, got ${frame.length}`);
            break;
          }

          // Check for invalid numbers
          for (let j = 0; j < frame.length; j++) {
            const val = frame[j];
            if (!Number.isFinite(val)) {
              issues.push(`frame ${i}, feature ${j}: invalid number (${val})`);
              break;
            }
          }
        }
      }
    }

    // Check label coverage
    const missingLabels = [];
    for (const label of EXPECTED_LABELS) {
      if (!(label in labelCounts)) {
        missingLabels.push(label);
      }
    }

    return { sampleCount, labelCounts, missingLabels, issues: issues.slice(0, 20) };
  } catch (err) {
    return { error: err.message };
  }
};

const generateReport = (validationResults) => {
  let report = `# FSL Combined Dataset Validation Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Dataset:** Kaggle FSL + Custom SignLangVisual\n\n`;

  // Files validation
  report += `## File Validation\n\n`;
  if (validationResults.missingFiles.length === 0) {
    report += `✅ All required files present\n\n`;
  } else {
    report += `❌ Missing files:\n`;
    for (const file of validationResults.missingFiles) {
      report += `- ${file}\n`;
    }
    report += `\n`;
  }

  // Labels validation
  report += `## Labels Validation\n\n`;
  if (validationResults.labels.error) {
    report += `❌ Error: ${validationResults.labels.error}\n\n`;
  } else {
    report += `✅ All 28 labels present\n`;
    report += `Labels: ${validationResults.labels.labels.join(', ')}\n\n`;
  }

  // Metadata validation
  report += `## Metadata Validation\n\n`;
  if (validationResults.metadata.error) {
    report += `❌ Error: ${validationResults.metadata.error}\n\n`;
  } else {
    if (validationResults.metadata.issues.length === 0) {
      report += `✅ Metadata valid\n`;
    } else {
      report += `⚠️ Issues found:\n`;
      for (const issue of validationResults.metadata.issues) {
        report += `- ${issue}\n`;
      }
    }
    
    const meta = validationResults.metadata.metadata;
    report += `\n| Property | Value |\n`;
    report += `|----------|-------|\n`;
    report += `| Sequence Length | ${meta.sequenceLength} |\n`;
    report += `| Feature Dimension | ${meta.featureDimension} |\n`;
    report += `| Custom Samples | ${meta.customSamples} |\n`;
    report += `| Kaggle Samples | ${meta.kaggleSamples} |\n`;
    report += `| Total Samples | ${meta.customSamples + meta.kaggleSamples} |\n`;
    report += `| Merged At | ${meta.mergedAt} |\n\n`;
  }

  // Split validation
  report += `## Split Validation\n\n`;
  for (const splitName of ['train', 'validation', 'test']) {
    const splitResult = validationResults.splits[splitName];
    
    if (splitResult.error) {
      report += `### ${splitName} ❌\n\n`;
      report += `Error: ${splitResult.error}\n\n`;
    } else {
      const missingLabelsCount = splitResult.missingLabels?.length || 0;
      const statusIcon = missingLabelsCount === 0 ? '✅' : '⚠️';
      report += `### ${splitName} ${statusIcon}\n\n`;
      report += `- Samples: ${splitResult.sampleCount}\n`;
      report += `- Labels covered: ${Object.keys(splitResult.labelCounts).length}/${EXPECTED_LABELS.length}\n`;

      if (splitResult.missingLabels && splitResult.missingLabels.length > 0) {
        report += `- Missing labels: ${splitResult.missingLabels.join(', ')}\n`;
      }

      if (splitResult.issues && splitResult.issues.length > 0) {
        report += `- Issues (first 20): \n`;
        for (const issue of splitResult.issues) {
          report += `  - ${issue}\n`;
        }
      }

      report += `\n| Label | Count |\n`;
      report += `|-------|-------|\n`;
      for (const label of EXPECTED_LABELS) {
        const count = splitResult.labelCounts[label] || 0;
        report += `| ${label} | ${count} |\n`;
      }
      report += `\n`;
    }
  }

  // Summary
  report += `## Summary\n\n`;
  const allValid = validationResults.missingFiles.length === 0 &&
    !validationResults.labels.error &&
    !validationResults.metadata.error &&
    !validationResults.splits.train.error &&
    !validationResults.splits.validation.error &&
    !validationResults.splits.test.error;

  if (allValid) {
    report += `✅ **Dataset is valid and ready for training**\n\n`;
  } else {
    report += `❌ **Dataset has validation issues**\n\n`;
  }

  report += `### Statistics\n\n`;
  const totalTrain = validationResults.splits.train.sampleCount || 0;
  const totalVal = validationResults.splits.validation.sampleCount || 0;
  const totalTest = validationResults.splits.test.sampleCount || 0;
  const grandTotal = totalTrain + totalVal + totalTest;

  report += `- Train set: ${totalTrain} (${(totalTrain / grandTotal * 100).toFixed(1)}%)\n`;
  report += `- Validation set: ${totalVal} (${(totalVal / grandTotal * 100).toFixed(1)}%)\n`;
  report += `- Test set: ${totalTest} (${(totalTest / grandTotal * 100).toFixed(1)}%)\n`;
  report += `- **Total: ${grandTotal}**\n\n`;

  report += `### Next Steps\n\n`;
  if (allValid) {
    report += `1. Run: \`npm run train:fsl-alphabet:bilstm-v3\`\n`;
    report += `2. Evaluate results and compare with BiLSTM v2 baseline\n`;
    report += `3. If improved, run: \`npm run export:fsl-alphabet:bilstm-v3:tfjs\`\n`;
  } else {
    report += `1. Fix validation issues above\n`;
    report += `2. Re-run verification\n`;
  }

  return report;
};

const main = async () => {
  console.log('✓ FSL Combined Dataset Verification');
  console.log('=' .repeat(45));

  if (!fs.existsSync(DATASET_DIR)) {
    console.error(`❌ Combined dataset not found at ${DATASET_DIR}`);
    console.error(`Run: npm run merge:fsl-datasets`);
    process.exit(1);
  }

  console.log(`\n📂 Dataset directory: ${DATASET_DIR}\n`);

  // Run validations
  const missingFiles = validateRequiredFiles();
  const labels = validateLabels();
  const metadata = validateMetadata();
  const trainSplit = validateSplit('train');
  const valSplit = validateSplit('validation');
  const testSplit = validateSplit('test');

  // Compile results
  const validationResults = {
    missingFiles,
    labels,
    metadata,
    splits: {
      train: trainSplit,
      validation: valSplit,
      test: testSplit
    }
  };

  // Print summary
  console.log('📊 Validation Results:\n');
  
  console.log(`Files: ${missingFiles.length === 0 ? '✅' : '❌'}`);
  if (missingFiles.length > 0) {
    console.log(`  Missing: ${missingFiles.join(', ')}`);
  }

  console.log(`Labels: ${labels.error ? '❌' : '✅'}`);
  console.log(`Metadata: ${metadata.error ? '❌' : '✅'}`);
  console.log(`Train split: ${trainSplit.error ? '❌' : '✅'} (${trainSplit.sampleCount} samples)`);
  console.log(`Validation split: ${valSplit.error ? '❌' : '✅'} (${valSplit.sampleCount} samples)`);
  console.log(`Test split: ${testSplit.error ? '❌' : '✅'} (${testSplit.sampleCount} samples)`);

  // Generate and save report
  const report = generateReport(validationResults);
  ensureDir(path.dirname(OUTPUT_FILE));
  fs.writeFileSync(OUTPUT_FILE, report);

  console.log(`\n📝 Full report saved to: ${OUTPUT_FILE}\n`);

  // Exit with appropriate code
  const allValid = missingFiles.length === 0 && !labels.error && !metadata.error &&
    !trainSplit.error && !valSplit.error && !testSplit.error;

  if (allValid) {
    console.log('✅ Validation passed!');
  } else {
    console.warn('⚠️  Validation failed. Check report for details.');
    process.exit(1);
  }
};

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
