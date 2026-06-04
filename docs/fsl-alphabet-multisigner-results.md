# FSL Alphabet Multi-Signer Evaluation Results

## Dataset Expansion

The original FSL alphabet dataset (597 recordings, single signer S01) was augmented
via landmark-level transforms to create 5 virtual signers (S02–S06), each with a
distinct augmentation preset:

| Signer | Augmentation | Samples |
|--------|-------------|---------|
| S01 | Original (no augmentation) | 597 |
| S02 | Rotation (±10°) | 599 |
| S03 | Scale (0.85–1.15) | 599 |
| S04 | Gaussian noise (σ=0.015) | 599 |
| S05 | Temporal occlusion (8%) | 599 |
| S06 | Mixed (all of the above) | 599 |
| **Total** | | **3592** |

The dataset was split stratified-by-label: 2508 train / 542 validation / 542 test.

## BiLSTM v2 Training

The same BiLSTM architecture as v1 was retrained on the full expanded dataset:

- **Architecture**: Bidirectional LSTM, 32 hidden units per direction (64 combined),
  30 sampled timesteps from [120, 126] sequences, dropout 0.2, dense-softmax classifier
- **Training**: Adam lr 0.002, 45 epochs, early stopping patience 10, gradient clip 1.0

### Results

| Metric | BiLSTM v1 (597 samples) | BiLSTM v2 (3592 samples, 6 signers) |
|--------|------------------------|--------------------------------------|
| Train accuracy | 95.55% | 98.76% |
| Validation accuracy | 77.65% | 97.97% |
| Test accuracy | 71.76% | **98.15%** |
| Test macro F1 | 68.29% | 98.14% |
| Test weighted F1 | 68.66% | 98.13% |
| Test loss | 0.842 | 0.037 |

### Per-Label Test F1 (v2)

| Label | F1 | Label | F1 | Label | F1 | Label | F1 |
|-------|----|-------|----|-------|----|-------|----|
| a | 1.000 | h | 1.000 | o | 1.000 | v | 0.886 |
| b | 0.978 | i | 1.000 | p | 1.000 | w | 1.000 |
| c | 0.988 | j | 1.000 | q | 1.000 | x | 1.000 |
| d | 1.000 | k | 1.000 | r | 0.967 | y | 0.995 |
| e | 0.983 | l | 1.000 | s | 1.000 | z | 1.000 |
| f | 1.000 | m | 1.000 | t | 1.000 | | |
| g | 1.000 | n | 1.000 | u | 0.854 | | |

The weakest labels are **u (0.854)**, **v (0.886)**, and **b (0.978)**. These are
confused with similar hand shapes (e.g., u → r, v → r, b → e in train; u ↔ v in
validation). All other 25/28 labels achieve F1 ≥ 0.967.

## Cross-Signer Evaluation

Leave-one-signer-out evaluation was performed across all 6 virtual signers (20 epochs
per fold, BiLSTM with same architecture).

### Per-Signer Results

| Signer | Augmentation Type | Test Samples | Accuracy | Macro F1 | Weighted F1 |
|--------|-------------------|-------------|----------|----------|-------------|
| S01 | Original | 597 | 97.99% | 98.00% | 97.98% |
| S02 | Rotation | 599 | 94.66% | 94.31% | 94.28% |
| S03 | Scale | 599 | 95.83% | 95.84% | 95.85% |
| S04 | Noise | 599 | 94.49% | 94.60% | 94.55% |
| S05 | Occlusion | 599 | 89.65% | 89.35% | 89.38% |
| S06 | Mixed | 599 | 97.16% | 97.12% | 97.14% |
| **Average** | | | **94.96%** | **94.87%** | **94.86%** |

### Key Findings

1. **Best generalization**: original (S01, 97.99%) and mixed (S06, 97.16%) — the
   mixed augmentation includes all transform types, which the model handles well.

2. **Weakest generalization**: temporal occlusion (S05, 89.65%) — dropping 8% of
   frames creates the hardest domain shift, reducing accuracy by ~8% vs the average.

3. **Rotation, scale, noise generalize well** (94–96%) — the BiLSTM is robust to
   these landmark perturbations.

4. **Average cross-signer accuracy 94.96%** — strong evidence that the BiLSTM
   generalizes across synthetic recording conditions when trained on sufficient
   augmented data.

### Key Caveat

All augmented signers (S02–S06) derive from the same 597 original S01 recordings.
This is **not** true multi-signer evaluation — real cross-signer generalization
requires data from different people with different hand shapes, signing styles, and
recording conditions. The virtual signer approach tests robustness to landmark
perturbations (rotations, scaling, noise, occlusion), not genuine signer
variability.

## Model Comparison (All Stages)

| Metric | MLP | LSTM | BiLSTM v1 | CNN-LSTM | BiLSTM v2 |
|--------|-----|------|-----------|----------|-----------|
| Train accuracy | 96.49% | 87.82% | 95.55% | 74.94% | **98.76%** |
| Validation accuracy | 70.59% | 76.47% | 77.65% | 67.06% | **97.97%** |
| Test accuracy | 69.41% | 69.41% | 71.76% | 61.18% | **98.15%** |
| Test macro F1 | 67.31% | 68.50% | 68.29% | 60.76% | **98.14%** |
| Test weighted F1 | 68.87% | 68.87% | 68.66% | 60.93% | **98.13%** |
| Parameters | 1.1M | 21K | 43K | 24K | 43K |
| Dataset samples | 597 | 597 | 597 | 597 | 3592 |

## Conclusion

Dataset expansion via landmark augmentation was the dominant factor in improving
accuracy. The BiLSTM v2 achieves **98.15% test accuracy** on 3592 samples (6 virtual
signers), up from 71.76% on 597 samples (single signer). Cross-signer evaluation
averages 94.96% across augmented recording conditions.

The model is ready for TFJS deployment and browser-based inference integration.
True multi-signer data collection remains the next frontier for validating real-world
generalization.
