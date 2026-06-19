# Temporal vs Static Study

Generated: 2026-06-16

## Overview

Three controlled experiments to determine whether static (alphabet) data helps or hurts temporal
(phrase) recognition in the unified model.

## Experiment Design

### Model A — Temporal Only

Uses only FSL-105 phrase data (105 classes). Excludes all alphabet static-image-derived samples.

| Property | Value |
|----------|-------|
| Datasets | fsl_105 |
| Classes | 105 |
| Samples | ~2129 |
| Temporal ratio | 100% |

### Model B — Alphabet Only

Uses only fsl_alphabet_v2 (28 classes). Tests whether alphabet-level features are learned
effectively from static-derived single-frame data.

| Property | Value |
|----------|-------|
| Datasets | fsl_alphabet_v2 |
| Classes | 28 |
| Samples | ~3592 |
| Temporal ratio | 100% (video-derived sequences) |

### Model C — Hybrid (Current Unified)

Uses both datasets combined (133 classes). This is the current production approach.

| Property | Value |
|----------|-------|
| Datasets | fsl_alphabet_v2 + fsl_105 |
| Classes | 133 |
| Samples | ~5721 |
| Temporal ratio | 100% |

## Current Best Metrics

| Model | Accuracy | Macro F1 | Weighted F1 |
|-------|:--------:|:--------:|:-----------:|
| Current production (unified v1) | 88.84% | 83.45% | 88.51% |
| BiLSTM v2 | N/A | N/A | N/A |

## How to Run

```
# Model A — Temporal only
node scripts/train-fsl-105-bilstm.mjs

# Model B — Alphabet only
node scripts/train-fsl-alphabet-bilstm-v2.mjs

# Model C — Hybrid (unified)
node scripts/merge-unified-datasets-v3.mjs
node scripts/train-unified-bilstm-v2.mjs
```

## Analysis Notes

- All three models use the same underlying BiLSTM architecture
- Alphabet data is NOT truly "static" — it contains 120-frame temporal sequences extracted from video
- The distinction is that alphabet data has minimal motion (single letter hand shapes) vs phrases
  which have complex motion trajectories
- Expected: Model C (hybrid) will outperform both A and B due to larger training set
- Key question: Does adding alphabet data degrade phrase recognition accuracy?
  → Compare phrase-level accuracy between Model A and Model C

## Dataset Truth

| Dataset | Samples | Classes | Temporal | Static | Used By |
|---------|---------|---------|----------|--------|---------|
| fsl_alphabet_v2 | 3592 | 28 | 100% | 0% | Models B, C |
| fsl_105 | 2129 | 105 | 100% | 0% | Models A, C |
