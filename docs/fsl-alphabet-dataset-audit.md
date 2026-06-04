# FSL Alphabet Dataset Audit

Audit date: 2026-06-04

## Overview

| Metric | Value |
|--------|-------|
| Total processed samples | 3592 |
| Total raw recordings | 3592 |
| Number of labels | 28 |
| Number of signers | 6 |
| Sequence length | 120 frames |
| Feature dimension | 126 |
| Average original frame count | 90.5 |
| Feature sparsity (% zero) | 73.77% |
| Split strategy | stratified-by-label |

## Split Distribution

| Split | Samples | Percentage |
|-------|---------|------------|
| Train | 2508 | 69.8% |
| Validation | 542 | 15.1% |
| Test | 542 | 15.1% |

## Label Distribution

| Label | Raw Files | Processed Samples |
|-------|-----------|-------------------|
| a | 136 | 136 |
| b | 132 | 132 |
| c | 120 | 120 |
| d | 138 | 138 |
| e | 126 | 126 |
| f | 126 | 126 |
| g | 132 | 132 |
| h | 126 | 126 |
| i | 132 | 132 |
| j | 126 | 126 |
| k | 132 | 132 |
| l | 126 | 126 |
| m | 126 | 126 |
| n | 126 | 126 |
| ñ | 120 | 120 |
| ng | 120 | 120 |
| o | 132 | 132 |
| p | 120 | 120 |
| q | 126 | 126 |
| r | 126 | 126 |
| s | 126 | 126 |
| t | 126 | 126 |
| u | 132 | 132 |
| v | 126 | 126 |
| w | 144 | 144 |
| x | 132 | 132 |
| y | 138 | 138 |
| z | 120 | 120 |

**Statistics**: min=120, max=144, mean=128.3, std=6.0

## Signer Distribution

| Signer | Total Samples | Augmentation Type |
|--------|---------------|-------------------|
| S01 | 597 | Original (real recordings) |
| S02 | 599 | Rotation (±10°) |
| S03 | 599 | Scale (0.85-1.15) |
| S04 | 599 | Landmark noise (σ=0.015) |
| S05 | 599 | Temporal occlusion (8%) |
| S06 | 599 | Mixed (rotation+scale+noise+occlusion) |

### Per-Signer Label Breakdown

**S01** (597 total):

| Label | Count |
|-------|-------|
| a | 21 |
| b | 22 |
| c | 20 |
| d | 23 |
| e | 21 |
| f | 21 |
| g | 22 |
| h | 21 |
| i | 22 |
| j | 21 |
| k | 22 |
| l | 21 |
| m | 21 |
| n | 21 |
| ñ | 20 |
| ng | 20 |
| o | 22 |
| p | 20 |
| q | 21 |
| r | 21 |
| s | 21 |
| t | 21 |
| u | 22 |
| v | 21 |
| w | 24 |
| x | 22 |
| y | 23 |
| z | 20 |

**S02** (599 total):

| Label | Count |
|-------|-------|
| a | 23 |
| b | 22 |
| c | 20 |
| d | 23 |
| e | 21 |
| f | 21 |
| g | 22 |
| h | 21 |
| i | 22 |
| j | 21 |
| k | 22 |
| l | 21 |
| m | 21 |
| n | 21 |
| ñ | 20 |
| ng | 20 |
| o | 22 |
| p | 20 |
| q | 21 |
| r | 21 |
| s | 21 |
| t | 21 |
| u | 22 |
| v | 21 |
| w | 24 |
| x | 22 |
| y | 23 |
| z | 20 |

**S03** (599 total):

| Label | Count |
|-------|-------|
| a | 23 |
| b | 22 |
| c | 20 |
| d | 23 |
| e | 21 |
| f | 21 |
| g | 22 |
| h | 21 |
| i | 22 |
| j | 21 |
| k | 22 |
| l | 21 |
| m | 21 |
| n | 21 |
| ñ | 20 |
| ng | 20 |
| o | 22 |
| p | 20 |
| q | 21 |
| r | 21 |
| s | 21 |
| t | 21 |
| u | 22 |
| v | 21 |
| w | 24 |
| x | 22 |
| y | 23 |
| z | 20 |

**S04** (599 total):

| Label | Count |
|-------|-------|
| a | 23 |
| b | 22 |
| c | 20 |
| d | 23 |
| e | 21 |
| f | 21 |
| g | 22 |
| h | 21 |
| i | 22 |
| j | 21 |
| k | 22 |
| l | 21 |
| m | 21 |
| n | 21 |
| ñ | 20 |
| ng | 20 |
| o | 22 |
| p | 20 |
| q | 21 |
| r | 21 |
| s | 21 |
| t | 21 |
| u | 22 |
| v | 21 |
| w | 24 |
| x | 22 |
| y | 23 |
| z | 20 |

**S05** (599 total):

| Label | Count |
|-------|-------|
| a | 23 |
| b | 22 |
| c | 20 |
| d | 23 |
| e | 21 |
| f | 21 |
| g | 22 |
| h | 21 |
| i | 22 |
| j | 21 |
| k | 22 |
| l | 21 |
| m | 21 |
| n | 21 |
| ñ | 20 |
| ng | 20 |
| o | 22 |
| p | 20 |
| q | 21 |
| r | 21 |
| s | 21 |
| t | 21 |
| u | 22 |
| v | 21 |
| w | 24 |
| x | 22 |
| y | 23 |
| z | 20 |

**S06** (599 total):

| Label | Count |
|-------|-------|
| a | 23 |
| b | 22 |
| c | 20 |
| d | 23 |
| e | 21 |
| f | 21 |
| g | 22 |
| h | 21 |
| i | 22 |
| j | 21 |
| k | 22 |
| l | 21 |
| m | 21 |
| n | 21 |
| ñ | 20 |
| ng | 20 |
| o | 22 |
| p | 20 |
| q | 21 |
| r | 21 |
| s | 21 |
| t | 21 |
| u | 22 |
| v | 21 |
| w | 24 |
| x | 22 |
| y | 23 |
| z | 20 |


## Class Balance

Raw data: 120-144 samples per label (20% variation)
Standard deviation: 6.0 samples

### Most Underrepresented Labels

- c: 120 samples
- ñ: 120 samples
- ng: 120 samples
- p: 120 samples
- z: 120 samples

### Most Overrepresented Labels

- w: 144 samples

## Duplicate Check

No duplicate filenames found across label directories.

## Quality Notes

- All ${LABELS.length} labels are represented in the dataset.
- Each signer has samples for all 28 labels.
- Augmented samples preserve wrist-centered normalization.
- Feature sparsity (~${((1 - totalProcessedNonZero / totalProcessedValues) * 100).toFixed(1)}%) is due to missing hand slots and zero-padding.
- Original S01 recordings are unaugmented real MediaPipe hand tracking data.
- S02-S06 are synthetic signers generated via landmark-level augmentation.
- Cross-signer evaluation measures generalization across augmentation types.

## Limitations

- All augmented samples derive from the original S01 recordings — not true multi-signer data.
- Real-world multi-signer evaluation requires collecting data from different people.
- Augmentation patterns (rotation, scale, noise) may not fully capture real inter-signer variation.
- Temporal occlusion simulates tracking dropout but not actual hand shape variation.