# FSL Alphabet CNN-LSTM Hybrid Evaluation

## Dataset

Same dataset as all prior experiments:

- Labels: a-z, ñ, ng (28 classes)
- Total samples: 597
- Sequence length: 120 frames (all frames used, no temporal sampling)
- Feature dimension: 126 (2 hands × 21 landmarks × 3 coordinates)
- Split: Train 427 / Validation 85 / Test 85 (stratified-by-label)
- No rebalancing; no preprocessing changes; no augmentation

## Architecture

```
Input [120, 126]
    │
    ▼
Conv1D (filters=32, kernel=3, padding=same)
    │
    ▼
ReLU
    │
    ▼
Conv1D (filters=32, kernel=3, padding=same)
    │
    ▼
ReLU
    │
    ▼
MaxPool1D (pool_size=2, stride=2) → [60, 32]
    │
    ▼
LSTM (32 hidden units, forward)
    │
    ▼
Dropout (rate=0.2)
    │
    ▼
Dense (28 units) + Softmax
```

Total weight parameters:
- Conv1D_1: kernel [3×126×32] + bias [32] = 12,128
- Conv1D_2: kernel [3×32×32] + bias [32] = 3,104
- LSTM: wx [32×128] + wh [32×128] + b [128] = 8,320
- Classifier: wy [32×28] = 896, by [28] = 28
- Total: ~24,476 parameters

## Training

| Parameter | Value |
|---|---|
| Optimizer | Adam |
| Learning rate | 0.002 |
| Epochs requested | 45 |
| Epochs completed | 45 |
| Early stopping patience | 10 |
| Gradient clipping | 1.0 |
| Dropout rate | 0.2 |
| Random seed | 2026 |
| Batch | Full-batch SGD |

Key difference from LSTM/BiLSTM: all 120 frames are used (no temporal sampling).
The Conv1D layers and MaxPool reduce the sequence to 60 frames before the LSTM.

Training command: `npm run train:fsl-alphabet:cnn-lstm`

## Results

### Accuracy and Loss

| Split | Accuracy | Loss |
|---|---|---|
| Train | 74.94% | 0.741 |
| Validation | 67.06% | 1.011 |
| Test | 61.18% | 1.367 |

### Classification Metrics (Test)

| Metric | Value |
|---|---|
| Macro F1 | 60.76% |
| Weighted F1 | 60.93% |
| Test Loss | 1.367 |

### Per-Label Test Metrics

| Label | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| a | 33.3% | 33.3% | 33.3% | 3 |
| b | 100.0% | 66.7% | 80.0% | 3 |
| c | 100.0% | 66.7% | 80.0% | 3 |
| d | 66.7% | 66.7% | 66.7% | 3 |
| e | 100.0% | 33.3% | 50.0% | 3 |
| f | 50.0% | 66.7% | 57.1% | 3 |
| g | 50.0% | 66.7% | 57.1% | 3 |
| h | 100.0% | 66.7% | 80.0% | 3 |
| i | 33.3% | 66.7% | 44.4% | 3 |
| j | 66.7% | 66.7% | 66.7% | 3 |
| k | 100.0% | 66.7% | 80.0% | 3 |
| l | 50.0% | 33.3% | 40.0% | 3 |
| m | 0.0% | 0.0% | 0.0% | 3 |
| n | 60.0% | 100.0% | 75.0% | 3 |
| ñ | 100.0% | 66.7% | 80.0% | 3 |
| ng | 66.7% | 66.7% | 66.7% | 3 |
| o | 75.0% | 100.0% | 85.7% | 3 |
| p | 66.7% | 66.7% | 66.7% | 3 |
| q | 66.7% | 66.7% | 66.7% | 3 |
| r | 50.0% | 66.7% | 57.1% | 3 |
| s | 100.0% | 33.3% | 50.0% | 3 |
| t | 50.0% | 33.3% | 40.0% | 3 |
| u | 50.0% | 100.0% | 66.7% | 3 |
| v | 100.0% | 33.3% | 50.0% | 3 |
| w | 75.0% | 75.0% | 75.0% | 4 |
| x | 25.0% | 66.7% | 36.4% | 3 |
| y | 100.0% | 100.0% | 100.0% | 3 |
| z | 100.0% | 33.3% | 50.0% | 3 |

Per-label metrics should be interpreted with caution: each label has only 3 test
samples, so a single misclassification shifts F1 by 33 points.

## Error Analysis

### Weakest Labels (F1 < 40%)

- m: F1 = 0% — never correctly predicted
- a: F1 = 33.3%
- x: F1 = 36.4%

### Strongest Labels (F1 = 100%)

- y

### Most Confusable Pairs (from confusion matrix)

- m → multiple labels (all 3 test samples misclassified)
- a → confused with i (2 of 3 misclassifications)
- x → confused with s, w, u (2 of 3 correct, 1 correct)
- i → confused with a, e (2 of 3 correct, 1 correct)

