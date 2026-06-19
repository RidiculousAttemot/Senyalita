# Project Completion Report

## SignLangVisual — Real-Time FSL Alphabet Recognition

**Version:** 1.0.0  
**Date:** 2026-06-04  
**Repository:** `C:\Arwin\Thesis\SignLangVisual`

---

## 1. Objectives Achieved

### Primary Objective
Develop a real-time Filipino Sign Language (FSL) alphabet recognition system that runs entirely in the browser using hand landmarks and a deep learning sequence model.

### Sub-Objectives

| # | Objective | Status | Evidence |
|---|---|---|---|
| 1 | Build a browser-based hand landmark capture pipeline | ✅ | MediaPipe Hands at 30 FPS, landmark overlay, normalization |
| 2 | Train a baseline MLP classifier | ✅ | 69.41% test accuracy — validated pipeline |
| 3 | Train LSTM and BiLSTM sequence models | ✅ | BiLSTM v1: 71.76%, LSTM: 69.41% |
| 4 | Train and evaluate CNN-LSTM hybrid | ✅ | 61.18% — rejected for deployment |
| 5 | Expand dataset via landmark augmentation | ✅ | 597 → 3,592 samples, 6 virtual signers |
| 6 | Train BiLSTM v2 on expanded dataset | ✅ | 98.15% test accuracy, 98.14% macro F1 |
| 7 | Cross-signer generalization evaluation | ✅ | 94.96% average across 6 signers |
| 8 | Export model to TensorFlow.js | ✅ | TFJS format in public/ for browser serving |
| 9 | Integrate model into browser camera page | ✅ | Live recognition with confidence display |
| 10 | Session logging, history, and data export | ✅ | JSON/CSV export, history page, TTS |
| 11 | Runtime performance evaluation | ✅ | 11.8ms load, 13.57ms avg inference, 73.7 FPS |
| 12 | Confidence calibration analysis | ✅ | Threshold 0.60 recommended |
| 13 | Thesis documentation package | ✅ | 18 docs covering all aspects |

---

## 2. Research Findings

### Finding 1: Dataset Size Is the Dominant Accuracy Factor

The same BiLSTM architecture achieved:
- **71.76%** on 597 samples (v1)
- **98.15%** on 3,592 samples (v2)

The +26.39% improvement was driven entirely by data augmentation, not architectural changes. This demonstrates that landmark-based sign language recognition is strongly data-limited at small sample sizes.

### Finding 2: Temporal Sampling Outperforms Full-Sequence Processing

Models using 30-frame temporal sampling (MLP, LSTM, BiLSTM) consistently outperformed the CNN-LSTM that used all 120 frames directly (61.18% vs. 69–71% on v1). Evenly spaced sampling acts as effective temporal denoising.

### Finding 3: BiLSTM Generalizes Well to Virtual Signers

Leave-one-signer-out cross-validation achieved 94.96% average accuracy across 6 signers (5 virtual transforms). Occlusion was the hardest case (89.65%), while rotation and scaling were well-handled (94.86–96.63%).

### Finding 4: u/v/r Confusion Is the Primary Failure Mode

All 10 test errors (out of 542 samples) involve the u/v/r label cluster. These three FSL handshapes differ only in subtle finger positioning — index alone (u), index+middle spread (v), index+middle crossed (r) — which pushes the limits of 21-point landmark resolution.

### Finding 5: Browser Inference Is Viable for Real-Time Use

At 13.57 ms average inference time (73.7 FPS), the TF.js BiLSTM model has ~86% headroom within the 200 ms inference budget. No GPU, no server, and no native code is required — the system runs in any modern web browser.

---

## 3. Final Metrics

### Model Performance

| Metric | Value |
|---|---|
| Test accuracy | 98.15% |
| Test macro F1 | 98.14% |
| Test weighted F1 | 98.13% |
| Test loss | 0.037 |
| Train accuracy | 98.76% |
| Validation accuracy | 97.97% |
| Train-test gap | 0.61% |
| Model parameters | 42,780 |
| Cross-signer average | 94.96% |

### Runtime Performance

| Metric | Value |
|---|---|
| Model load time | 11.8 ms |
| Average inference | 13.57 ms |
| p95 inference | 17.60 ms |
| Estimated FPS (avg) | 73.7 |
| Estimated FPS (p95) | 56.8 |
| Model size (weights) | ~171 KB |

### Dataset

| Metric | Value |
|---|---|
| Total samples | 3,352 |
| Labels | 26 (a–z) |
| Signers | 6 (1 original + 5 augmented) |
| Training samples | 2,508 |
| Validation samples | 542 |
| Test samples | 542 |
| Frames per sample | 120 |
| Feature dimension | 126 |

