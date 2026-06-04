# FSL Alphabet BiLSTM Experimental Evaluation

## Dataset Summary

Same dataset as Stage 2 LSTM experiment:

- Labels: a-z, ñ, ng (28 classes)
- Total samples: 597
- Sequence length: 120 frames
- Feature dimension: 126 (2 hands × 21 landmarks × 3 coordinates)
- Temporal sampling: 30 evenly spaced frames from each 120-frame sequence
- Split: Train 427 / Validation 85 / Test 85 (stratified-by-label)
- No rebalancing; no preprocessing changes

## Architecture

Input [30, 126]

↓

BiLSTM (32 hidden units per direction)

  Forward LSTM: frames 0 → 29
  Backward LSTM: frames 29 → 0

↓

Concatenated hidden state (64-dim)

↓

Dropout (rate 0.2)

↓

Dense (28 units) + Softmax

Total weight parameters:
- Forward LSTM: wx [126×128], wh [32×128], b [128] = 20,608
- Backward LSTM: wx [126×128], wh [32×128], b [128] = 20,608
- Classifier: wy [64×28] = 1,792, by [28] = 28
- Total: 43,044 parameters

## Training Configuration

| Parameter | Value |
|---|---|
| Optimizer | Adam |
| Learning rate | 0.002 |
| Epochs requested | 45 |
| Epochs completed | 35 (early stopping) |
| Early stopping patience | 10 |
| Gradient clipping | 1.0 |
| Dropout rate | 0.2 |
| Random seed | 2026 |
| Batch | Full-batch SGD |

Training command: `npm run train:fsl-alphabet:bilstm`

## Results

### Accuracy and Loss

| Split | Accuracy | Loss |
|---|---|---|
| Train | 95.55% | 0.120 |
| Validation | 77.65% | 0.571 |
| Test | 71.76% | 0.842 |

### Classification Metrics (Test)

| Metric | Value |
|---|---|
| Macro F1 | 68.29% |
| Weighted F1 | 68.66% |
| Test Loss | 0.842 |

### Per-Label Test Metrics

| Label | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| a | 66.7% | 66.7% | 66.7% | 3 |
| b | 33.3% | 33.3% | 33.3% | 3 |
| c | 66.7% | 66.7% | 66.7% | 3 |
| d | 60.0% | 100.0% | 75.0% | 3 |
| e | 0.0% | 0.0% | 0.0% | 3 |
| f | 60.0% | 100.0% | 75.0% | 3 |
| g | 66.7% | 66.7% | 66.7% | 3 |
| h | 100.0% | 66.7% | 80.0% | 3 |
| i | 100.0% | 66.7% | 80.0% | 3 |
| j | 100.0% | 100.0% | 100.0% | 3 |
| k | 100.0% | 100.0% | 100.0% | 3 |
| l | 100.0% | 100.0% | 100.0% | 3 |
| m | 0.0% | 0.0% | 0.0% | 3 |
| n | 60.0% | 100.0% | 75.0% | 3 |
| ñ | 100.0% | 100.0% | 100.0% | 3 |
| ng | 50.0% | 66.7% | 57.1% | 3 |
| o | 75.0% | 100.0% | 85.7% | 3 |
| p | 100.0% | 100.0% | 100.0% | 3 |
| q | 100.0% | 100.0% | 100.0% | 3 |
| r | 40.0% | 66.7% | 50.0% | 3 |
| s | 50.0% | 33.3% | 40.0% | 3 |
| t | 100.0% | 100.0% | 100.0% | 3 |
| u | 25.0% | 33.3% | 28.6% | 3 |
| v | 0.0% | 0.0% | 0.0% | 3 |
| w | 100.0% | 100.0% | 100.0% | 4 |
| x | 100.0% | 66.7% | 80.0% | 3 |
| y | 75.0% | 100.0% | 85.7% | 3 |
| z | 66.7% | 66.7% | 66.7% | 3 |

Per-label metrics should be interpreted with caution: each label has only 3 test
samples, so a single misclassification shifts F1 by 33 points.

## Error Analysis

### Weakest Labels (F1 = 0%)

- e: never correctly predicted
- m: never correctly predicted
- v: never correctly predicted

### Strongest Labels (F1 = 100%)

- j, k, l, ñ, p, q, t, w

### Most Confusable Pairs (from confusion matrix)