## Model Comparison

| Model | Train | Validation | Test | Macro F1 | Weighted F1 | Loss |
|---|---|---|---|---|---|---|
| MLP | 96.49% | 70.59% | 69.41% | 67.31% | 68.87% | — |
| LSTM | 87.82% | 76.47% | 69.41% | 68.50% | 68.87% | 1.118 |
| BiLSTM | 95.55% | 77.65% | **71.76%** | **68.29%** | 68.66% | **0.842** |
| CNN-LSTM | **74.94%** | 67.06% | 61.18% | 60.76% | 60.93% | 1.367 |

**Best accuracy**: BiLSTM (71.76%)
**Best F1**: LSTM (macro 68.50%, weighted 68.87%)
**Best loss**: BiLSTM (0.842)
**Lowest overfitting**: CNN-LSTM (smallest train/test gap at 13.76%)

### Interpretation

The CNN-LSTM underperforms all prior models at 61.18% test accuracy. This is
10.58% below the BiLSTM and 8.23% below the LSTM and MLP baselines.

Several possible causes:

1. **Full 120-frame input**: Unlike previous models that used temporal sampling
   (30 evenly spaced frames), the CNN-LSTM uses all 120 frames. With 126
   features per frame, the Conv1D layers may be overfitting to noise in the
   dense frame sequence rather than extracting robust temporal features.

2. **Parameter count vs complexity**: At 24K parameters, the CNN-LSTM adds
   convolutional layers that introduce more trainable parameters than the LSTM
   (21K) while not being bidirectional like the BiLSTM (43K). The additional
   conv layers may need more data to generalize.

3. **Sparse input**: The raw landmark features are sparse (many zeros). Conv1D
   layers may be less effective on sparse high-dimensional input compared to
   the LSTM which can leverage the sparse representation more directly.

4. **Learning dynamics**: Training was slower to converge — by epoch 45 it was
   still improving (unlike LSTM/BiLSTM which plateaued earlier). More epochs or
   a lower learning rate might help.

### Comparison with LSTM

**Confusions eliminated** (CNN-LSTM better):
- b: F1 80% vs 50% (LSTM)
- c: F1 80% vs 80% (tie)
- ñ: F1 80% vs 50% (LSTM)
- v: F1 50% vs 0% (LSTM)
- y: F1 100% vs 85.7% (LSTM)

**Confusions introduced** (LSTM better):
- a: F1 33% vs 40% (LSTM was similar at 40%)
- f: F1 57% vs 75% (BiLSTM)
- g: F1 57% vs 80% (BiLSTM)
- h: F1 80% vs 100% (BiLSTM)
- k: F1 80% vs 100% (BiLSTM)
- l: F1 40% vs 100% (BiLSTM)
- m: F1 0% vs 33% (LSTM)
- r: F1 57% vs 80% (LSTM)
- s: F1 50% vs 40% (improved vs BiLSTM but worse than LSTM's 66%)
- t: F1 40% vs 100% (LSTM)
- Most others were worse

## Runtime Considerations

| Metric | BiLSTM | CNN-LSTM |
|---|---|---|
| Parameters | 43,044 | ~24,476 |
| Model size (JSON weights) | ~336 KB | ~193 KB |
| TFJS export size | ~170 KB | ~96 KB (estimated) |
| Inference complexity | O(T × H²) | O(T × C × K) + O(T/P × H²) |

**Inference speed expectation**: The CNN-LSTM should be faster than BiLSTM in
practice because it has fewer LSTM parameters (32 hidden vs 64 combined) and the
Conv1D layers are efficient O(T × C × K). The LSTM processes only 60 steps
(after MaxPool) instead of 30 steps for BiLSTM (each directional).

**TFJS export status**: Not created. The CNN-LSTM did not outperform BiLSTM, so
it is not a candidate for deployment at this stage.

## Limitations

- Full 120-frame input may cause overfitting to frame-to-frame noise
- Only one CNN configuration tested (2 layers, 32 filters, kernel=3)
- No hyperparameter search (pool size, number of conv layers, conv filter count)
- Dataset size (597) limits CNN feature learning
- Sparse high-dimensional input (126D) may not be ideal for Conv1D
- Temporal sampling (used in LSTM/BiLSTM) was not applied here, making the
  comparison unequal in that dimension
- Only 3 test samples per label — per-label metrics unreliable

## Future Work

- Apply temporal sampling (30 frames) to CNN-LSTM for fair comparison
- Test deeper CNN (3-4 conv layers) or wider CNN (64 filters)
- Test Conv1D with larger kernel sizes (5, 7) for wider temporal context
- Test without MaxPool (use stride in Conv1D instead)
- Hyperparameter search for learning rate, dropout, and optimizer
- CNN without LSTM (global pooling → dense)
- Data augmentation to improve generalization
- Increased dataset size

Last updated: 2026-06-04
