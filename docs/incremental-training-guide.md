# Incremental Training Guide

## Overview

The incremental retraining pipeline allows you to retrain the BiLSTM v1 production model with new data without rebuilding the entire pipeline. It supports three data sources:

1. **Current production dataset** — The existing `fsl_unified` training data
2. **Approved review samples** — Corrections accepted through the active learning workflow
3. **New real-world collections** — Data from targeted collection campaigns

## Prerequisites

- Node.js 18+
- Supabase credentials in `.env.local`
- Existing production model at `models/fsl_unified/bilstm/`
- Training script at `scripts/train-unified-bilstm.mjs`

## Quick Start

```bash
# Dry run — preview what would be included
node scripts/incremental-retrain.mjs --dry-run

# Full retrain with training samples and campaigns
node scripts/incremental-retrain.mjs \
  --include-training-samples \
  --include-campaigns \
  --epochs 30 \
  --lr 0.002

# Retrain with only approved review corrections
node scripts/incremental-retrain.mjs \
  --include-training-samples \
  --epochs 20 \
  --lr 0.001
```

## Pipeline Steps

### Step 1: Dataset Composition Analysis

The script analyzes three data sources:

| Source | Flag | Description |
|--------|------|-------------|
| Production dataset | Always included | `datasets/processed/fsl_unified/` |
| Training samples | `--include-training-samples` | Approved samples from Supabase `training_samples` table |
| Campaign data | `--include-campaigns` | Campaign targets from `datasets/real_world/campaigns/` |

### Step 2: Coverage Check

The script checks low-F1 labels against available new data:

- **GOOD** — >= 15 new samples available
- **PARTIAL** — 5-14 new samples
- **NEEDS MORE** — < 5 new samples

### Step 3: Manifest Generation

A `manifest.json` is created with:
- Dataset version string
- Sample counts per source
- Approved-by-label distribution
- Training hyperparameters

### Step 4: Training Launch

The script delegates to `scripts/train-unified-bilstm.mjs` with the composed dataset. The BiLSTM v1 architecture is preserved:

- 2-layer Bidirectional LSTM (hidden size: 32)
- Input shape: `[120, 126]`
- Output: 133 classes
- Dropout: 0.2
- Optimizer: Adam (LR: 0.002)
- Early stopping: patience 12 epochs
- Gradient clipping: 1.0

### Step 5: Model Export

After training, export to TF.js format:

```bash
node scripts/export-unified-bilstm-tfjs.mjs "models/fsl_unified_retrained"
```

### Step 6: Database Registration

Register the new dataset version:

```sql
INSERT INTO public.dataset_versions (
  version, dataset_name, sample_count, class_count, signer_count,
  source_breakdown, is_production, parent_version, change_log
) VALUES (
  '1.1.0', 'fsl_unified', <total_samples>, 133, <signer_count>,
  '{"fsl_unified": 5721, "training_samples": <n>, "campaigns": <n>}'::jsonb,
  false, '1.0.0',
  'Incremental retraining: added approved corrections and campaign data'
);
```

### Step 7: Model Registration

```sql
INSERT INTO public.model_versions (
  version, accuracy, dataset_size, num_classes, architecture, is_active, notes
) VALUES (
  '1.1.0', <new_accuracy>, <total_samples>, 133, 'BiLSTM', false,
  'Incremental retrain from dataset version 1.1.0'
);
```

### Step 8: Validation

Before promoting to production:

```bash
# Evaluate the new model
node scripts/evaluate-bilstm-v2-confidence.mjs --model "models/fsl_unified_retrained"

# Benchmark runtime
node scripts/runtime-benchmark.mjs --model "models/fsl_unified_retrained"
```

## Production Promotion Criteria

Only promote if all criteria are met:

| Metric | Threshold |
|--------|-----------|
| Accuracy | > 90% |
| Macro F1 | > 85% |
| Runtime | <= 12.9ms (equal or better than v1) |
| Mobile performance | Unchanged |

To promote:

```bash
# Deploy TF.js model to public directory
cp -r models/fsl_unified_retrained/bilstm_tfjs/* public/models/fsl_unified/bilstm_tfjs/

# Update active model version
UPDATE public.model_versions SET is_active = false WHERE is_active = true;
UPDATE public.model_versions SET is_active = true WHERE version = '1.1.0';
```

## Dataset Versioning

Each retraining creates a new dataset version:

| Version | Description |
|---------|-------------|
| 1.0.0 | Initial production dataset (5,721 samples) |
| 1.1.0 | First incremental: +approved samples (~50-200) |
| 1.2.0 | Second incremental: +campaign data (~160) |
| 2.0.0 | Major expansion: new data sources or class set |

## Rollback

To roll back to previous production model:

1. Restore previous TF.js model files
2. Activate previous `model_versions` record
3. Restore previous `dataset_versions` as production

## Performance Monitoring

After deploying the retrained model:

```bash
# Monitor daily metrics
node scripts/monitor-longitudinal-performance.mjs --days 30

# Compare with previous model
node scripts/analyze-signer-diversity.mjs --days 30
```
