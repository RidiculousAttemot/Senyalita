# Production Model Verification

## 1. Which Model Is Actually Deployed?

**File:** `public/models/fsl_unified/bilstm_tfjs/model.json`

Loaded by `src/features/recognition/model/loader.ts`:
```ts
const MODEL_URL = "/models/fsl_unified/bilstm_tfjs/model.json";
const LABELS_URL = "/models/fsl_unified/bilstm_tfjs/labels.json";
```

- **Architecture:** BiLSTM (Bidirectional LSTM)
- **Input shape:** `[1, 30, 126]` (batch, timesteps, features)
- **Output classes:** 133
- **Model file size:** 3.5 KB (model.json) + 192.8 KB (weights.bin) = ~196 KB
- **Runtime:** TF.js WebGL (browser), CPU fallback (Node.js)

### Model file contents
```
public/models/fsl_unified/bilstm_tfjs/
├── labels.json     (1,787 B — 133 labels)
├── model.json      (3,556 B — topology + manifest)
└── weights.bin     (197,396 B — 192.8 KB)
```

## 2. Which Datasets Trained It?

The deployed model was trained by `scripts/train-unified-bilstm.mjs` using:

| Dataset | Path | Contribution |
|---------|------|-------------|
| Custom FSL Alphabet v2 | `datasets/processed/fsl_alphabet_v2/` | 28 alphabet classes |
| FSL-105 (processed) | `datasets/processed/fsl_105/` | 105 phrase classes |
| **Total** | — | **133 classes** |

**Not included in training:**
- ❌ FSL Dataset v4.5 Fork — data was never processed
- ❌ Roboflow Dataset — processed landmarks directory is empty
- ❌ Kaggle FSL Dataset — only used indirectly through `fsl_alphabet_combined` (BiLSTM v3, not used in unified)

## 3. Which Labels Are Supported?

The deployed model supports **133 labels** as defined in `public/models/fsl_unified/bilstm_tfjs/labels.json`:

- **28 alphabet labels:** A, B, C, ..., Z, Ñ, NG
- **105 phrase labels:** HELLO, THANK_YOU, GOOD_MORNING, etc.

## 4. Which Recognition Modes Use It?

The unified BiLSTM model is the **primary temporal model** used in all recognition modes:

| Mode | Model Used | Static Model Used? |
|------|-----------|-------------------|
| Auto (default) | Unified BiLSTM | Attempts to load `public/models/roboflow_static/` — **FAILS** (dir missing) |
| Alphabet Practice | Unified BiLSTM | Same failure |
| Conversation | Unified BiLSTM | Same failure |

### Static Model Status

The `src/features/recognition/hybrid/staticClassifier.ts` references:
```ts
const MODEL_URL = "/models/roboflow_static/model.json";
```

**This file does not exist.** The `public/models/roboflow_static/` directory was never created.
The roboflow training scripts produce model.json in `scripts/` output but never export to `public/models/`.
In `useRecognition.ts`, the static model load fails silently and the pipeline falls back to temporal-only.

## 5. Which Models Are Never Loaded?

These models in `public/models/` are **never referenced** by any runtime code:

| Model | Path | Status |
|-------|------|--------|
| Alphabet legacy TFJS | `public/models/fsl_alphabet/tfjs/` | **Not loaded** |
| BiLSTM v2 alphabet | `public/models/fsl_alphabet/bilstm_v2_tfjs/` | **Not loaded** |
| FSL-105 BiLSTM | `public/models/fsl_105/` | **Not loaded** |

These can be removed without affecting production.
