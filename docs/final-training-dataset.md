# Final Training Dataset — FSL Alphabet Combined

**Generated:** 2026-06-28

## Dataset Composition

| Component | Samples | Source |
|-----------|---------|--------|
| Custom FSL Alphabet | 557 | Browser capture + MediaPipe landmarks |
| Kaggle FSL Alphabet | 10,865 | `japorton/fsl-dataset` → MediaPipe extraction |
| **Total Combined** | **11,422** | Merged via `scripts/merge-fsl-datasets.mjs` |

## Split Breakdown

| Split | Samples | Percentage |
|-------|---------|------------|
| Train | 7,983 | 69.9% |
| Validation | 1,700 | 14.9% |
| Test | 1,739 | 15.2% |
| **Total** | **11,422** | **100%** |

## Class Distribution

| Label | Train | Validation | Test | Total | % of Total |
|-------|-------|------------|------|-------|------------|
| a | 293 | 62 | 63 | 418 | 3.66% |
| b | 329 | 70 | 70 | 469 | 4.11% |
| c | 281 | 60 | 60 | 401 | 3.51% |
| d | 327 | 69 | 70 | 466 | 4.08% |
| e | 316 | 67 | 68 | 451 | 3.95% |
| f | 330 | 70 | 71 | 471 | 4.12% |
| g | 329 | 70 | 71 | 470 | 4.11% |
| h | 330 | 70 | 71 | 471 | 4.12% |
| i | 329 | 70 | 70 | 469 | 4.11% |
| j | 327 | 70 | 70 | 467 | 4.09% |
| k | 329 | 70 | 70 | 469 | 4.11% |
| l | 316 | 67 | 68 | 451 | 3.95% |
| m | 251 | 53 | 54 | 358 | 3.13% |
| n | 263 | 56 | 56 | 375 | 3.28% |
| o | 244 | 52 | 52 | 348 | 3.05% |
| p | 317 | 67 | 68 | 452 | 3.96% |
| q | 264 | 56 | 57 | 377 | 3.30% |
| r | 328 | 70 | 70 | 468 | 4.10% |
| s | 255 | 54 | 54 | 363 | 3.18% |
| t | 326 | 69 | 70 | 465 | 4.07% |
| u | 331 | 70 | 71 | 472 | 4.13% |
| v | 317 | 67 | 68 | 452 | 3.96% |
| w | 329 | 70 | 70 | 469 | 4.11% |
| x | 315 | 67 | 67 | 449 | 3.93% |
| y | 325 | 69 | 69 | 463 | 4.05% |
| z | 307 | 65 | 66 | 438 | 3.83% |

## Dataset Statistics

| Metric | Value |
|--------|-------|
| Number of classes | 26 (a-z) |
| Max samples per class | 472 (u) |
| Min samples per class | 348 (o) |
| Imbalance ratio | 1.36x |
| Sequence length | 120 frames |
| Feature dimension | 126 (2 hands × 21 landmarks × 3 coords) |
| Duplicate rate | 0% (no duplicates detected) |
| NaN values | 0 |
| Augmentation | None applied (raw landmarks) |

## Comparison with Previous Datasets

| Dataset | Samples | Classes | Imbalance | Source |
|---------|---------|---------|-----------|--------|
| fsl_alphabet (v1) | 597 | 28 | 1.0x | Custom only |
| fsl_alphabet_v2 | 3,592 | 26 | ~1.0x | Custom + augmentation |
| **fsl_alphabet_combined** | **11,422** | **26** | **1.36x** | Custom + Kaggle |

## Kaggle Extraction Quality

| Metric | Value |
|--------|-------|
| Source images | 11,700 |
| Successful extractions | 10,865 (92.9%) |
| No-hands skipped | 835 (7.1%) |
| Failed | 0 |
| Extraction method | MediaPipe tasks-vision via Puppeteer |

## Notes

- The imbalance ratio is low (1.36x) due to stratified splitting
- No additional augmentation was applied to preserve landmark integrity
- All 26 labels have sufficient representation across all splits
- The combined dataset provides **3.2x more data** than the previous v2 dataset
