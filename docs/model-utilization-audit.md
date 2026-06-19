# Model Utilization Audit

## Model Inventory

| Model | Dataset | Accuracy | Exported TF.js | Runtime Reference | Deployed | Status |
|-------|---------|----------|---------------|-------------------|----------|--------|
| Unified BiLSTM | FSL Unified (133 classes) | 88.84% test / 97.4% train | Yes | `model/loader.ts` → `/models/fsl_unified/bilstm_tfjs/` | Yes | **Active** |
| Roboflow MLP | Roboflow v4.5 | Unknown | No | None | No | Obsolete |
| Roboflow LLC | Roboflow v4.5 | Unknown | No | None | No | Obsolete |
| FSL Alphabet Baseline | FSL Alphabet v1 | Unknown | No | None | No | Obsolete |
| FSL Alphabet LSTM | FSL Alphabet v1 | Unknown | No | None | No | Obsolete |
| FSL Alphabet BiLSTM | FSL Alphabet v1 | Unknown | No | None | No | Obsolete |
| FSL Alphabet CNN-LSTM | FSL Alphabet v1 | Unknown | No | None | No | Obsolete |
| FSL Alphabet BiLSTM v2/v3 | FSL Alphabet v2 | Unknown | No | None | No | Obsolete |
| FSL-105 BiLSTM | FSL-105 | Unknown | No | None | No | Obsolete |
| FSL v4.5 BiLSTM v4 | FSL v4.5 | Unknown | No | None | No | Obsolete |
| FSL v4.5 CNN-BiLSTM | FSL v4.5 | Unknown | No | None | No | Obsolete |
| FSL v4.5 Transformer | FSL v4.5 | Unknown | No | None | No | Obsolete |
| FSL v4.5 Transformer Attention | FSL v4.5 | Unknown | No | None | No | Obsolete |

## Active Model Details

### Unified BiLSTM (Production)
- **Architecture**: Bidirectional LSTM (32 units forward + 32 units backward), 30 temporal steps, 126-dim feature input, 133-class softmax output
- **Training**: 28 epochs, Adam optimizer (lr=0.002), early stopping (patience=12), dropout=0.2, gradient clip=1.0
- **Dataset**: FSL Unified (5,721 samples: 4,211 train / 542 val / 968 test)
- **Accuracy**: Train 97.4%, Val 87.96%, Test 88.84%, Macro F1 83.45%
- **Export**: TF.js format at `public/models/fsl_unified/bilstm_tfjs/`
  - `model.json` — model topology + weight manifest
  - `weights.bin` — weight data (~2.2MB)
  - `labels.json` — 133 label strings

### Runtime Verification (`src/features/recognition/model/loader.ts`)
- **Production model URL**: `/models/fsl_unified/bilstm_tfjs/model.json`
- **Labels URL**: `/models/fsl_unified/bilstm_tfjs/labels.json`
- **Output classes**: 133 (28 alphabet + 105 phrase)
- **Feature dimension**: 126 (21 landmarks × 2 hands × 3 coordinates)
- **Input shape**: `[1, 30, 126]` (1 batch, 30 timesteps, 126 features)
- **Warmup**: Zero tensor passed at load to initialize WebGL backend
- **Inference**: Argmax over softmax output, top-5 returned

## Models That Can Be Archived

1. **`models/fsl_alphabet/`** — Empty placeholder directories only
2. **`models/fsl_105/`** — Empty placeholder directories only
3. **All Python training scripts** for non-unified models (baseline, LSTM, CNN-LSTM, v2, v3, v4, transformer, MLP, LLC)
4. **Roboflow static classifier** — never reached production; referenced in `loader.ts` but gracefully degrades

## Models Still Required

1. **`models/fsl_unified/bilstm/`** — Python-trained model (source of truth for TF.js export)
2. **`public/models/fsl_unified/bilstm_tfjs/`** — Deployed TF.js runtime model

## Models Never Loaded

- All models in `models/` subdirectories (only the TF.js export in `public/models/` is loaded at runtime)

## Recommendations

1. **Remove** `models/fsl_alphabet/` and `models/fsl_105/` directories (empty)
2. **Remove** all roboflow static model references from runtime code
3. **Keep** `models/fsl_unified/bilstm/` as training source of truth
4. **Keep** `public/models/fsl_unified/bilstm_tfjs/` as deployed runtime model
5. **Archive** all obsolete Python training scripts in `scripts/` (mark in package.json as obsolete)
