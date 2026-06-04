# FSL Alphabet LSTM Results

This document records the Stage 2 sequence model result for FSL alphabet
recognition only. It does not cover word gesture recognition, live camera
inference, TensorFlow.js export, backend services, or deployment.

## Dataset Summary
- Dataset: processed FSL alphabet landmarks
- Source path: `datasets/processed/fsl_alphabet/`
- Labels: a-z, ñ, ng
- Output classes: 28
- Total samples: 597
- Split strategy: stratified by label
- Train samples: 427
- Validation samples: 85
- Test samples: 85
- Input shape per sample: [120, 126]

## Model Architecture
- Model type: Stage 2 LSTM sequence classifier
- Training command: `npm run train:fsl-alphabet:lstm`
- Output path: `models/fsl_alphabet/lstm/`
- Recurrent layer: forward LSTM
- Hidden size: 32
- Temporal steps used: 30 sampled frames from the 120-frame input sequence
- Dropout: 0.2 on the final LSTM representation before classification
- Classifier: dense softmax layer
- Output classes: 28

The model consumes the sequence structure directly instead of flattening the
full [120, 126] sample into one vector. For lightweight training and future
deployment planning, it samples 30 evenly spaced frames from each 120-frame
sequence before the LSTM layer.

## Training Configuration
- Runtime: Node.js self-contained training script
- Script: `scripts/train-fsl-alphabet-lstm.mjs`
- Optimizer: Adam
- Learning rate: 0.002
- Epochs requested: 45
- Epochs completed: 45
- Early stopping patience: 10
- Gradient clip value: 1
- Random seed: 2026

## Results
- Train accuracy: 87.82%
- Validation accuracy: 76.47%
- Test accuracy: 69.41%
- Test loss: 1.1179
- Test macro F1: 68.50%
- Test weighted F1: 68.87%

## Baseline Comparison
Compared with the flattened MLP baseline:
- Train accuracy decreased from 96.49% to 87.82%
- Validation accuracy increased from 70.59% to 76.47%
- Test accuracy stayed the same at 69.41%
- Test macro F1 increased from 67.31% to 68.50%
- Test weighted F1 increased from 67.70% to 68.87%
- Test loss decreased from 2.0631 to 1.1179

The LSTM appears less overfit than the baseline because train accuracy is lower
while validation accuracy is higher. Test accuracy did not improve, but test F1
and test loss improved slightly. With only 85 test samples and about 3 samples
per label, small per-label changes should be interpreted carefully.

## Error Analysis
The saved `metrics.json` includes per-label metrics and confusion matrices. The
test split remains small, so the following observations are useful as a guide
but not yet a stable estimate of real-world performance.

Weakest test labels by F1:
- `e`: F1 0.00, precision 0.00, recall 0.00, support 3
- `z`: F1 0.00, precision 0.00, recall 0.00, support 3
- `m`: F1 0.33, precision 0.33, recall 0.33, support 3
- `a`: F1 0.40, precision 0.50, recall 0.33, support 3
- `s`: F1 0.40, precision 0.50, recall 0.33, support 3
- `b` and `ñ`: F1 0.50, recall 0.33, support 3 each

Most confused test label pairs:
- Actual `e` predicted as `m`: 2 samples
- Actual `ñ` predicted as `l`: 2 samples
- Actual `z` predicted as `l`: 2 samples
- Actual `a` predicted as `s`: 1 sample
- Actual `a` predicted as `t`: 1 sample
- Actual `b` predicted as `e`: 1 sample
- Actual `b` predicted as `f`: 1 sample
- Actual `c` predicted as `d`: 1 sample
- Actual `ng` predicted as `d`: 1 sample

The baseline's strongest repeated confusion was `t -> x`. The LSTM no longer
shows that repeated `t -> x` pattern, but it introduces repeated errors for
`e -> m`, `ñ -> l`, and `z -> l`. This suggests that the sequence model changes
the error profile, but the current dataset is still too small to conclude that
the remaining weak labels are stable failure cases.

## Interpretation
Stage 2 confirms that a sequence model can be trained end-to-end on the
processed FSL alphabet dataset without flattening the temporal dimension. The
LSTM improves validation accuracy, test loss, macro F1, and weighted F1 compared
with the baseline, but it does not improve test accuracy.

This result is still not thesis-ready for final recognition quality. More
signer, device, lighting, camera angle, and background variation may be needed
later. Additional Stage 2 tuning, such as a BiLSTM variant, larger evaluation
set, or adjusted temporal sampling, should be considered before moving to the
future CNN-LSTM stage.

## Stage Status
Stage 2 LSTM training is complete as the first sequence-model experiment. The
recommended next step is to compare this result with a similarly lightweight
BiLSTM or tuned LSTM configuration while keeping the work alphabet-only. CNN-LSTM
should remain a future Stage 3 option.
