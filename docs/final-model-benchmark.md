# Final Model Benchmark

Generated: 2026-06-16

## Architectures Compared

1. Unified BiLSTM v1 (current production)
2. Unified BiLSTM v3 (candidate)
3. CNN-BiLSTM (no trained model)
4. Transformer (no trained model)
5. Attention-BiLSTM (no trained model)

## Available Models

| Architecture | Accuracy | Macro F1 | Params | Inference | Size | Status |
|-------------|:--------:|:--------:|:------:|:---------:|:----:|:------:|
| **BiLSTM v1** | **88.84%** | **83.45%** | 24,773 | ~13ms | 97KB | ✅ Production |
| BiLSTM v3 | 39.38% | 17.85% | 86,115 | ~57ms | 336KB | ❌ Candidate |
| BiLSTM v2 | — | — | — | — | — | ❌ Not trained |
| CNN-BiLSTM | — | — | — | — | — | ❌ Not trained |
| Transformer | — | — | — | — | — | ❌ Not trained |
| Attention-BiLSTM | — | — | — | — | — | ❌ Not trained |

## Ranking

| Rank | Architecture | Score (Accuracy × F1) | Decision |
|:----:|-------------|:---------------------:|:--------:|
| 1 | **BiLSTM v1** | **0.741** | ✅ Keep |
| 2 | BiLSTM v3 | 0.070 | ❌ Not ready |
| — | Others | N/A | Need training |

## Detailed Comparison: v1 vs v3

| Metric | v1 | v3 | Delta |
|--------|:--:|:--:|:-----:|
| Test accuracy | 88.84% | 39.38% | v1 +49.46pp |
| Macro F1 | 83.45% | 17.85% | v1 +65.60pp |
| Weighted F1 | 88.51% | 37.83% | v1 +50.68pp |
| Parameters | 24,773 | 86,115 | v3 3.48× larger |
| Inference | ~12.9ms | ~56.7ms | v3 4.39× slower |
| Memory | 97KB | 336KB | v3 3.46× larger |
| Epochs trained | 28 | 63 | v3 needed 2.25× more |

## Conclusion

**BiLSTM v1 remains the best available architecture.** v3 did not meet the deployment threshold (Accuracy ≥ 92%, Macro F1 ≥ 88%). The v3 architecture requires further hyperparameter tuning before it can be considered for production.
