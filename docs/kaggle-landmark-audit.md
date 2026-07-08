# Kaggle Landmark Extraction Audit

**Generated:** 2026-06-28T06:03:21.051Z

## Summary

| Metric | Value |
|--------|-------|
| Source Images | 11700 |
| Extracted | 10865 (92.9%) |
| Success Rate | 92.9% |
| No-Hands Skipped | 835 (7.1%) |
| Failed | 0 |
| Unique Labels | 26 |
| Samples with NaN | 0 |
| All-Zero Sequences | 0 |
| Missing Sequences | 0 |
| Duplicates Found | 0 |
| Imbalance Ratio | 1.38x |
| Feature Dimension | 126 |
| Sequence Length | 120 |

## Per-Label Breakdown

| Label | Expected | Extracted | % | NaN | Zero-Seq | Missing |
|-------|----------|-----------|----|-----|----------|---------|
| a | 450 | 397 | 88.2% | 0 | 0 | 0 |
| b | 450 | 447 | 99.3% | 0 | 0 | 0 |
| c | 450 | 381 | 84.7% | 0 | 0 | 0 |
| d | 450 | 443 | 98.4% | 0 | 0 | 0 |
| e | 450 | 430 | 95.6% | 0 | 0 | 0 |
| f | 450 | 450 | 100.0% | 0 | 0 | 0 |
| g | 450 | 448 | 99.6% | 0 | 0 | 0 |
| h | 450 | 450 | 100.0% | 0 | 0 | 0 |
| i | 450 | 447 | 99.3% | 0 | 0 | 0 |
| j | 450 | 446 | 99.1% | 0 | 0 | 0 |
| k | 450 | 447 | 99.3% | 0 | 0 | 0 |
| l | 450 | 430 | 95.6% | 0 | 0 | 0 |
| m | 450 | 337 | 74.9% | 0 | 0 | 0 |
| n | 450 | 354 | 78.7% | 0 | 0 | 0 |
| o | 450 | 326 | 72.4% | 0 | 0 | 0 |
| p | 450 | 432 | 96.0% | 0 | 0 | 0 |
| q | 450 | 356 | 79.1% | 0 | 0 | 0 |
| r | 450 | 447 | 99.3% | 0 | 0 | 0 |
| s | 450 | 342 | 76.0% | 0 | 0 | 0 |
| t | 450 | 444 | 98.7% | 0 | 0 | 0 |
| u | 450 | 450 | 100.0% | 0 | 0 | 0 |
| v | 450 | 431 | 95.8% | 0 | 0 | 0 |
| w | 450 | 445 | 98.9% | 0 | 0 | 0 |
| x | 450 | 427 | 94.9% | 0 | 0 | 0 |
| y | 450 | 440 | 97.8% | 0 | 0 | 0 |
| z | 450 | 418 | 92.9% | 0 | 0 | 0 |

## Class Balance

| Label | Count | % of Total | Diff from Avg |
|-------|-------|------------|---------------|
| a | 397 | 3.65% | -21 |
| b | 447 | 4.11% | 29 |
| c | 381 | 3.51% | -37 |
| d | 443 | 4.08% | 25 |
| e | 430 | 3.96% | 12 |
| f | 450 | 4.14% | 32 |
| g | 448 | 4.12% | 30 |
| h | 450 | 4.14% | 32 |
| i | 447 | 4.11% | 29 |
| j | 446 | 4.10% | 28 |
| k | 447 | 4.11% | 29 |
| l | 430 | 3.96% | 12 |
| m | 337 | 3.10% | -81 |
| n | 354 | 3.26% | -64 |
| o | 326 | 3.00% | -92 |
| p | 432 | 3.98% | 14 |
| q | 356 | 3.28% | -62 |
| r | 447 | 4.11% | 29 |
| s | 342 | 3.15% | -76 |
| t | 444 | 4.09% | 26 |
| u | 450 | 4.14% | 32 |
| v | 431 | 3.97% | 13 |
| w | 445 | 4.10% | 27 |
| x | 427 | 3.93% | 9 |
| y | 440 | 4.05% | 22 |
| z | 418 | 3.85% | 0 |

## Interpretation

- **92.9%** of images produced usable hand landmarks.
- **7.1%** had no detectable hands (blurry, occluded, or non-hand images).
- No NaN/infinite values detected.
- No all-zero sequences detected.
- Class imbalance ratio: **1.38x** — the most common label has 1.38x the samples of the rarest.
- **0** potential duplicates found across the dataset.

## Recommendation

The extracted Kaggle landmarks are ready for merging with the custom dataset. No corrupt entries found.

---
_Audit generated automatically by `scripts/audit-kaggle-landmarks.mjs`_