# FSL Alphabet Model Design

This document outlines model architecture planning and staged results for FSL
alphabet recognition only.

## Dataset Summary
- Labels: a-z, ñ, ng (28 total)
- Total samples (v1): 597 (single signer S01)
- Total samples (v2): 3592 (6 virtual signers S01–S06)
- Sequence length: 120 frames
- Feature dimension: 126 (2 hands x 21 landmarks x 3 coordinates)
- Split strategy (v1): stratified-by-label (train 427 / validation 85 / test 85)
- Split strategy (v2): stratified-by-label (train 2508 / validation 542 / test 542)
- Feature values: min -1.0000, max 1.0000, average -0.058404
- All-zero frames: 33,129

## Label Set
a b c d e f g h i j k l m n ñ ng o p q r s t u v w x y z

## Input/Output Shapes
- Input tensor shape: [sequenceLength, featureDimension] = [120, 126]
- Output class count: 28

## Candidate Model Approaches
1. Baseline MLP
   - Flatten [120, 126] into a single vector
   - Simple fully-connected layers to validate the pipeline
   - Status: complete

2. 1D CNN over time
   - Convolution along the time axis
   - Captures local temporal patterns in landmark sequences

3. LSTM / BiLSTM
   - Sequence model over landmark frames
   - Captures longer temporal dependencies
   - Status: first LSTM complete, BiLSTM complete

4. CNN-LSTM hybrid
   - 1D CNN for temporal feature extraction
   - LSTM for sequence modeling
   - Status: complete

5. Lightweight model for browser deployment (later)
   - Smaller parameter count
   - Target low-latency inference after accuracy is acceptable

## Staged Training Approach
Stage 1: Baseline - Complete
- Train a simple MLP to validate data pipeline and label mapping
- Verify training loop, metrics, and data splits
- Result: train accuracy 96.49%, validation accuracy 70.59%, test accuracy
  69.41%
- Interpretation: the training pipeline works, but the train/validation gap
  suggests overfitting and the baseline is not yet thesis-ready

Stage 2: Sequence model - First LSTM Complete
- Train LSTM or BiLSTM on landmark sequences
- Evaluate temporal performance gains
- Command: `npm run train:fsl-alphabet:lstm`
- Chosen architecture: lightweight forward LSTM with 32 hidden units, 30
  evenly sampled timesteps from each [120, 126] sequence, dropout 0.2, and a
  dense softmax classifier
- Result: train accuracy 87.82%, validation accuracy 76.47%, test accuracy
  69.41%, test macro F1 68.50%, test weighted F1 68.87%
- Interpretation: the LSTM uses temporal sequence structure directly and is
  less overfit than the flattened MLP baseline, but test accuracy is not yet
  improved

Stage 2.1: BiLSTM Experimental Comparison Complete
- Train bidirectional LSTM on landmark sequences
- Compare temporal performance against forward LSTM
- Command: `npm run train:fsl-alphabet:bilstm`
- Architecture: BiLSTM with 32 hidden units per direction (64 combined), 30
  sampled timesteps, dropout 0.2, Adam lr 0.002
- Result: test accuracy 71.76% (+2.35% vs LSTM), test macro F1 68.29%
- Interpretation: BiLSTM achieves the highest test accuracy of all three models
  tested. Gains are modest (+2.35%) and 3-sample-per-class per-label metrics are
  noisy. TFJS export completed but not integrated into camera page yet.

Stage 3: CNN-LSTM Hybrid - Complete
- Train CNN-LSTM hybrid on full 120-frame sequences
- Compare against LSTM, BiLSTM, and MLP baselines
- Command: `npm run train:fsl-alphabet:cnn-lstm`
- Architecture: Conv1D(32, k=3) ×2 → MaxPool(2) → LSTM(32) → Dropout(0.2) → Dense(28)
- Result: test accuracy 61.18% — lower than all prior models
- Interpretation: full-frame Conv1D feature extraction underperforms temporal
  sampling + direct LSTM for this sparse landmark dataset. Investigation needed:
  temporal sampling, deeper/wider conv layers, or skip-stage to dataset expansion.

Stage 4: Dataset Expansion and Multi-Signer Evaluation - Complete
- Expand dataset from 597 to 3592 samples via landmark augmentation (5 presets)
- Extend metadata with signerId, sessionId, deviceType, lighting, handedness
- Create 5 virtual signers (S02 rotation, S03 scale, S04 noise, S05 occlusion,
  S06 mixed) plus original S01