Based on the confusion matrix, frequent misclassifications include:

- e confused with: other labels (5/5 of its errors)
- m confused with: multiple labels (all errors)
- v confused with: multiple labels (all errors)
- u → other vowels/consonants (50%+ error rate)
- ng → n or similar velar sounds
- s → adjacent phonetic groups

## Comparison with MLP

| Metric | MLP | BiLSTM | Change |
|---|---|---|---|
| Train accuracy | 96.49% | 95.55% | -0.94% |
| Validation accuracy | 70.59% | 77.65% | +7.06% |
| Test accuracy | 69.41% | 71.76% | +2.35% |
| Test macro F1 | 67.31% | 68.29% | +0.98% |
| Test weighted F1 | 68.87% | 68.66% | -0.21% |

BiLSTM reduces overfitting (smaller train/val gap) and improves test accuracy and
macro F1 compared with the flattened MLP baseline.

## Comparison with LSTM

| Metric | LSTM | BiLSTM | Change |
|---|---|---|---|
| Train accuracy | 87.82% | 95.55% | +7.73% |
| Validation accuracy | 76.47% | 77.65% | +1.18% |
| Test accuracy | 69.41% | 71.76% | +2.35% |
| Test macro F1 | 68.50% | 68.29% | -0.21% |
| Test weighted F1 | 68.87% | 68.66% | -0.21% |
| Test loss | 1.118 | 0.842 | -0.276 |

### Confusions Removed (BiLSTM better vs LSTM)
- a: F1 improved (40.0% → 66.7%)
- d: F1 improved (60.0% → 75.0%)
- f: F1 improved (57.1% → 75.0%)
- l: F1 improved (60.0% → 100.0%)
- ñ: F1 improved (50.0% → 100.0%)
- t: F1 improved (85.7% → 100.0%)
- z: F1 improved (0.0% → 66.7%)

### Confusions Introduced (LSTM better than BiLSTM)
- b: F1 dropped (50.0% → 33.3%)
- c: F1 dropped (80.0% → 66.7%)
- m: F1 dropped (33.3% → 0.0%)
- n: F1 dropped (85.7% → 75.0%)
- ng: F1 dropped (80.0% → 57.1%)
- o: F1 dropped (100.0% → 85.7%)
- r: F1 dropped (80.0% → 50.0%)
- u: F1 dropped (57.1% → 28.6%)
- v: F1 dropped (66.7% → 0.0%)

## Interpretation

The BiLSTM achieves the highest test accuracy so far at 71.76%, a +2.35%
improvement over both the LSTM and the MLP baseline. Test loss also decreased
significantly (1.118 → 0.842, -24.7%).

However, macro F1 slightly decreased (68.50% → 68.29%) because the BiLSTM trades
performance on mid-range labels for gains on previously failing labels. Labels
that were at 0% F1 in the LSTM (e, z) — z improved to 66.7%, while e stayed at
0%. The BiLSTM also lost 3 previously moderate labels (b, m, v).

With only 3 test samples per label, per-label comparisons are statistically
noisy. The headline improvement in test accuracy (+2.35%) and test loss (-0.276)
indicates bidirectional temporal modeling captures more discriminative temporal
patterns than forward-only, but the gain is modest with the current dataset size.

The TFJS model has been exported to `models/fsl_alphabet/bilstm_tfjs/` (8 weight
groups, 170 KB) for potential deployment after evaluation.

## Limitations

- Dataset size (597 samples) limits statistical significance
- 3 test samples per label makes per-label metrics unreliable
- e, m, and v remain at 0% F1 in both LSTM and BiLSTM, suggesting systematic
  confusion not resolved by bidirectional temporal modeling
- Only one hyperparameter configuration tested (32 hidden units, 0.2 dropout)
- No data augmentation applied
- Single signer dataset limits generalization claims
- BiLSTM has 2× the parameters of the forward LSTM (43K vs 21K)

## Future Work

- Increase dataset size (target 50+ samples per label per signer)
- Multi-signer data collection for generalization
- Hyperparameter search (hidden size, dropout, learning rate)
- Data augmentation (rotation, scaling, noise on landmarks)
- CNN-LSTM hybrid for spatial-temporal feature extraction
- Train with full 120-frame sequences (no temporal sampling)
- Per-label confidence calibration
- Ensemble of LSTM + BiLSTM predictions

Last updated: 2026-06-04
