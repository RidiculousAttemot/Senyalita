# FSL BiLSTM v3 (Real MediaPipe Landmarks) Results

**Generated:** 2026-06-07
**Status:** Trained — **NOT promoted** (v2 retained as deployed model)
**Model location:** `models/fsl_alphabet/bilstm_v3/`

## TL;DR

We replaced the all-zero placeholder Kaggle landmarks with **10,865 real MediaPipe
HandLandmarker extractions** (92.86 % of the 11,700 Kaggle images) and retrained
BiLSTM v3 on the merged dataset. The model learned a usable classifier
(**95.63 % test accuracy**) but did not improve on v2's **98.15 % test accuracy**,
so v2 remains the deployed model. v3 is kept as a more broadly-trained
fallback with a different data composition.

| Model | Test acc | Val acc | Train acc | Notes |
|-------|----------|---------|-----------|-------|
| BiLSTM v2 (custom 407 only) | **98.15 %** | 97.97 % | 100.00 % | Deployed |
| BiLSTM v3 placeholder (broken) | 6.90 % | — | — | Bug: Kaggle samples were zero matrices |
| **BiLSTM v3 real landmarks** | 95.63 % | 95.29 % | 97.42 % | Trained, not deployed |

## Why the gap to v2

- **Static vs dynamic sequences.** Each Kaggle FSL image is a single still
  photo of a handshape. We replicate the same 126-feature vector across all
  120 frames, so the BiLSTM sees a flat sequence with no temporal motion.
  v2 was trained on 120-frame web-cam recordings that *do* contain motion
  cues (transition between handshapes, signing rhythm).
- **Data dilution.** The custom dataset has 407 carefully curated video
  samples; v3 mixes them with 10,865 replicated-static-frame Kaggle
  samples. The Kaggle samples give the model 26× more "static handshape"
  exposure but at the cost of weaker temporal-signal training.
- **Confusion clusters** (from `confusion_matrix.json`): j↔i, m↔n↔s, o↔c,
  u↔v, g↔q — all pairs of static handshapes that are hard to disambiguate
  from a single frame.

## Training

```
Input shape:    [120, 126]
Temporal steps: 30, Hidden size: 32, Combined: 64
Train: 7,983  Validation: 1,700  Test: 1,739
```

- Best epoch: **37** (val acc **96.94 %**)
- Final epoch: **44** (early stopping, 10 epochs without improvement)
- Test accuracy: **95.63 %** (test macro F1: 95.52 %)
- Train accuracy: 97.42 %

## Dataset composition (v3)

| Source | Samples | Real landmarks? |
|--------|---------|-----------------|
| Custom (407 video recordings) | 557 | Yes |
| Kaggle FSL (11,700 photos) | 10,865 | **Yes (new in v3)** |
| **Total** | **11,422** | All real |

Per-label count in v3 test split: 53–72 samples (vs. 14–16 in v2 test).
The 1.2 GB train NDJSON and smaller validation/test splits are in
`datasets/processed/fsl_alphabet_combined/`.

## Decision: keep v2 deployed

Per the Phase 5.2 decision rule — *deployment based on measured metrics* —
v2 keeps the TFJS export at `models/fsl_alphabet/bilstm_v2_tfjs/`.
**v3 was not exported to TFJS** to avoid an unnecessary build/push.

To switch to v3 in the future:
```bash
npm run export:fsl-alphabet:bilstm:v3:tfjs
# then copy models/fsl_alphabet/bilstm_v3_tfjs/* to public/models/...
```

## Files

- Model weights + config: `models/fsl_alphabet/bilstm_v3/{model,config,labels,metrics,confusion_matrix,training_history}.json`
- Audit: `docs/fsl-kaggle-landmark-audit.md`
- Validation: `docs/fsl-kaggle-filtered-samples.md`
- Combined dataset validation: `docs/fsl-combined-dataset-validation.md`
- Phase 5.1 (standardization) baseline: `docs/fsl-dataset-standardization.md`
- Extraction script: `scripts/extract-fsl-kaggle-mediapipe.mjs`
- Resume script (Y/Z re-run): `scripts/extract-fsl-kaggle-resume.mjs`