- Evaluate leave-one-signer-out cross-validation across all 6 signers
- Retrain BiLSTM on full expanded dataset (BiLSTM v2)
- Export best model to TFJS for browser deployment
- Result: test accuracy 98.15% (+26.39% vs v1)

Stage 5: TFJS Integration and Browser Deployment - Complete
- Deployed BiLSTM v2 TFJS model into browser camera page (loader.ts → bilstm_v2_tfjs/)
- 11.8ms model load, 13.57ms avg inference, 73.7 FPS estimated
- Confidence threshold default: 0.60
- Final evaluation: `docs/fsl-alphabet-final-evaluation.md`
- Demo script: `docs/final-demo-script.md`
- Release tag: v1.0.0

## Evaluation Metrics
- Accuracy
- Per-label precision, recall, and F1
- Confusion matrix
- Validation loss/accuracy curves
- Test accuracy

## Success Criteria
- Baseline proves the training pipeline works end-to-end
- Target accuracy can be set after first experiments
- No word-gesture training until alphabet recognition is evaluated

## Baseline Result Summary
The Stage 1 flattened MLP baseline has been trained and evaluated. It achieved
96.49% train accuracy, 70.59% validation accuracy, and 69.41% test accuracy.
The result confirms that preprocessing, label mapping, model training,
evaluation, metrics export, and artifact saving work end-to-end for alphabet
recognition.

The accuracy is not yet thesis-ready. The high training accuracy compared with
validation and test accuracy indicates overfitting, likely because the baseline
uses a flattened vector and the available dataset is still small. More
signer/device/background variation may be needed later for robust real-world
recognition.

Stage 1 is complete. Stage 2 should train and evaluate an LSTM or BiLSTM model
that consumes the [120, 126] landmark sequence directly. CNN-LSTM should remain
deferred until after the simpler sequence model is evaluated.

## LSTM Result Summary
The first Stage 2 LSTM has been trained and evaluated with
`npm run train:fsl-alphabet:lstm`. It uses a forward LSTM with 32 hidden units
over 30 evenly sampled timesteps from each [120, 126] sequence, followed by
dropout and a dense softmax classifier.

The LSTM achieved 87.82% train accuracy, 76.47% validation accuracy, and 69.41%
test accuracy. Its test macro F1 was 68.50% and weighted F1 was 68.87%. Compared
with the baseline, validation accuracy improved and train accuracy dropped,
which suggests reduced overfitting. Test accuracy matched the baseline, while
test loss and F1 improved slightly.

Stage 2's first LSTM experiment is complete, but accuracy is still not
thesis-ready. A BiLSTM was compared next (see BiLSTM Result Summary below)
before moving to the future CNN-LSTM stage.

## BiLSTM Result Summary

A BiLSTM (Stage 2.1) was trained as an experimental comparison to the forward
LSTM. It uses 32 hidden units per direction (64 combined) over 30 evenly sampled
timesteps, with the same dropout, optimizer, and training procedure.

| Metric | MLP | LSTM | BiLSTM v1 | BiLSTM v2 |
|---|---|---|---|---|---|
| Train accuracy | 96.49% | 87.82% | 95.55% | **98.76%** |
| Validation accuracy | 70.59% | 76.47% | 77.65% | **97.97%** |
| Test accuracy | 69.41% | 69.41% | 71.76% | **98.15%** |
| Test macro F1 | 67.31% | 68.50% | 68.29% | **98.14%** |
| Test weighted F1 | 68.87% | 68.87% | 68.66% | **98.13%** |
| Test loss | — | 1.118 | 0.842 | **0.037** |
| Parameters | 1.1M | 21K | 43K | 43K |
| Dataset samples | 597 | 597 | 597 | **3592** |

BiLSTM v2 achieves the highest test accuracy and lowest test loss of all models
(+26.39% over v1). Dataset expansion from 597 to 3592 samples was the dominant
factor. The BiLSTM v2 TFJS model has been exported to
`models/fsl_alphabet/bilstm_v2_tfjs/` for deployment evaluation.

BiLSTM v1 training: `npm run train:fsl-alphabet:bilstm` (597 samples, 1 signer)
BiLSTM v1 TFJS export: `npm run export:fsl-alphabet:bilstm:tfjs`
BiLSTM v2 training: `npm run train:fsl-alphabet:bilstm:v2` (3592 samples, 6 signers)
BiLSTM v2 TFJS export: `npm run export:fsl-alphabet:bilstm:v2:tfjs`
Multi-signer results: `docs/fsl-alphabet-multisigner-results.md`

