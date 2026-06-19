# Thesis Figures Package

This document lists all figures required for the thesis manuscript with suggested captions.

---

## Figure 1: System Architecture

**Caption:** System architecture of the real-time FSL alphabet recognition system. MediaPipe Hands captures 21 landmarks per hand at 30 FPS. Landmarks are normalized, buffered into a 120-frame rolling window, temporally sampled to 30 frames, and fed into a BiLSTM classifier. Output predictions are smoothed via majority voting and displayed on the UI.

**Elements to show:**
1. Webcam → MediaPipe Hands pipeline
2. Landmark extraction (21 landmarks × 2 hands × 3 coordinates = 126-dim)
3. Normalization (wrist-center, max-abs scale)
4. Sequence buffer (120-frame rolling window)
5. Temporal sampling (30 from 120)
6. BiLSTM v2 inference (42,780 params, 98.15% acc)
7. Prediction smoothing (majority vote, window=10)
8. UI output (predicted letter, confidence, top-3)

---

## Figure 2: Dataset Pipeline

**Caption:** Dataset preparation pipeline. Raw MediaPipe landmark recordings (120 frames per sample, 28 labels) are validated, normalized, and split into train/validation/test sets. The v2 dataset is created by augmenting the original recordings with geometric transforms to create 5 virtual signers (S02–S06), increasing the total from 597 to 3,592 samples.

**Elements to show:**
1. Raw landmark recordings (S01, 597 samples)
2. Validation and normalization
3. Train/validation/test split (70/15/15)
4. Augmentation transforms (rotation, scaling, noise, occlusion, mixed)
5. Virtual signers S02–S06
6. Expanded dataset (3,592 samples)

---

## Figure 3: Recognition Pipeline

**Caption:** Real-time recognition pipeline in the browser. MediaPipe Hands landmarks are processed each frame, appended to a 120-frame rolling buffer. Every 200 ms, 30 frames are evenly sampled and passed to the TFJS BiLSTM model for inference. The output is smoothed over the last 10 predictions and displayed as the recognized sign.

**Elements to show:**
1. Frame-by-frame landmark capture (30 FPS)
2. Exponential moving average smoothing (α=0.2)
3. Sequence buffer (120-frame window)
4. 200 ms inference timer
5. Temporal sampling (30 from 120)
6. TFJS inference ([1,30,126] → [1,28] softmax)
7. Majority vote smoothing (window=10)
8. Display predicted sign, confidence, top-3

---

## Figure 4: Training Pipeline

**Caption:** Model training pipeline. Processed landmark sequences are used to train five architectures: MLP, LSTM, BiLSTM, CNN-LSTM, and BiLSTM v2. Each model is evaluated on accuracy, F1 score, loss, and confusion matrix. The best-performing model (BiLSTM v2) is exported to TensorFlow.js and deployed to the browser.

**Elements to show:**
1. Input: [batch, 30, 126] tensors
2. Five model architectures
3. Training loop (Adam, lr=0.002, max 45 epochs)
4. Evaluation metrics (accuracy, F1, loss, confusion matrix)
5. Model selection (BiLSTM v2, 98.15% test acc)
6. TFJS export → browser deployment

---

## Figure 5: Confusion Matrix

**Caption:** Test set confusion matrix for BiLSTM v2 (542 samples, 28 labels). Diagonal values represent correct predictions; off-diagonal values represent errors. 25 out of 28 labels achieve perfect classification. The primary confusion cluster is u ↔ v ↔ r, accounting for 8 of 10 total errors.

**Suggested format:** Heatmap (28×28 grid) with color intensity proportional to count. Annotate the u/v/r region.

---

## Figure 6: Confidence Distribution

**Caption:** Confidence score distribution for correct and incorrect predictions on the test set. Correct predictions (532/542) are concentrated near confidence 1.0. Incorrect predictions (10/542) show lower confidence scores, validating the confidence threshold strategy.

**Suggested format:** Histogram with overlaid correct (green) and incorrect (red) bins.

---