### Build Health

| Check | Result |
|---|---|
| ESLint | 0 warnings, 0 errors |
| TypeScript | No type errors |
| Next.js build | Successful |
| Production bundle | 374 KB (camera page) |

---

## 4. Deployment Status

The system is deployed as a static Next.js application:

```
http://localhost:3000            # Landing page
http://localhost:3000/camera     # Live recognition camera page
http://localhost:3000/history    # Session history and exports
```

### Deployment Model

- **Model**: public/models/fsl_alphabet/bilstm_v2_tfjs/ (BiLSTM v2 TFJS export)
- **Bundle**: Camera page loads 287 KB + 87.5 KB shared (374 KB total)
- **Runtime**: TensorFlow.js WebGL backend
- **Tracking**: MediaPipe Hands WebAssembly

### Files Deployed

| Path | Purpose |
|---|---|
| `public/models/fsl_alphabet/bilstm_v2_tfjs/model.json` | TFJS model topology + weight manifest |
| `public/models/fsl_alphabet/bilstm_v2_tfjs/weights.bin` | Binary weight data |
| `public/models/fsl_alphabet/bilstm_v2_tfjs/labels.json` | 28-label mapping |

---

## 5. Limitations

### Dataset
- All 3,592 samples derive from a single signer — virtual signers are synthetic transforms, not real people
- Only static handshapes — no dynamic transitions, no continuous signing
- Controlled recording environment limits generalizability

### Model
- Three confusable labels (u, v, r) account for all test errors
- Unvalidated on real multi-signer data
- No word-level or sentence-level understanding

### System
- Requires steady handholding for ~4 seconds per sign
- Degrades in low light, beyond 1.5m, and with partial occlusion
- 120-frame buffer adds latency for first prediction

### Evaluation
- Test set drawn from same augmented distribution as training set
- No user study with deaf FSL participants
- Environmental testing was informal (not systematic)

---

## 6. Future Work

### Immediate (0–3 months)
1. **Multi-signer data collection** — Record 10+ deaf FSL signers with diverse hand morphologies, then retrain and evaluate.
2. **User study** — Conduct usability evaluation with deaf participants measuring accuracy, satisfaction, and task completion time.
3. **Confidence threshold UI** — Implement the 0.60 threshold filtering in the camera page so low-confidence predictions do not appear in the transcript.

### Short-term (3–6 months)
4. **Dynamic fingerspelling** — Extend from isolated handshapes to continuous letter-by-letter fingerspelling with automatic segmentation.
5. **Word-level gestures** — Add a vocabulary of 50–100 common FSL word gestures (greetings, family, time, questions).
6. **Environmental robustness** — Systematic testing across 5+ lighting conditions, 3 backgrounds, 3 camera distances, and 2 camera types.

### Long-term (6–12 months)
7. **Non-manual signal integration** — Add facial expression and head movement recognition for grammatical context.
8. **Full FSL sentence recognition** — Combine handshape, motion, and non-manual signals into a complete sentence-level recognition pipeline.
9. **Mobile deployment** — Test and optimize for mobile browsers and lower-end devices.
10. **Community dataset** — Publish an open FSL landmark dataset to enable broader research in Philippine sign language processing.

---

## 7. Repository Structure

```
SignLangVisual/
├── docs/                          # 19 documentation files
├── datasets/                      # Recording transcripts + processed data
├── models/fsl_alphabet/           # 9 model artifact directories
├── public/models/fsl_alphabet/    # 2 deployed TFJS models
├── scripts/                       # 17 functional scripts
├── src/
│   ├── app/                       # Next.js pages (/, /camera, /history)
│   └── features/
│       ├── recognition/           # Core recognition pipeline
│       └── logging/               # Session logging + export
├── package.json                   # 20 npm scripts
└── README.md
```

---

## 8. Conclusion

This project successfully demonstrates that real-time FSL alphabet recognition is achievable in a web browser using MediaPipe hand landmarks and a BiLSTM sequence model. The final system achieves **98.15% test accuracy** with **13.57 ms average inference time** — well within real-time constraints — using only **42,780 parameters** and no server-side processing.

The primary research finding is that **dataset size is the dominant accuracy factor**: expanding from 597 to 3,592 samples (6× via landmark augmentation) improved accuracy by +26.39% with the identical architecture. This suggests that future improvements should prioritize data diversity over architectural complexity.

The system is feature-complete at v1.0.0 with session logging, transcript generation, JSON/CSV export, text-to-speech (English/Tagalog), and a history page. All source code, model artifacts, documentation, and evaluation results are committed to the repository with a `v1.0.0` release tag.

The most important next step is **multi-signer data collection** to validate real-world generalization beyond the single-source virtual signers used in this study.
