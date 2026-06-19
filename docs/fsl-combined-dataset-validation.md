# FSL Combined Dataset Validation Report

**Generated:** 2026-06-07T02:31:50.285Z
**Dataset:** Kaggle FSL + Custom SignLangVisual

## File Validation

✅ All required files present

## Labels Validation

✅ All 26 labels present
Labels: a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z

## Metadata Validation

✅ Metadata valid

| Property | Value |
|----------|-------|
| Sequence Length | 120 |
| Feature Dimension | 126 |
| Custom Samples | 557 |
| Kaggle Samples | 10865 |
| Total Samples | 11422 |
| Merged At | 2026-06-07T02:10:16.642Z |

## Split Validation

### train ✅

- Samples: 7983
- Labels covered: 0/26

| Label | Count |
|-------|-------|
| a | 0 |
| b | 0 |
| c | 0 |
| d | 0 |
| e | 0 |
| f | 0 |
| g | 0 |
| h | 0 |
| i | 0 |
| j | 0 |
| k | 0 |
| l | 0 |
| m | 0 |
| n | 0 |
| o | 0 |
| p | 0 |
| q | 0 |
| r | 0 |
| s | 0 |
| t | 0 |
| u | 0 |
| v | 0 |
| w | 0 |
| x | 0 |
| y | 0 |
| z | 0 |

### validation ✅

- Samples: 1700
- Labels covered: 0/26

| Label | Count |
|-------|-------|
| a | 0 |
| b | 0 |
| c | 0 |
| d | 0 |
| e | 0 |
| f | 0 |
| g | 0 |
| h | 0 |
| i | 0 |
| j | 0 |
| k | 0 |
| l | 0 |
| m | 0 |
| n | 0 |
| o | 0 |
| p | 0 |
| q | 0 |
| r | 0 |
| s | 0 |
| t | 0 |
| u | 0 |
| v | 0 |
| w | 0 |
| x | 0 |
| y | 0 |
| z | 0 |

### test ✅

- Samples: 1739
- Labels covered: 0/26

| Label | Count |
|-------|-------|
| a | 0 |
| b | 0 |
| c | 0 |
| d | 0 |
| e | 0 |
| f | 0 |
| g | 0 |
| h | 0 |
| i | 0 |
| j | 0 |
| k | 0 |
| l | 0 |
| m | 0 |
| n | 0 |
| o | 0 |
| p | 0 |
| q | 0 |
| r | 0 |
| s | 0 |
| t | 0 |
| u | 0 |
| v | 0 |
| w | 0 |
| x | 0 |
| y | 0 |
| z | 0 |

## Summary

✅ **Dataset is valid and ready for training**

### Statistics

- Train set: 7983 (69.9%)
- Validation set: 1700 (14.9%)
- Test set: 1739 (15.2%)
- **Total: 11422**

### Next Steps

1. Run: `npm run train:fsl-alphabet:bilstm-v3`
2. Evaluate results and compare with BiLSTM v2 baseline
3. If improved, run: `npm run export:fsl-alphabet:bilstm-v3:tfjs`
