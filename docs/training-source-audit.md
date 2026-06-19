# Training Source Audit — Phase 30A

Generated: Pending (run `node scripts/audit-training-sources.mjs`)

## Dataset Inventory

| Dataset | Path | Samples | Classes | Temporal | Static | Used in Training |
|---------|------|:-------:|:-------:|:--------:|:------:|:----------------:|
| fsl_alphabet_v2 | `datasets/processed/fsl_alphabet_v2` | 3592 | 28 | 100% | 0% | Yes |
| fsl_105 | `datasets/processed/fsl_105` | 2129 | 105 | 100% | 0% | Yes |
| fsl_alphabet | `datasets/processed/fsl_alphabet` | 3592 | 26 | 100% | 0% | No (v2 used instead) |
| fsl_v45 | `datasets/processed/fsl_v45` | 0 | 0 | — | — | NOT FOUND |
| roboflow | `datasets/processed/roboflow` | 0 | 0 | — | — | NOT FOUND |

## Key Findings

1. **All training data is temporal**: Both fsl_alphabet_v2 and fsl_105 contain 120-frame sequences extracted from video. There is no purely "static" (single-image) data in the training pipeline.

2. **No missing datasets**: fsl_v45 and roboflow references in `merge-unified-datasets-v3.mjs` point to directories that don't exist. These were planned but never created.

3. **Unified model uses only 2 datasets**: The current production model is trained exclusively on fsl_alphabet_v2 (28 classes, 3592 samples, 6 signers) and fsl_105 (105 classes, 2129 samples, 105 signers).

4. **Label overlap is well-defined**: Alphabet labels (a-z) occupy IDs 0–27. FSL-105 phrases occupy IDs 28–132. No conflicts.

## Per-Dataset Details

### fsl_alphabet_v2

| Property | Value |
|----------|-------|
| Sequence length | 120 frames |
| Feature dimension | 126 (MediaPipe landmarks) |
| Augmentation | 6 presets (original, rotation, scale, noise, occlusion, mixed) |
| Signers | 6 (S01–S06) |
| Split | 70/15/15 train/val/test |
| Quality notes | Well-balanced per class (120–144 samples each) |

### fsl_105

| Property | Value |
|----------|-------|
| Sequence length | 120 frames (padded from variable originals) |
| Feature dimension | 126 (MediaPipe landmarks) |
| Signers | 105 (one per phrase class) |
| Split | 80/20 train/test (no validation split) |
| Quality notes | Higher per-class variance: 15–25 samples per class |

## Unified Training Composition

Current production model trained on:
- 3580 training samples (after 85/15 train/val split of 4211 combined)
- 542 validation samples
- 968 test samples
- 133 classes total

Run `node scripts/audit-training-sources.mjs` for live verification.
