# Dataset Lineage Report

## Summary

| Dataset | Used in Training | Used in Production | Samples | Classes | Status |
|---------|-----------------|-------------------|---------|---------|--------|
| Custom FSL Alphabet (raw) | Yes (v1, v2) | No | ~2,133 videos | 28 | Historical |
| Custom FSL Alphabet (processed v1) | Yes (baseline, LSTM, BiLSTM v1, CNN-LSTM) | No | ~10K sequences | 28 | **Active for training** |
| FSL Alphabet v2 (processed) | Yes (BiLSTM v2, unified) | **Yes (via unified)** | ~20K sequences | 28 | **Active** |
| FSL Alphabet Combined (Kaggle+Custom) | Yes (BiLSTM v3) | No | ~100K sequences | 28 | **Active for training** |
| FSL-105 (raw) | No (landmarks extracted) | No | 2,133 .MOV files | 105 | Raw data |
| FSL-105 (processed) | Yes (BiLSTM 105, unified) | **Yes (via unified)** | ~15K sequences | 105 | **Active** |
| Kaggle FSL (raw JPGs) | No (landmarks extracted) | No | 11,700 JPGs | 26 | Raw data |
| Kaggle FSL (external landmarks) | No (processed to combined) | No | ~11K landmarks | 26 | Intermediate |
| Kaggle FSL (processed landmarks) | Yes (merged into alphabet_combined) | No | ~11K landmarks | 26 | Intermediate |
| FSL Dataset v4.5 Fork | **Scripts reference it but no on-disk data** | **No** | **0** | **0** | **NOT INTEGRATED** |
| Roboflow Dataset | **Scripts reference it but processed dir is empty** | **No** | **0 (processed)** | **0** | **NOT INTEGRATED** |
| Unified v1 | Training artifacts exist | No | Merge of alphabet_v2 + fsl_105 | 133 | Intermediate |
| Unified v2 | **Not on disk (stub only)** | No | 0 | 0 | **NOT BUILT** |
| Unified v3 | **Not on disk (stub only)** | No | 0 | 0 | **NOT BUILT** |

## Detailed Audit

### Custom FSL Alphabet Dataset
- **Raw videos**: `datasets/raw/fsl_105/clips/` — 2,133 .MOV files across 100 directories
- **Processed v1**: `datasets/processed/fsl_alphabet/` — 56 MB, train/test/val splits
- **Processed v2**: `datasets/processed/fsl_alphabet_v2/` — 334 MB, improved preprocessing
- **Processed combined**: `datasets/processed/fsl_alphabet_combined/` — 3.36 GB, Kaggle + custom merged
- **Consumed by**: `train-fsl-alphabet-baseline.mjs`, `train-fsl-alphabet-lstm.mjs`, `train-fsl-alphabet-bilstm.mjs`, `train-fsl-alphabet-bilstm-v2.mjs`, `train-fsl-alphabet-bilstm-v3.mjs`, `train-fsl-alphabet-cnn-lstm.mjs`, `train-unified-bilstm.mjs`

### FSL-105 Dataset
- **Raw videos**: `datasets/raw/fsl_105/clips/` — 2,133 .MOV files across 100 class directories
- **Processed landmarks**: `datasets/processed/fsl_105/` — 406 MB, train/test splits
- **Consumed by**: `train-fsl-105-bilstm.mjs`, `train-unified-bilstm.mjs`, `merge-unified-datasets-v2.mjs`, `merge-unified-datasets-v3.mjs`

### Kaggle FSL Dataset
- **Raw JPGs**: `datasets/raw/fsl_alphabet_kaggle/Collated/` — 11,700 JPGs across A-Z folders
- **External landmarks**: `datasets/external/fsl_kaggle_landmarks/` — 2.17 GB, raw MediaPipe extraction
- **Processed landmarks**: `datasets/processed/fsl_kaggle_landmarks/` — 3.33 GB, cleaned
- **Consumed by**: `merge-fsl-datasets.mjs` (merged into `fsl_alphabet_combined`)

### FSL Dataset v4.5 Fork ⚠️
- **On-disk data**: **NONE** — `datasets/processed/fsl_v45/` does not exist
- **Scripts**: `audit-fsl-v45.mjs`, `map-fsl-v45-labels.mjs`, `extract-fsl-v45-landmarks.mjs`, `merge-unified-datasets-v2.mjs`, `train-fsl-v45-bilstm-v4.mjs`, `train-fsl-v45-cnn-bilstm.mjs`, `train-fsl-v45-transformer.mjs`, `train-fsl-v45-transformer-attention.mjs`, `export-fsl-v45-tfjs.mjs`, `update-knowledge-base-v45.mjs`
- **Conclusion**: Scripts were written and documented in Phase 21 deliverables, but the actual v4.5 data was never successfully downloaded, extracted, or processed into the `datasets/` directory. All v4.5 model training scripts would fail if run.

### Roboflow Dataset ⚠️
- **Raw JPGs**: `roboflow/train/` — 5 GB, present
- **Processed landmarks**: `datasets/processed/roboflow/` — **empty directory**
- **Scripts**: `audit-roboflow-dataset.mjs`, `extract-roboflow-landmarks.mjs`, `merge-unified-datasets-v3.mjs`, `prep-roboflow-static.mjs`, `train-roboflow-mlp.mjs`, `train-roboflow-llc.mjs`, `benchmark-roboflow-models.mjs`
- **Production model**: `public/models/roboflow_static/` — **DOES NOT EXIST**
- **Conclusion**: The Roboflow dataset was downloaded (5 GB) but landmark extraction either failed or was never completed. The processed landmarks directory is empty. No TFJS model was ever exported to `public/models/roboflow_static/`. The `src/features/recognition/hybrid/staticClassifier.ts` references `/models/roboflow_static/model.json` which will always fail to load in production.

### Unified v1
- `models/fsl_unified/bilstm/` — training artifacts exist (994 KB)
- `public/models/fsl_unified/bilstm_tfjs/` — **THIS IS THE CURRENT DEPLOYED MODEL** (203 KB, 133 labels)
- Trained by `train-unified-bilstm.mjs` (alphabet_v2 + fsl_105 → 133 classes)
- Exported by `export-unified-bilstm-tfjs.mjs` (no npm alias)

### Unified v2 / v3
- `datasets/processed/unified_v2/` — **DOES NOT EXIST**
- `datasets/processed/unified_v3/` — **labels.json only (1.73 KB stub)**
- Scripts exist to build these, but the actual merged datasets were never generated

## Production-Ready Datasets

Only **two datasets** have actually contributed to the deployed model:
1. **Custom FSL Alphabet v2** (28 classes) — via `train-unified-bilstm.mjs`
2. **FSL-105** (105 phrases) — via `train-unified-bilstm.mjs`

The deployed `public/models/fsl_unified/bilstm_tfjs/` supports 133 labels total (28 alphabet + 105 phrases).
