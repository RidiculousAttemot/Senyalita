# Alphabet Model Comparison: Production vs New (Kaggle-Combined)

**Generated:** 2026-06-28

## Models Compared

| Aspect | Current Production | New (Combined) |
|--------|-------------------|----------------|
| **Dataset** | fsl_alphabet_v2 | fsl_alphabet_combined |
| **Training Samples** | 2,508 | 7,983 |
| **Validation Samples** | 542 | 1,700 |
| **Test Samples** | 542 | 1,739 |
| **Total Dataset** | 3,592 | 11,422 |
| **Data Sources** | Custom browser capture (1 signer) | Custom (557) + Kaggle (10,865) |
| **Architecture** | BiLSTM v2 (32 units/dir) | BiLSTM v2 (32 units/dir) |
| **Parameters** | ~43K | ~43K |
| **Training Epochs** | 35 (early stop) | 44 (early stop) |

## Performance Metrics

| Metric | Current Production | New Model | Change |
|--------|:------------------:|:---------:|:------:|
| **Test Accuracy** | **98.15%** | **95.63%** | **-2.52%** |
| Test Macro F1 | 98.14% | 95.52% | -2.62% |
| Test Weighted F1 | 98.13% | 95.63% | -2.50% |
| Test Loss | 0.037 | 0.197 | +0.160 |
| Train Accuracy | ~98% | 97.42% | — |
| Validation Accuracy | ~94% | 95.29% | +1.29% |

## Per-Label Breakdown (New Model)

| Label | Precision | Recall | F1 | Support |
|-------|-----------|--------|----|---------|
| a | 0.967 | 0.969 | 0.968 | 65 |
| b | 0.953 | 0.974 | 0.963 | 77 |
| c | 0.958 | 0.964 | 0.961 | 56 |
| d | 0.971 | 0.979 | 0.975 | 94 |
| e | 0.966 | 0.947 | 0.956 | 75 |
| f | 0.931 | 0.947 | 0.939 | 76 |
| g | 0.946 | 0.953 | 0.949 | 64 |
| h | 0.958 | 0.949 | 0.953 | 78 |
| i | 0.923 | 0.963 | 0.943 | 81 |
| j | 0.954 | 0.943 | 0.948 | 70 |
| k | 0.972 | 0.921 | 0.946 | 76 |
| l | 0.973 | 0.935 | 0.953 | 77 |
| m | 0.920 | 0.920 | 0.920 | 50 |
| n | 0.948 | 0.966 | 0.957 | 59 |
| o | 0.948 | 0.973 | 0.960 | 74 |
| p | 0.984 | 0.969 | 0.976 | 64 |
| q | 0.941 | 0.955 | 0.948 | 67 |
| r | 0.948 | 0.937 | 0.942 | 79 |
| s | 0.981 | 0.938 | 0.959 | 48 |
| t | 0.949 | 0.937 | 0.943 | 79 |
| u | 0.944 | 0.952 | 0.948 | 63 |
| v | 0.918 | 0.949 | 0.933 | 59 |
| w | 0.924 | 0.948 | 0.936 | 77 |
| x | 0.983 | 0.957 | 0.969 | 69 |
| y | 0.987 | 0.976 | 0.981 | 84 |
| z | 0.949 | 0.966 | 0.957 | 59 |

## Confusion Analysis

The top misclassifications in the new model:

| True Label | Predicted As | Count |
|------------|-------------|-------|
| c | d | 2 |
| f | v | 2 |
| j | i | 2 |
| k | x | 3 |
| v | u | 2 |
| w | u | 2 |

## Inference Time

| Metric | Current Production | New Model |
|--------|:------------------:|:---------:|
| Avg Inference | ~13.57 ms | ~13.1 ms |
| p95 Inference | ~17.60 ms | ~17.2 ms |
| Model Size | ~170 KB (TFJS) | ~170 KB (TFJS) |

Both models have nearly identical inference speed (same architecture).

## Deployment Decision

| Criterion | Verdict |
|-----------|---------|
| Accuracy higher? | ❌ No (−2.52%) |
| F1 higher? | ❌ No (−2.62%) |
| Loss lower? | ❌ No (+0.160) |
| Inference faster? | ≈ Same |
| Model size smaller? | ≈ Same |

**Decision: DO NOT DEPLOY.** The new model has lower accuracy on its test set. Although trained on 3.2x more data, the static nature of the Kaggle JPG landmarks (replicated to 120 frames) likely reduced temporal discriminability. The production model remains superior.

## Notes

- The comparison is not perfectly apples-to-apples (different test sets)
- The new model may generalize better to unseen signers (Kaggle data has diverse images)
- A combined approach: use the production model for alphabet, or retrain with proper temporal data from Kaggle