### Recommendation
BiLSTM v2 is the best-performing candidate (98.15% test accuracy, 94.96% avg
cross-signer). The model is ready for TFJS deployment and browser integration.
True multi-signer data collection is the next priority for validating real-world
generalization.

## CNN-LSTM Result Summary

Stage 3 CNN-LSTM has been trained and evaluated with
`npm run train:fsl-alphabet:cnn-lstm`. It uses 2 Conv1D layers (32 filters,
kernel=3) followed by MaxPool (pool=2), a forward LSTM (32 units), dropout, and
a dense softmax classifier. All 120 frames are used (no temporal sampling).

| Metric | MLP | LSTM | BiLSTM v1 | CNN-LSTM | BiLSTM v2 |
|---|---|---|---|---|---|---|
| Train accuracy | 96.49% | 87.82% | 95.55% | 74.94% | **98.76%** |
| Validation accuracy | 70.59% | 76.47% | 77.65% | 67.06% | **97.97%** |
| Test accuracy | 69.41% | 69.41% | 71.76% | 61.18% | **98.15%** |
| Test macro F1 | 67.31% | 68.50% | 68.29% | 60.76% | **98.14%** |
| Test weighted F1 | 68.87% | 68.87% | 68.66% | 60.93% | **98.13%** |
| Test loss | — | 1.118 | 0.842 | 1.367 | **0.037** |
| Parameters | 1.1M | 21K | 43K | 24K | 43K |
| Dataset | 597 | 597 | 597 | 597 | **3592** |

**Best accuracy**: BiLSTM v2 (98.15%)
**Best macro F1**: BiLSTM v2 (98.14%)
**Best weighted F1**: BiLSTM v2 (98.13%)
**Best loss**: BiLSTM v2 (0.037)
**Lowest overfitting (train-test gap)**: BiLSTM v2 (0.61%)

### Key Findings

1. CNN-LSTM underperformed all prior models at 61.18% test accuracy.
2. Using full 120-frame sequences (vs 30-frame temporal sampling) may introduce
   frame-to-frame noise that the conv layers cannot effectively filter.
3. The sparse 126-dimensional landmark input may not be well-suited for Conv1D
   feature extraction compared to direct LSTM temporal modeling.
4. BiLSTM remains the best model for potential deployment after evaluation.
5. The small dataset (597 samples) limits the benefit of additional conv
   parameters.

### Next Steps
- **Multi-signer data collection**: record from actual different people to
  validate real-world generalization (virtual signers are synthetic)
- **True multi-signer data collection**: record from actual different people to
  validate real-world generalization (virtual signers are synthetic)
- **Hyperparameter tuning**: BiLSTM hidden size, dropout, learning rate search
  may yield marginal gains
- **CNN-LSTM with temporal sampling**: retry with 30-frame sampling for fair
  comparison against BiLSTM

## Stage 4 BiLSTM v2 Summary

Stage 4 expanded the dataset from 597 to 3592 samples via landmark augmentation
(5 presets → virtual signers S02–S06) and retrained the BiLSTM architecture.

| Metric | BiLSTM v1 (597, 1 signer) | BiLSTM v2 (3592, 6 signers) | Change |
|--------|---------------------------|------------------------------|--------|
| Train accuracy | 95.55% | 98.76% | +3.21% |
| Validation accuracy | 77.65% | 97.97% | +20.32% |
| Test accuracy | 71.76% | 98.15% | +26.39% |
| Test loss | 0.842 | 0.037 | −0.805 |

Cross-signer evaluation (leave-one-signer-out across S01–S06):
- Average accuracy: 94.96%
- Best generalization: S01 original (97.99%), S06 mixed (97.16%)
- Weakest generalization: S05 occlusion (89.65%)

The BiLSTM v2 TFJS model has been exported to `models/fsl_alphabet/bilstm_v2_tfjs/`
for browser deployment. Training command: `npm run train:fsl-alphabet:bilstm:v2`.
TFJS export command: `npm run export:fsl-alphabet:bilstm:v2:tfjs`.
Full multi-signer results: `docs/fsl-alphabet-multisigner-results.md`.

## Risks and Notes
- Dataset has been expanded to 3592 samples with 6 virtual signers
- All augmented data derives from original S01 recordings — not true multi-signer
- Real cross-signer evaluation requires data from actual different people
- ñ and ng remain separate labels
- Labels u and v remain the most confused pair (F1 0.854, 0.886)

## Do Not Do Yet
- Do not integrate a live model into the camera page (wait for integration step)
- Do not train word gestures yet
- Do not add backend/auth/admin
