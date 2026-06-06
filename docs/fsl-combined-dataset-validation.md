# FSL Combined Dataset Validation Report

**Generated:** 2026-06-06T14:41:12.639Z
**Dataset:** Kaggle FSL + Custom SignLangVisual

## File Validation

✅ All required files present

## Labels Validation

✅ All 28 labels present
Labels: a, b, c, d, e, f, g, h, i, j, k, l, m, n, ñ, ng, o, p, q, r, s, t, u, v, w, x, y, z

## Metadata Validation

✅ Metadata valid

| Property | Value |
|----------|-------|
| Sequence Length | 120 |
| Feature Dimension | 126 |
| Custom Samples | 597 |
| Kaggle Samples | 11700 |
| Total Samples | 12297 |
| Merged At | 2026-06-06T14:40:26.512Z |

## Split Validation

### train ✅

- Samples: 8595
- Labels covered: 28/28

| Label | Count |
|-------|-------|
| a | 329 |
| b | 330 |
| c | 329 |
| d | 331 |
| e | 329 |
| f | 329 |
| g | 330 |
| h | 329 |
| i | 330 |
| j | 329 |
| k | 330 |
| l | 329 |
| m | 329 |
| n | 329 |
| ñ | 14 |
| ng | 14 |
| o | 330 |
| p | 329 |
| q | 329 |
| r | 329 |
| s | 329 |
| t | 329 |
| u | 330 |
| v | 329 |
| w | 331 |
| x | 330 |
| y | 331 |
| z | 329 |

### validation ✅

- Samples: 1827
- Labels covered: 28/28

| Label | Count |
|-------|-------|
| a | 70 |
| b | 70 |
| c | 70 |
| d | 70 |
| e | 70 |
| f | 70 |
| g | 70 |
| h | 70 |
| i | 70 |
| j | 70 |
| k | 70 |
| l | 70 |
| m | 70 |
| n | 70 |
| ñ | 3 |
| ng | 3 |
| o | 70 |
| p | 70 |
| q | 70 |
| r | 70 |
| s | 70 |
| t | 70 |
| u | 70 |
| v | 70 |
| w | 71 |
| x | 70 |
| y | 70 |
| z | 70 |

### test ✅

- Samples: 1875
- Labels covered: 28/28

| Label | Count |
|-------|-------|
| a | 72 |
| b | 72 |
| c | 71 |
| d | 72 |
| e | 72 |
| f | 72 |
| g | 72 |
| h | 72 |
| i | 72 |
| j | 72 |
| k | 72 |
| l | 72 |
| m | 72 |
| n | 72 |
| ñ | 3 |
| ng | 3 |
| o | 72 |
| p | 71 |
| q | 72 |
| r | 72 |
| s | 72 |
| t | 72 |
| u | 72 |
| v | 72 |
| w | 72 |
| x | 72 |
| y | 72 |
| z | 71 |

## Summary

✅ **Dataset is valid and ready for training**

### Statistics

- Train set: 8595 (69.9%)
- Validation set: 1827 (14.9%)
- Test set: 1875 (15.2%)
- **Total: 12297**

### Next Steps

1. Run: `npm run train:fsl-alphabet:bilstm-v3`
2. Evaluate results and compare with BiLSTM v2 baseline
3. If improved, run: `npm run export:fsl-alphabet:bilstm-v3:tfjs`
