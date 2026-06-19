# Dataset Utilization Audit

## Summary

| Dataset | Source | Samples | Classes | Processed | Landmarks Extracted | Model Trained | Deployed | Used | Notes |
|---------|--------|---------|---------|-----------|-------------------|--------------|----------|------|-------|
| FSL Alphabet v1 | Kaggle FSL (A-Z, 450 images/letter) | 597 | 26 | Yes | Yes | No | No | No | Superseded by v2 |
| FSL Alphabet v2 | Kaggle FSL (augmented, 6 signers) | 3,592 | 26 | Yes | Yes | Yes (in unified) | No | Yes | Component of unified dataset |
| FSL-105 | Kaggle FSL (105 phrases) | 2,129 | 105 | Yes | Yes | Yes (in unified) | No | Yes | Component of unified dataset |
| FSL Unified | Merged alphabet v2 + FSL-105 | 5,721 | 133 | Yes | Yes | Yes (BiLSTM) | Yes | Yes | **Active production dataset** |
| Roboflow v4.5 | Roboflow (forked FSL dataset) | 9,683 | ~50+ | No | Attempted | MLP/LLC (not deployed) | No | No | Redundant with FSL v4.5 |
| FSL v4.5 (forked) | Roboflow export | 9,683 | ~50+ | No | Attempted | MLP/LLC (not deployed) | No | No | Identical to Roboflow dataset |

## Dataset Details

### FSL Alphabet Dataset (v1)
- **Source**: Kaggle FSL Dataset (japorton/fsl-dataset), 450 images per letter A-Z
- **Samples**: 597 processed landmark sequences
- **Classes**: 26 (a-z only; ñ and ng removed during standardization)
- **Signers**: 2 (S01, S02)
- **Processing status**: Fully processed (landmark extraction, train/val/test split 70/15/15)
- **Training status**: No standalone model trained; superseded by v2 before training
- **Landmarks extracted**: Yes (126-dim MediaPipe hand landmarks)
- **Model weights generated**: No
- **Currently deployed**: No
- **Currently unused**: Yes — superseded by alphabet v2
- **Duplicated by**: FSL Alphabet v2 (expanded version with more signers and augmentation)

### FSL Alphabet Dataset (v2)
- **Source**: Extends v1 with 4 additional signers and data augmentation
- **Samples**: 3,592 (2,508 train / 542 val / 542 test)
- **Classes**: 26 (ñ and ng removed to align with Kaggle)
- **Signers**: 6 (S01–S06)
- **Processing status**: Fully processed with augmentation presets (rotation, scale, landmark-noise, temporal-occlusion, mixed)
- **Training status**: Used as alphabet component of unified BiLSTM model
- **Landmarks extracted**: Yes
- **Model weights generated**: Yes (as part of unified model)
- **Currently deployed**: Yes (as part of unified model)
- **Currently unused**: No — actively used

### FSL-105 Dataset
- **Source**: Kaggle FSL Dataset — 105 phrase signs
- **Samples**: 2,129 (1,703 train / 426 test; no validation set)
- **Classes**: 105 (greetings, survival, numbers, calendar, family, colors, food, etc.)
- **Signers**: 105 unique signers (S00–S104)
- **Processing status**: Fully processed
- **Training status**: Used as phrase component of unified BiLSTM model
- **Landmarks extracted**: Yes
- **Model weights generated**: Yes (as part of unified model)
- **Currently deployed**: Yes (as part of unified model)
- **Currently unused**: No — actively used

### FSL Unified Dataset
- **Source**: Merged FSL Alphabet v2 + FSL-105
- **Samples**: 5,721 total (4,211 train / 542 val / 968 test)
- **Classes**: 133 (28 alphabet: a-z, ñ, ng + 105 FSL-105 phrases)
- **Processing status**: Fully processed, standardized, deduplicated
- **Training status**: BiLSTM model trained (28 epochs, early stopping)
- **Landmarks extracted**: Yes
- **Model weights generated**: Yes — exported to TF.js for browser deployment
- **Currently deployed**: Yes — **this is the production model**
- **Currently unused**: No — actively deployed and referenced by runtime code
- **Duplicated by**: None — this is the final merged dataset

### Roboflow Dataset / FSL Dataset v4.5
- **Source**: Roboflow export from https://universe.roboflow.com/arwin-dante/fsl-dataset-v4.5-43khe
- **Samples**: 9,683 images
- **Classes**: Multi-class bounding box annotations (letter and phrase labels)
- **Processing status**: Only image download; no landmark extraction or integration into pipeline
- **Training status**: MLP and LLC models attempted but not deployed
- **Landmarks extracted**: Attempted but not used in production pipeline
- **Model weights generated**: MLP/LLC weights exist locally but not exported to TF.js
- **Currently deployed**: No
- **Currently unused**: Yes — images and annotations exist but are not consumed by any production path
- **Duplicated by**: FSL v4.5 is the SAME dataset as Roboflow (they are identical)

## Forked FSL v4.5 vs Roboflow Dataset Comparison

| Aspect | FSL v4.5 (forked) | Roboflow Dataset |
|--------|-------------------|------------------|
| Source | Roboflow export | Roboflow export |
| URL | universe.roboflow.com/arwin-dante/fsl-dataset-v4.5 | Same |
| Image count | 9,683 | 9,683 |
| Format | TFOD annotations | TFOD annotations |
| README | FSL Dataset v4.5 heading | FSL Dataset v4.5 heading |
| Export date | June 9, 2026 | June 9, 2026 |

**Conclusion: These are the same dataset exported from the same Roboflow project. Duplicate overlap is 100%.**

Since FSL v4.5 and Roboflow are identical, and neither is used in the production pipeline, both should be marked **redundant**. The Roboflow data directory (`roboflow/`) can be removed to save ~133MB.

## Recommendations

1. **Archive FSL Alphabet v1** — superseded by v2
2. **Remove Roboflow dataset** (`roboflow/` directory) — unused, 133MB
3. **Remove `roboflow.zip`** — unused archive
4. **Remove associated roboflow scripts** — `audit:roboflow`, `extract:roboflow`, `prep:roboflow:static`, `train:roboflow:mlp`, `train:roboflow:llc`, `benchmark:roboflow`, `export:unified:bilstm:tfjs` (last one is redundant with main export script)
5. **Keep FSL Alphabet v2, FSL-105, FSL Unified** — these are the active datasets
