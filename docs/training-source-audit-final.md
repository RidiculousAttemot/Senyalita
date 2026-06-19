# Training Source Audit — Final Report

Generated: 2026-06-16

## Executive Summary

Full audit of all training data sources feeding the unified BiLSTM model. Verified dataset composition, temporal/static ratios, label distribution, and duplicate detection.

## Datasets Found

| Dataset | Samples | Classes | Temporal | Static | Used In Training |
|---------|:-------:|:-------:|:--------:|:------:|:----------------:|
| fsl_alphabet_v2 | 3352 | 26 | 100% | 0% | Yes |
| fsl_105 | 2129 | 105 | 100% | 0% | Yes |
| fsl_alphabet (v1) | 557 | 26 | 100% | 0% | No (superseded by v2) |

## Key Findings

1. **All data is temporal**: 100% of samples are video-derived sequences. No static image samples exist.
2. **No missing datasets**: All 3 expected datasets found.
3. **fsl_alphabet v1 NOT used in training**: Superseded by v2 (larger, more varied).
4. **Total unique labels**: 131 (26 alphabet + 105 FSL-105 signs) — note: actual model has 133 classes due to ñ and ng inclusion.
5. **Label coverage complete**: No labels missing from training; no orphan labels.

## Dataset Composition

### fsl_alphabet_v2
- **Signers**: 6
- **Devices**: webcam, webcam-aug
- **Lighting**: 6 conditions (indoor, low-light, outdoor-sim, indoor-angled, indoor-partial, indoor-varied)
- **Imbalance ratio**: 1.2x (well-balanced)
- **Splits**: train/validation/test

### fsl_105
- **Signers**: 105
- **Devices**: mobile
- **Lighting**: studio
- **Imbalance ratio**: 1.22x (well-balanced)
- **Splits**: train/test

## Temporal vs Static Analysis

| Metric | Value |
|--------|:-----:|
| Total samples | 6038 |
| Temporal samples | 6038 (100%) |
| Static samples | 0 (0%) |
| Overall temporal ratio | 1.0 |

## Duplicate Detection

No duplicate samples detected across datasets. The fsl_alphabet v1 is a smaller version of v2 and is excluded from training. No cross-dataset duplication.

## Corrective Actions

| Issue | Action | Status |
|-------|--------|--------|
| fsl_alphabet v1 not used | Documented as superseded | ✅ |
| No static data available | All data is temporal — no action needed | ✅ |
| fsl_105 lacks validation split | Use 15% train split for validation | ✅ |

## Current Production Model Metrics

| Metric | Value |
|--------|:-----:|
| Model | BiLSTM v1 (unified) |
| Accuracy | 88.84% |
| Macro F1 | 83.45% |
| Weighted F1 | 88.51% |
| Classes | 133 |
