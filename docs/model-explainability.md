# Model Explainability

## Overview

The recognition explainability panel provides real-time transparency into model predictions. It shows the internal state of each pipeline stage, enabling debugging and user education.

## Explainability Panel

### Access

Enable with `?explain=1` query parameter on the camera or conversation page. The panel appears as an overlay at the bottom-left of the camera feed.

### Displayed Information

| Field | Source | Description |
|-------|--------|-------------|
| **Top 5 predictions** | `infer()` output | Raw model logits sorted by confidence |
| **Smoothed** | `PredictionSmoother.smooth()` | Final label after rolling window + hysteresis |
| **Gesture phase** | `MotionDetector.getPhase()` | none / start / hold / end |
| **Motion score** | `MotionDetector.getMotion()` | Average landmark displacement |
| **Buffer fill** | `SequenceBuffer.length()` | Current frame count (0–30) |
| **Inference time** | `performance.now()` diff | TF.js forward pass duration |
| **Confidence** | `PredictionSmoother` output | Final confidence after smoothing |
| **Priority override** | `RecognitionPriorityManager` | If phrase/alphabet priority switched the prediction |

### Implementation

```tsx
<ExplainabilityPanel
  show={showExplain}
  topPredictions={rawPredictions}
  smoothedLabel={currentLabel}
  gesturePhase={phase}
  motionScore={motion}
  bufferLength={bufferLen}
  inferenceTimeMs={inferenceMs}
  confidence={confidence}
  priorityOverride={lastOverride}
/>
```

## Pipeline Walkthrough

### Stage 1 — Landmark Extraction
MediaPipe Hands produces 21 landmarks × 3 coords × 2 hands = 126 features per frame.

### Stage 2 — Buffer Accumulation
`SequenceBuffer.append()` stores normalized landmarks. Buffer fills to 30 frames for full inference (min 8 with `adaptiveSample()`).

### Stage 3 — Temporal Sampling
`sampleTemporal()` or `adaptiveSample()` resamples the frame sequence to a fixed 30-timestep tensor of shape `[1, 30, 126]`.

### Stage 4 — Model Inference
The BiLSTM model processes the tensor through:
- Bidirectional LSTM (32 units)
- Dropout (0.2)
- Dense layer (133 units + softmax)

Output: probability distribution over 133 classes.

### Stage 5 — Smoothing
`PredictionSmoother` maintains a rolling window of top-5 predictions. Hysteresis (0.10 threshold) prevents flicker between near-equal classes.

### Stage 6 — Priority Resolution
`RecognitionPriorityManager` checks the smoothed prediction:
- If motion active + phrase in top-K with >0.2 confidence → prefer phrase
- If motion idle + phrase at <0.75 confidence → check alphabet

### Stage 7 — Output
Final prediction displayed to user. Telemetry event logged.

## Model Architecture

```
Input: [1, 30, 126]
  ↓
Bidirectional LSTM (32 units, return_sequences=false)
  ↓
Dropout 0.2
  ↓
Dense 133 + Softmax
  ↓
Output: [1, 133] — probability per class
```

## Confidence Interpretation

| Range | Meaning | Action |
|-------|---------|--------|
| ≥0.85 | High confidence | Used for auto-append |
| 0.70–0.84 | Moderate | Displayed but not auto-appended |
| 0.50–0.69 | Low | Requires user confirmation |
| <0.50 | Very low | Considered noise; queued for review |
