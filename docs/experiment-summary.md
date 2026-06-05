# Experiment Summary

## Model Performance Comparison

### Test Set Results

| Model | Test Accuracy | Test Macro F1 | Test Loss | Parameters | Dataset |
|---|---|---|---|---|---|
| MLP (Baseline) | 69.41% | 67.31% | — | 1,082,656 | v1 (597) |
| LSTM | 69.41% | 68.50% | 1.118 | 21,372 | v1 (597) |
| BiLSTM v1 | 71.76% | 68.29% | 0.842 | 42,780 | v1 (597) |
| CNN-LSTM | 61.18% | 60.76% | 1.367 | 23,964 | v1 (597) |
| **BiLSTM v2** | **98.15%** | **98.14%** | **0.037** | 42,780 | v2 (3592) |

### Training Set Results

| Model | Train Accuracy | Validation Accuracy |
|---|---|---|
| MLP (Baseline) | 96.49% | 70.59% |
| LSTM | 87.82% | 76.47% |
| BiLSTM v1 | 95.55% | 77.65% |
| CNN-LSTM | 74.94% | 67.06% |
| BiLSTM v2 | 98.76% | 97.97% |

## Why BiLSTM v2 Was Selected

BiLSTM v2 was selected as the deployed model for the following reasons:

1. **Highest test accuracy (98.15%)** — Outperforms all other models by +26.39% over BiLSTM v1.
2. **Highest macro F1 (98.14%)** — Balanced performance across all 28 labels; only 3 labels fall below 0.95 F1.
3. **Lowest test loss (0.037)** — Nearly two orders of magnitude lower than any v1 model.
4. **Lowest overfitting gap (0.61%)** — Train-to-test accuracy difference of just 0.61%, compared to 27.08% for MLP and 18.41% for LSTM.
5. **Cross-signer generalization (94.96% avg)** — Validated across 6 signers (5 virtual).
6. **Runtime efficiency (13.57ms inference)** — Well within the 200ms browser inference budget.

The dominant factor in this improvement was **dataset expansion** from 597 to 3592 samples (6× increase via landmark augmentation), not architectural changes — BiLSTM v2 uses the same architecture as BiLSTM v1.

## Why CNN-LSTM Was Rejected

CNN-LSTM achieved the **lowest test accuracy (61.18%)** of all models despite using full 120-frame sequences. It was rejected for three reasons:

1. **Conv1D feature extraction was ineffective** on sparse 126-dimensional landmark data. The convolution filters did not capture meaningful temporal-local patterns compared to direct LSTM sequence modeling.
2. **Increased parameter count did not help** — 24K parameters underperformed the simpler 21K LSTM and 43K BiLSTM, suggesting the architecture was not well-suited to the data modality.
3. **Small dataset amplified the problem** — On 597 samples, the additional Conv layers introduced regularization challenges without sufficient data to learn useful filters. The approach may benefit from larger datasets but was not viable at this stage.

## Cross-Signer Generalization

| Signer | Description | Accuracy |
|---|---|---|
| S01 (original) | Unmodified landmarks | 97.99% |
| S02 (rotation) | ±15° random rotation | 94.86% |
| S03 (scaling) | 0.8×–1.2× random scale | 96.63% |
| S04 (noise) | Gaussian jitter (σ=0.02) | 93.35% |
| S05 (occlusion) | Random landmark dropout | 89.65% |
| S06 (mixed) | Combined transforms | 97.16% |
| **Average** | | **94.96%** |

## Key Findings

1. Dataset size was the dominant accuracy factor — expanding from 597 to 3592 samples improved BiLSTM test accuracy by +26.39%.
2. Bidirectionality provided marginal improvement over forward LSTM (+2.35% on v1) but was essential for the final model.
3. Simple temporal sampling (30 frames from 120) outperformed full-sequence Conv1D processing.
4. Virtual signer augmentation generalized well to most transforms (avg 94.96%), with occlusion (89.65%) being the hardest case.
5. The u/v/r label confusion cluster remains the primary failure mode — these visually similar handshapes account for all 10 test errors (on 542 samples).

## Runtime Summary

| Metric | Value |
|---|---|
| Model load time | 11.8 ms |
| Avg inference time | 13.57 ms |
| p95 inference time | 17.60 ms |
| Estimated FPS (avg) | 73.7 |
| Estimated FPS (p95) | 56.8 |
| Model size (weights.bin) | 85,104 bytes (LSTM) / ~171KB (BiLSTM v2) |