## Figure 7: Cross-Signer Performance

**Caption:** Leave-one-signer-out cross-validation accuracy across 6 signers. S01 (original landmarks) achieves the highest accuracy (97.99%). S05 (occlusion) is the most challenging transform (89.65%). Average accuracy across all signers is 94.96%.

**Suggested format:** Bar chart with 6 bars (one per signer), color-coded by transform type, with a dashed line for the average.

---

## Figure 8: Training History

**Caption:** BiLSTM v2 training and validation loss over 45 epochs. The model converges rapidly within the first 15 epochs and maintains low validation loss with minimal overfitting (train-test gap: 0.61%).

**Suggested format:** Dual-line plot (train loss, validation loss) over epochs.

---

## Figure 9: Label Accuracy Distribution

**Caption:** Per-label F1 scores for all 28 FSL alphabet labels. 19 labels achieve perfect F1 = 1.000. Six labels are in the 0.90–0.99 range. Three labels (u, v, r) fall below 0.90, with u at 0.789 being the weakest.

**Suggested format:** Horizontal bar chart, labels on y-axis, F1 on x-axis. Color bars by range (1.0=green, 0.9–0.99=yellow, <0.9=red).

---

## Figure 10: Camera Interface

**Caption:** Camera page UI showing the live webcam feed with hand landmark overlay (left), predicted sign with confidence score (center), top-3 suggestions (right), and status indicators (bottom). The sequence buffer progress bar shows the current collection state.

**UI elements to capture:**
1. Live webcam feed
2. Hand landmark overlay (21 points per hand)
3. Handedness labels (Left/Right)
4. FPS counter
5. Status indicator (No hand / 1 hand / 2 hands detected)
6. Predicted sign (large display)
7. Confidence score (percentage bar)
8. Top-3 suggestions
9. Sequence buffer progress (0/120 → 120/120)
10. Session controls (Create Session / End Session)

---

## Figure 11: History Page

**Caption:** History page showing a list of past recognition sessions with timestamps, duration, and transcript summaries. Clicking a session expands to show per-frame prediction details with export options.

**UI elements to capture:**
1. Session list with timestamps
2. Transcript summary per session
3. Expanded session view (per-frame predictions with confidence)
4. Export buttons (JSON, CSV)

---

## Figure 12: Data Export Formats

**Caption:** Example JSON (left) and CSV (right) export formats. JSON contains structured session metadata with per-frame predictions and confidence scores. CSV provides a flattened table view suitable for spreadsheet analysis.

**Elements to show:**
1. JSON structure: session metadata, predictions array (frame, label, confidence, timestamp)
2. CSV structure: columns for frame, label, confidence, and timestamp

---

## Figure 13: Model Size Comparison

**Caption:** Parameter count comparison across all trained models. MLP (1.08M params) is over 25× larger than BiLSTM v2 (42,780 params) despite achieving the lowest test accuracy. The BiLSTM architecture achieves the best accuracy-to-parameter ratio.

**Suggested format:** Bar chart with model names on x-axis and parameter count (log scale) on y-axis. Color bars by test accuracy.

---

## Figure 14: Agreement Between Training and Test Accuracy

**Caption:** Relationship between model complexity (parameters) and test accuracy. The BiLSTM v2 achieves the highest accuracy with moderate parameter count, while the MLP overfits severely (96.49% train vs. 69.41% test). Dataset expansion (v2) is the dominant factor in closing the generalization gap.

**Suggested format:** Scatter plot with parameters on x-axis (log scale) and accuracy on y-axis. Points labeled by model. Show train-test gap as vertical lines.

---

## Figure 15: Threshold Simulation

**Caption:** Effect of confidence threshold on prediction coverage and precision. Lower thresholds (0.50) accept more predictions but include some errors. Higher thresholds (0.80) achieve perfect precision but reject ~7% of correct predictions. The recommended threshold (0.60) balances coverage (>99%) and precision (>99%).

**Suggested format:** Dual-axis line chart: threshold on x-axis, coverage (%) on left y-axis, precision (%) on right y-axis.

