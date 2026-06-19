# Knowledge Base Expansion — Phase 29I

## New Scripts Added

| File | Purpose |
|------|---------|
| `scripts/train-unified-bilstm-v2.mjs` | Enhanced BiLSTM with label smoothing, class weighting, cosine LR decay, curriculum learning |
| `scripts/train-unified-cnn-bilstm.mjs` | 1D CNN → BiLSTM hybrid architecture |
| `scripts/train-unified-transformer.mjs` | Temporal Transformer with multi-head self-attention |
| `scripts/train-unified-attention-bilstm.mjs` | BiLSTM with temporal attention pooling |
| `scripts/augment-unified-data.mjs` | Data augmentation pipeline (noise, scale, rotation, time warp, temporal mask, mirror) |
| `scripts/mine-hard-examples.mjs` | Hard example mining from confusion matrix analysis |
| `scripts/audit-unified-dataset.mjs` | Dataset quality audit (class imbalance, landmark stats, missing data) |
| `scripts/analyze-confusion.mjs` | Confusion matrix analysis (worst classes, top confusions, cross-group errors) |
| `scripts/benchmark-architectures.mjs` | Cross-architecture comparison (accuracy, F1, params, inference time) |

## New Output Directories

| Directory | Content |
|-----------|---------|
| `models/fsl_unified/bilstm_v2/` | Enhanced BiLSTM v2 weights, config, metrics, confusion matrix |
| `models/fsl_unified/cnn_bilstm/` | CNN-BiLSTM weights, config, metrics |
| `models/fsl_unified/transformer/` | Temporal Transformer weights, config, metrics |
| `models/fsl_unified/attention_bilstm/` | Attention BiLSTM weights, config, metrics |
| `datasets/processed/fsl_unified_augmented/` | Augmented training data (4 presets × original) |
| `scripts/reports/` | Documentation: production plan, knowledge base, final report |

## TF.js Export Compatibility

All training scripts output model.json files with the same weight-key convention:
- BiLSTM v1 & v2: `weights.lstmFwd.{wx,wh,b}`, `weights.lstmBwd.{wx,wh,b}`, `weights.wy`, `weights.by`
- CNN-BiLSTM: adds `weights.convKernel`, `weights.convBias` before LSTM weights
- Attention BiLSTM: adds `weights.attnW`, `weights.attnV` between LSTM weights and classifier
- Transformer: `weights.layer{0..N}.{wQ,wK,wV,wO,wF1,bF1,wF2,bF2,ln1G,ln1B,ln2G,ln2B}`

The existing `export-unified-bilstm-tfjs.mjs` script works **only** with BiLSTM v1/v2 format.
For other architectures, a new export script must be written.

## Training Environment

All scripts run in pure Node.js with no external ML dependencies.
- `@tensorflow/tfjs` not used at training time (custom manual backprop)
- `@tensorflow/tfjs` required only for browser inference via the export script

## Data Flow
```
fsl_alphabet_v2/train.json ─┐
                             ├── loadSplit() → sparse Uint16/Float32 frames
fsl_105/train.json ──────────┘       │
                                     ▼
                              model.forward() / backward()
                                     │
                                     ▼
                             Adam optimizer update
                                     │
                                     ▼
                             saveOutputs() → model.json + metrics.json
```
