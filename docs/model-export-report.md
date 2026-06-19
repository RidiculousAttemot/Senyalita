# Model Export Report

Generated: 2026-06-16

## Decision

**Export SKIPPED** — v3 did not meet deployment threshold.

## Requirements Check

| Criterion | Target | v3 Result | Status |
|-----------|:------:|:---------:|:------:|
| Accuracy ≥ 92% | 92.00% | 39.38% | ❌ Not met |
| Macro F1 ≥ 88% | 88.00% | 17.85% | ❌ Not met |

## Rationale

BiLSTM v3 failed to converge to production-quality metrics. The model achieved only 39.38% test accuracy (target: 92%) and 17.85% macro F1 (target: 88%). Exporting this model would degrade production performance significantly.

## Current Production Export

v1 model remains exported at:
- `public/models/fsl_unified/bilstm_tfjs/`
- Format: TensorFlow.js (model.json + weights.bin)
- Labels: 133 classes
- Version: 1.0.0

## Future Export

If future v3 training achieves the required metrics:
1. Run `node scripts/export-unified-bilstm-tfjs.mjs` with v3 weights
2. Target: `models/fsl_unified_v3_tfjs/`
3. Generate model metadata and version manifest
