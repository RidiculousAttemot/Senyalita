# Model Lineage Report

## All Models Under `models/` and `public/models/`

### Production-Deployed Models

| Model | Location | Dataset | Accuracy | Size | Classes | Status |
|-------|----------|---------|----------|------|---------|--------|
| **Unified BiLSTM** | `public/models/fsl_unified/bilstm_tfjs/` | alphabet_v2 + fsl_105 | ~92.3% (phrase) | 203 KB | 133 | **DEPLOYED** |

### Training Artifacts (not served to browser)

| Model | Location | Dataset | Training Size | Classes | Status |
|-------|----------|---------|--------------|---------|--------|
| Baseline DNN | `models/fsl_alphabet/baseline/` | fsl_alphabet v1 | 8.47 MB | 28 | **Orphaned** |
| LSTM | `models/fsl_alphabet/lstm/` | fsl_alphabet v1 | 384 KB | 28 | **Orphaned** |
| BiLSTM v1 | `models/fsl_alphabet/bilstm/` | fsl_alphabet v1 | 847 KB | 28 | **Orphaned** |
| BiLSTM v2 | `models/fsl_alphabet/bilstm_v2/` | fsl_alphabet v2 | 847 KB | 28 | **Orphaned** |
| BiLSTM v3 | `models/fsl_alphabet/bilstm_v3/` | alphabet_combined | 845 KB | 28 | **Orphaned** |
| CNN-LSTM | `models/fsl_alphabet/cnn_lstm/` | fsl_alphabet v1 | 487 KB | 28 | **Orphaned** |
| FSL-105 BiLSTM | `models/fsl_105/bilstm/` | fsl_105 processed | 944 KB | 105 | **Orphaned** |
| Unified BiLSTM | `models/fsl_unified/bilstm/` | alphabet_v2 + fsl_105 | 971 KB | 133 | **Training source** |
| BiLSTM v4 | `models/fsl_unified_v2/bilstm_v4/` | **Would use unified_v2** | — | — | **Never built** |
| CNN-BiLSTM | `models/fsl_unified_v2/cnn_bilstm/` | **Would use unified_v2** | — | — | **Never built** |
| Transformer | `models/fsl_unified_v2/transformer/` | **Would use unified_v2** | — | — | **Never built** |
| Transformer-Attn | `models/fsl_unified_v2/transformer_attention/` | **Would use unified_v2** | — | — | **Never built** |

### TFJS Exports (for browser)

| Model | Location | Size | Loaded at Runtime? | Source Training Model |
|-------|----------|------|--------------------|----------------------|
| Alphabet legacy | `public/models/fsl_alphabet/tfjs/` | 89 KB | No | models/fsl_alphabet/lstm/ |
| BiLSTM v1 TFJS | `public/models/fsl_alphabet/bilstm_v2_tfjs/` | 170 KB | No | models/fsl_alphabet/bilstm_v2/ |
| FSL-105 TFJS | `public/models/fsl_105/` | 195 KB | No | models/fsl_105/bilstm/ |
| **Unified BiLSTM TFJS** | `public/models/fsl_unified/bilstm_tfjs/` | **203 KB** | **YES** | models/fsl_unified/bilstm/ |

### Missing Models

| Expected Location | Should Contain | Reality |
|-------------------|---------------|---------|
| `public/models/roboflow_static/` | LLC or MLP static classifier | **DOES NOT EXIST** |
| `models/roboflow_static/` | Training artifacts | **DOES NOT EXIST** |
| `models/roboflow_llc/` | LLC training artifacts | **DOES NOT EXIST** |
| `models/fsl_unified_v2/bilstm_v4/` | BiLSTM v4 training artifacts | **DOES NOT EXIST** |
| `models/fsl_unified_v2/` | Any v2 model | **DOES NOT EXIST** |

### Orphaned Model Artifacts (no longer needed)

The following model directories could be removed to save space and reduce confusion:

| Directory | Size | Reason |
|-----------|------|--------|
| `models/fsl_alphabet/baseline/` | 8.5 MB | DNN replaced by BiLSTM |
| `models/fsl_alphabet/lstm/` | ~400 KB | Never deployed post-refinement |
| `models/fsl_alphabet/bilstm/` | ~850 KB | Superseded by unified |
| `models/fsl_alphabet/bilstm_v2/` | ~850 KB | Superseded by unified |
| `models/fsl_alphabet/bilstm_v3/` | ~850 KB | Superseded by unified |
| `models/fsl_alphabet/cnn_lstm/` | ~500 KB | Never deployed |
| `models/fsl_alphabet/cross_signer_eval/` | ~2 KB | Evaluation artifact |
| `models/fsl_105/bilstm/` | ~950 KB | Superseded by unified |
| `public/models/fsl_alphabet/tfjs/` | 89 KB | Legacy export |
| `public/models/fsl_alphabet/bilstm_v2_tfjs/` | 170 KB | Legacy export |
| `public/models/fsl_105/` | 195 KB | Legacy export |

### Duplicate Artifacts

- `models/fsl_alphabet/bilstm_tfjs/` and `public/models/fsl_alphabet/bilstm_v2_tfjs/` are **identical** (170 KB each, same weights.bin content)
- `models/fsl_alphabet/bilstm_v2_tfjs/` and `public/models/fsl_alphabet/bilstm_v2_tfjs/` are also identical

### Recommendation

1. Remove `models/fsl_alphabet/baseline/`, `lstm/`, `bilstm/`, `bilstm_v3/`, `cnn_lstm/`, `cross_signer_eval/`
2. Keep `models/fsl_unified/bilstm/` as the training source for the deployed model
3. Remove `public/models/fsl_alphabet/` and `public/models/fsl_105/` (legacy exports)
4. The unified model at `public/models/fsl_unified/bilstm_tfjs/` is the only production model
