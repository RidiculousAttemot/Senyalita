# Thesis Tables

This document contains publication-ready tables for the thesis manuscript.

---

## Table 1: Dataset Statistics

| Feature | Value |
|---|---|
| Total labels | 28 (a–z, ñ, ng) |
| Total samples (v1) | 597 |
| Total samples (v2) | 3,592 |
| Virtual signers | 6 (S01 original + S02–S06 augmented) |
| Frames per sample | 120 |
| Feature dimension per frame | 126 (2 hands × 21 landmarks × 3 coordinates) |
| Training split (v2) | 2,508 (69.8%) |
| Validation split (v2) | 542 (15.1%) |
| Test split (v2) | 542 (15.1%) |
| Temporal sampling | 30 frames evenly spaced from 120 |
| Label distribution | Balanced: 18–22 samples per label per split |

---

## Table 2: Architecture Comparison

| Model | Architecture | Parameters | Input | Dataset |
|---|---|---|---|---|
| MLP | Flatten → Dense(256) → Dense(128) → Dense(28) | 1,082,656 | [3780] (flattened) | v1 (597) |
| LSTM | LSTM(32) → Dropout(0.2) → Dense(28) | 21,372 | [30, 126] | v1 (597) |
| BiLSTM v1 | BiLSTM(32×2) → Dropout(0.2) → Dense(28) | 42,780 | [30, 126] | v1 (597) |
| CNN-LSTM | Conv1D(32,k=3)×2 → MaxPool(2) → LSTM(32) → Dropout(0.2) → Dense(28) | 23,964 | [120, 126] | v1 (597) |
| BiLSTM v2 | BiLSTM(32×2) → Dropout(0.2) → Dense(28) | 42,780 | [30, 126] | v2 (3,592) |

---

## Table 3: Model Performance Comparison

| Model | Train Acc. | Val. Acc. | Test Acc. | Macro F1 | Wtd. F1 | Test Loss |
|---|---|---|---|---|---|---|
| MLP (Baseline) | 96.49% | 70.59% | 69.41% | 67.31% | 68.87% | — |
| LSTM | 87.82% | 76.47% | 69.41% | 68.50% | 68.87% | 1.118 |
| BiLSTM v1 | 95.55% | 77.65% | 71.76% | 68.29% | 68.66% | 0.842 |
| CNN-LSTM | 74.94% | 67.06% | 61.18% | 60.76% | 60.93% | 1.367 |
| **BiLSTM v2** | **98.76%** | **97.97%** | **98.15%** | **98.14%** | **98.13%** | **0.037** |

---

## Table 4: Cross-Signer Generalization (Leave-One-Signer-Out)

| Held-Out Signer | Transform | Accuracy | Macro F1 |
|---|---|---|---|
| S01 (original) | None | 97.99% | 97.96% |
| S02 (rotation) | ±15° random rotation | 94.86% | 94.79% |
| S03 (scaling) | 0.8×–1.2× random scale | 96.63% | 96.60% |
| S04 (noise) | Gaussian jitter (σ=0.02) | 93.35% | 93.27% |
| S05 (occlusion) | Random landmark dropout | 89.65% | 89.59% |
| S06 (mixed) | Combined transforms | 97.16% | 97.10% |
| **Average** | | **94.96%** | **94.90%** |

---

## Table 5: Per-Label Test Performance (BiLSTM v2, 542 Test Samples)

Only labels with F1 < 1.0 are listed. The remaining 19 labels achieved perfect F1 = 1.000.

| Label | Precision | Recall | F1 | Support | Errors |
|---|---|---|---|---|---|
| u | 0.833 | 0.750 | 0.789 | 20 | 4→r, 1→v |
| v | 0.941 | 0.842 | 0.889 | 19 | 3→u |
| r | 0.826 | 1.000 | 0.905 | 19 | — (all correct, but 4 u misclassified as r) |
| b | 1.000 | 0.900 | 0.947 | 20 | 2→c |
| c | 0.900 | 1.000 | 0.947 | 18 | — |
| **Macro Avg** | **0.982** | **0.982** | **0.981** | 542 | 10 total |

---

## Table 6: Runtime Performance (Node.js Headless, TFJS CPU Backend)

| Metric | Value |
|---|---|
| Model load time | 11.8 ms |
| Average inference time | 13.57 ms |
| Minimum inference time | 10.76 ms |
| Maximum inference time | 34.68 ms |
| p95 inference time | 17.60 ms |
| Estimated FPS (average) | 73.7 |
| Estimated FPS (p95) | 56.8 |
| Process RSS | ~101 MB |

All measurements over 542 test samples. Model: BiLSTM v2 (42,780 parameters). Input shape: [1, 30, 126].

---

## Table 7: Deployed System Configuration

| Component | Technology |
|---|---|
| Framework | Next.js 14 (React) |
| Hand tracking | MediaPipe Hands (via @mediapipe/hands) |
| ML runtime | TensorFlow.js (WebGL backend) |
| Model format | TFJS model.json + weights.bin |
| Inference interval | 200 ms |
| Sequence buffer | 120 frames (rolling window) |
| Temporal sampling | 30 frames evenly spaced |
| Prediction smoothing | Majority vote (window=10) |
| Confidence threshold | 0.60 (configurable) |
| Data export | JSON / CSV |
| TTS | Web Speech API (English / Tagalog) |

---

## Table 8: BiLSTM v2 — Accuracy Improvement Across Stages

| Stage | Model | Dataset | Test Accuracy | Δ from Previous |
|---|---|---|---|---|
| 1 | MLP (Baseline) | 597 | 69.41% | — |
| 2 | LSTM | 597 | 69.41% | 0.00% |
| 2.1 | BiLSTM v1 | 597 | 71.76% | +2.35% |
| 3 | CNN-LSTM | 597 | 61.18% | −10.58% |
| 4 | BiLSTM v2 | 3,592 | 98.15% | +26.39% |
| 5 | BiLSTM v2 (deployed) | 3,592 | 98.15% | — |

---

## Table 9: Confusion Matrix Summary (Test Set, 542 Samples)

| True \ Pred | Correct | Errors | Main Confusions |
|---|---|---|---|
| b | 18 | 2 | 2→c |
| u | 15 | 5 | 4→r, 1→v |
| v | 16 | 3 | 3→u |
| All others | 483 | 0 | — |
| **Total** | **532** | **10** | |

---

## Table 10: Training Configuration (BiLSTM v2)

| Hyperparameter | Value |
|---|---|
| Hidden units (per direction) | 32 |
| Bidirectional | Yes |
| Temporal steps | 30 |
| Feature dimension | 126 |
| Dropout rate | 0.2 |
| Optimizer | Adam |
| Learning rate | 0.002 |
| Max epochs | 45 |
| Batch size | 32 |
| Early stopping patience | 10 |
| Weight initialization | Xavier/Glorot |
| Activation (hidden) | tanh |
| Activation (output) | softmax |
| Loss function | categorical cross-entropy |
