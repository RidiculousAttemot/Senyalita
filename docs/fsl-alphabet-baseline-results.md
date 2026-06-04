# FSL Alphabet Baseline Results

This document records the first baseline model result for FSL alphabet
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
- Flattened baseline input size: 15,120

## Model Summary
- Model type: baseline flattened MLP
- Input: each [120, 126] sequence flattened into one vector
- Hidden layers: [32]
- Activation: ReLU
- Output activation: softmax
- Optimizer: Adam
- Learning rate: 0.001
- Epochs completed: 24
- Early stopping patience: 8
- Random seed: 1337
- Output path: `models/fsl_alphabet/baseline/`

## Results
- Train accuracy: 96.49%
- Validation accuracy: 70.59%
- Test accuracy: 69.41%
- Test macro F1: 67.31%
- Test weighted F1: 67.70%
- Test loss: 2.0631

## Interpretation
The baseline proves that the processed dataset, label mapping, training loop,
evaluation flow, and output saving pipeline work end-to-end. This completes the
first model pipeline check for alphabet recognition.

The result is not yet thesis-ready for final recognition quality. The gap
between train accuracy (96.49%) and validation/test accuracy (70.59% / 69.41%)
suggests overfitting. This is expected for a small baseline MLP because it sees
the flattened landmarks as one large vector and does not model temporal
structure directly.

More signer, device, lighting, camera angle, and background variation may be
needed later to improve real-world robustness. These results should be treated
as an early alphabet-only baseline, not as evidence of word gesture recognition.

## Error Analysis
The saved `metrics.json` includes per-label metrics and confusion matrices for
the train, validation, and test splits. The test split has only 3 samples for
most labels and 4 samples for `w`, so per-label findings are useful but still
small-sample estimates.

Weakest test labels by F1:
- `e`: F1 0.00, precision 0.00, recall 0.00, support 3
- `t`: F1 0.00, precision 0.00, recall 0.00, support 3
- `x`: F1 0.00, precision 0.00, recall 0.00, support 3
- `a`: F1 0.40, precision 0.50, recall 0.33, support 3
- `b`, `c`, `ng`, and `s`: F1 0.50, recall 0.33, support 3 each
- `f`: F1 0.50, precision 0.40, recall 0.67, support 3

Most confused test label pairs:
- Actual `t` predicted as `x`: 3 samples
- Actual `a` predicted as `g`: 1 sample
- Actual `a` predicted as `i`: 1 sample
- Actual `b` predicted as `f`: 1 sample
- Actual `b` predicted as `t`: 1 sample
- Actual `c` predicted as `f`: 1 sample
- Actual `c` predicted as `x`: 1 sample
- Actual `e` predicted as `f`, `l`, or `z`: 1 sample each
- Actual `ng` predicted as `a` or `j`: 1 sample each

The strongest repeated confusion is `t -> x`, where all three test samples for
`t` were classified as `x`. The other listed confusions are single-sample errors,
so they should be revisited after a larger or more varied evaluation set exists.

## Stage Status
Stage 1 baseline is complete. The recommended next modeling step is Stage 2:
train an LSTM or BiLSTM sequence model that uses the [120, 126] landmark
sequence directly instead of flattening the temporal dimension.