---

## Figure 16: Runtime Latency Distribution

**Caption:** Distribution of inference times across 542 test samples. The BiLSTM v2 model achieves a mean inference time of 13.57 ms with low variance (σ ≈ 3 ms). All measurements are well within the 200 ms inference budget.

**Suggested format:** Histogram of inference times (ms), with vertical lines for mean, p95, and the 200 ms budget limit.

---

## Figure 17: Per-Label Test Support

**Caption:** Distribution of test samples per label (506 total, ~19 per label). The dataset is well-balanced across all 26 labels, with support ranging from 18 (c, p, z) to 22 (w).

**Suggested format:** Bar chart with labels on x-axis and sample count on y-axis.

---

## Figure 18: Training Convergence Comparison

**Caption:** Validation accuracy over training epochs for all five models. BiLSTM v2 converges faster and to a higher accuracy than any v1 model. CNN-LSTM shows erratic validation accuracy and the poorest final performance.

**Suggested format:** Multi-line plot with epochs on x-axis and validation accuracy on y-axis. Each model is a different colored line.

---

## Figure 19: Error Analysis — u/v/r Confusion

**Caption:** Detailed confusion within the u/v/r label cluster. Of 20 u test samples, 4 are misclassified as r and 1 as v. Of 19 v test samples, 3 are misclassified as u. All r predictions are correct, but 4 u samples are erroneously predicted as r.

**Suggested format:** Sankey diagram or flow chart showing true labels (left) flowing to predicted labels (right), with arrow widths proportional to count.

---

## Figure 20: Virtual Signer Transform Visualization

**Caption:** Visualization of landmark augmentation transforms used to create virtual signers. Each column shows the same base recording with a different transform applied: original (S01), rotation (S02), scaling (S03), noise (S04), occlusion (S05), and mixed (S06).

**Suggested format:** 2×3 grid of hand skeleton plots, each showing the same handshape with different geometric transforms applied.

---

## Figure 21: Deployment Architecture

**Caption:** Deployment architecture showing the Next.js application serving static model files from `public/models/`. The BiLSTM v2 TFJS model (model.json + weights.bin) is loaded into the browser at runtime via TensorFlow.js. No backend or API calls are needed for inference — all computation runs client-side.

**Elements to show:**
1. Next.js server (npm run dev / npm run build)
2. Static model files (public/models/fsl_alphabet/bilstm_v2_tfjs/)
3. Browser with TF.js runtime
4. MediaPipe Hands WebAssembly
5. Camera stream → landmarks → inference pipeline
6. UI rendering (React components)

---

## Summary of Required Figures

| # | Figure | Type | Priority |
|---|---|---|---|
| 1 | System Architecture | Block diagram | Required |
| 2 | Dataset Pipeline | Flow diagram | Required |
| 3 | Recognition Pipeline | Flow diagram | Required |
| 4 | Training Pipeline | Flow diagram | Required |
| 5 | Confusion Matrix | Heatmap | Required |
| 6 | Confidence Distribution | Histogram | Recommended |
| 7 | Cross-Signer Performance | Bar chart | Required |
| 8 | Training History | Line plot | Recommended |
| 9 | Label Accuracy Distribution | Bar chart | Recommended |
| 10 | Camera Interface | Screenshot | Required |
| 11 | History Page | Screenshot | Recommended |
| 12 | Data Export Formats | Screenshot | Recommended |
| 13 | Model Size Comparison | Bar chart | Recommended |
| 14 | Accuracy vs Parameters | Scatter plot | Optional |
| 15 | Threshold Simulation | Line chart | Recommended |
| 16 | Runtime Latency | Histogram | Recommended |
| 17 | Per-Label Test Support | Bar chart | Optional |
| 18 | Training Convergence | Line plot | Required |
| 19 | u/v/r Error Analysis | Sankey/flow | Recommended |
| 20 | Virtual Signer Transforms | Grid plot | Recommended |
| 21 | Deployment Architecture | Block diagram | Required |
