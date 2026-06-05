# Reproducibility Guide

## Environment

All training, export, and deployment was performed in the following environment:

| Component | Version |
|---|---|
| Node.js | 18.x+ |
| npm | 10.x+ |
| OS | Windows 11 (x64) |
| Browser | Chrome/Edge (latest) |
| Camera | 720p+ USB or built-in |

## Installation

```bash
npm install
```

All dependencies (TensorFlow.js, MediaPipe, Next.js, React) are declared in `package.json`.

## Dataset Preparation

### 1. Record Raw Landmarks

Use the camera page's capture tool to record FSL alphabet samples. Each recording produces a JSON file with 120 frames of MediaPipe hand landmarks (126 dimensions per frame).

Expected structure (v1):
```
datasets/raw/fsl_alphabet/
  a/
    session_001.json
    ...
  b/
    ...
  ...
  z/
  ñ/
  ng/
```

### 2. Validate Raw Dataset

```bash
npm run validate:dataset
npm run validate:dataset:strict
```

### 3. Preprocess v1 (Single Signer)

```bash
npm run preprocess:fsl-alphabet
npm run verify:processed:fsl-alphabet
npm run summarize:processed:fsl-alphabet
```

Output: `datasets/processed/fsl_alphabet/` — train/validation/test splits with temporally sampled 30-frame sequences.

### 4. Augment to v2 (Virtual Signers)

```bash
npm run augment:fsl-alphabet
```

Creates 5 augmented copies (S02–S06) from original S01 using rotation, scaling, noise, occlusion, and mixed transforms.
Output: `datasets/augmented/fsl_alphabet_v2/` — 3592 total samples.

### 5. Preprocess v2

```bash
npm run preprocess:fsl-alphabet:v2
npm run audit:fsl-alphabet
```

Output: `datasets/processed/fsl_alphabet_v2/` — validated, normalized 120-frame sequences with temporal sampling indices.

## Training

All training scripts output artifacts to `models/fsl_alphabet/<model_name>/`.

### Baseline MLP

```bash
npm run train:fsl-alphabet:baseline
```

Trains a flattened MLP on the v1 dataset (597 samples). Output: `models/fsl_alphabet/baseline/`.

### LSTM

```bash
npm run train:fsl-alphabet:lstm
```

Trains a forward LSTM (32 hidden units, 30 temporal steps) on the v1 dataset. Output: `models/fsl_alphabet/lstm/`.

### BiLSTM v1

```bash
npm run train:fsl-alphabet:bilstm
```

Trains a BiLSTM (32 units/direction, 30 temporal steps) on the v1 dataset. Output: `models/fsl_alphabet/bilstm/`.

### CNN-LSTM

```bash
npm run train:fsl-alphabet:cnn-lstm
```

Trains a CNN-LSTM hybrid (Conv1D ×2 + LSTM) on the v1 dataset. Output: `models/fsl_alphabet/cnn_lstm/`.

### BiLSTM v2

```bash
npm run train:fsl-alphabet:bilstm:v2
```

Trains a BiLSTM (32 units/direction) on the expanded v2 dataset (3592 samples). Output: `models/fsl_alphabet/bilstm_v2/`.

### Cross-Signer Evaluation

```bash
npm run evaluate:fsl-alphabet:cross
```

Leave-one-signer-out cross-validation across S01–S06. Output: `models/fsl_alphabet/cross_signer_eval/`.

## TFJS Export

### LSTM → TFJS

```bash
npm run export:fsl-alphabet:tfjs
```

Output: `models/fsl_alphabet/tfjs/` → `public/models/fsl_alphabet/tfjs/`.

### BiLSTM v1 → TFJS

```bash
npm run export:fsl-alphabet:bilstm:tfjs
```

Output: `models/fsl_alphabet/bilstm_tfjs/`.

### BiLSTM v2 → TFJS

```bash
npm run export:fsl-alphabet:bilstm:v2:tfjs
```

Output: `models/fsl_alphabet/bilstm_v2_tfjs/` → `public/models/fsl_alphabet/bilstm_v2_tfjs/`.

## Runtime Evaluation

```bash
node scripts/evaluate-bilstm-v2-runtime.mjs
node scripts/evaluate-bilstm-v2-confidence.mjs
```

These scripts measure TFJS model load time, inference latency, and confidence calibration on the test set.

## Deployment

### Development Server

```bash
npm run dev
```

Opens at http://localhost:3000. Navigate to /camera for live recognition.

### Production Build

```bash
npm run build
```

Generates optimized production output in `.next/`.

### Lint

```bash
npm run lint
```

## Model Artifacts

Each trained model directory contains:

| File | Description |
|---|---|
| `config.json` | Training configuration (hidden size, epochs, learning rate, etc.) |
| `metrics.json` | Evaluation metrics (accuracy, F1, confusion matrix, per-label metrics) |
| `labels.json` | 28-class label mapping (a–z, ñ, ng) |
| `confusion_matrix.json` | Per-split confusion matrices |
| `training_history.json` | Per-epoch loss and accuracy |
| `model.json` | Serialized model weights |

TFJS export directories contain `model.json`, `weights.bin`, and `labels.json`.

## Dataset Statistics

| Dataset | Samples | Signers | Labels | Sequence Length |
|---|---|---|---|---|
| v1 (processed) | 597 | 1 (S01) | 28 | 30 frames (sampled from 120) |
| v2 (augmented) | 3592 | 6 (S01–S06) | 28 | 120 frames (raw) |
| v2 (processed) | 3592 | 6 (S01–S06) | 28 | 120 frames with sampling indices |

## Quick Reference: Common Commands

```bash
npm install                    # Install dependencies
npm run validate:dataset       # Validate raw dataset
npm run preprocess:fsl-alphabet # Preprocess v1 dataset
npm run augment:fsl-alphabet   # Augment to v2
npm run train:fsl-alphabet:bilstm:v2  # Train BiLSTM v2
npm run export:fsl-alphabet:bilstm:v2:tfjs  # Export to TFJS
npm run dev                    # Start dev server
npm run build                  # Production build
npm run lint                   # Lint check
```

## Notes

- All training scripts produce deterministic output given the same random seed (configurable via env vars).
- Cross-signer evaluation does not produce a standalone model — it reports generalization metrics only.
- The `evaluate-bilstm-v2-runtime.mjs` and `evaluate-bilstm-v2-confidence.mjs` scripts are standalone (no npm wrapper).
- Virtual signers (S02–S06) are synthetic augmentations of the original S01 recordings — they are not recordings of actual different people.
