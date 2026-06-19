# Recognition Pipeline Audit

## Pipeline Flow

```
Camera (640×480, ~30fps)
  → MediaPipe Hands (max 2 hands, 0.6 confidence)
    → normalizeLandmarks (126-d feature vector per frame)
      → SequenceBuffer.append (FIFO, capped at 30 frames)
        → sampleTemporal (30-timestep interpolation, output 30×126)
          → TF.js model.predict ([1, 30, 126] → [1, 133] softmax)
            → label argmax + top-3
              → translateResult (label → human-readable)
                → PredictionSmoother.smooth (5-vote window)
                  → setState → UI render
                    → lookupGesture (gesture info + replies)
```

## Per-Stage Audit

### 1. Camera → MediaPipe Hands

| Property | Value |
|----------|-------|
| Input | 640×480 video stream |
| Library | `@mediapipe/hands` |
| Max hands | 2 |
| Model complexity | 1 |
| Min detection confidence | 0.6 |
| Min tracking confidence | 0.6 |
| Output frequency | ~30 fps |
| Failure conditions | No camera, permission denied, GPU unavailable |

**Status**: OK.

### 2. MediaPipe → Landmark Normalization

| Property | Value |
|----------|-------|
| Source | `src/features/recognition/normalize.ts` |
| Input | 21 MediaPipe landmarks per hand (x, y, z) |
| Output | 126-d Float32Array (42 per hand × 2 hands) |
| Update frequency | Same as MediaPipe (~30 fps) |
| Failure conditions | null hands → zero-filled output |

**Status**: OK.

### 3. Normalized Landmarks → Sequence Buffer

| Property | Value |
|----------|-------|
| Source | `src/features/recognition/buffer.ts` — `SequenceBuffer` |
| Input | 126-d Float32Array |
| Output | 30 × 126 Float32Array (temporally sampled) |
| Buffer cap | 30 frames |
| Minimum frames | 5 |
| Sampling | Uniform linear interpolation across available range |
| Sampling output shape | Always 30 × 126 = 3780 elements |
| Failure conditions | < 5 frames → returns null (skip inference tick) |

**BEFORE FIX**: Buffer sampled 8 or 15 timesteps. `infer()` expected 30. **Shape mismatch → silent failure → stuck at "Collecting frames..."**

**AFTER FIX**: Buffer always samples 30 timesteps via interpolation. Matches model input shape.

**Status**: FIXED.

### 4. Temporal Sample → TF.js Model

| Property | Value |
|----------|-------|
| Source | `src/features/recognition/model/loader.ts` — `infer()` |
| Model path | `/models/fsl_unified/bilstm_tfjs/model.json` |
| Input shape | `[1, 30, 126]` (batch, timesteps, features) |
| Output shape | `[1, 133]` (softmax over 133 classes) |
| Architecture | Bidirectional LSTM (32 units) → Dropout 0.2 → Dense 133 + softmax |
| Warmup | `tf.zeros([1, 30, 126])` → 1 predict call |
| Inference time | ~5–15ms (measured on laptop GPU) |
| Update frequency | Every 100ms (interval) |
| Failure conditions | Model not loaded, tensor shape mismatch (now fixed), OOM |

**BEFORE FIX**: `tf.tensor3d(features, [1, 30, 126])` hardcoded to 30 timesteps regardless of actual features length.

**AFTER FIX**: `features.length / 126` computed dynamically.

**Status**: FIXED.

### 5. Softmax → Smoothing

| Property | Value |
|----------|-------|
| Source | `src/features/recognition/smoothing.ts` — `PredictionSmoother` |
| Window | 5 votes |
| Minimum votes | 2 |
| Logic | Majority-vote with confidence averaging |
| topK | Counts per label across window, sorted |
| Failure conditions | < 2 votes → passthrough |

**Status**: OK.

### 6. Smoothing → Translation

| Property | Value |
|----------|-------|
| Source | `src/features/recognition/translation.ts` |
| Map size | 133 entries (all model labels) |
| Format | Title-case human-readable |
| Failure conditions | Unmapped label → passthrough (label unchanged) |

**Status**: OK.

### 7. Translation → UI

| Property | Value |
|----------|-------|
| Render | React state → camera page |
| Threshold gate | Confidence ≥ threshold (default 70%) → transcript + gesture lookup |
| Threshold config | Toggle buttons: 40%–90% |
| Gesture lookup | `lookupGesture(label)` → gesture info + replies + video |
| Failure conditions | No matching gesture → "No library entry" message |

**Status**: OK.

## Summary

| Stage | Pre-Fix | Post-Fix |
|-------|---------|----------|
| Camera init | OK | OK |
| MediaPipe pipeline | OK | OK |
| Landmark normalization | OK | OK |
| Frame buffer | 8/15 timestep output | Always 30 timesteps |
| Buffer → tensor shape | **MISMATCH** (1008/1890 vs 3780) | MATCH (always 3780) |
| Inference | **SILENT FAILURE** (caught exception) | Runs correctly |
| Smoothing | OK | OK |
| Translation | OK | OK |
| UI render | Stuck at "Collecting frames..." | Predictions displayed |

## Root Cause

Phase 8 reduced `TEMPORARY_STEPS` from 30 to 15 / 8 to improve latency, but the deployed model's input layer expects exactly 30 timesteps (`batch_input_shape: [null, 30, 126]`). The `infer()` function in `loader.ts` hardcoded `tf.tensor3d(features, [1, 30, 126])` which threw a size-mismatch error for the shorter feature arrays. The error was caught and `null` returned, so `useRecognition` never received a prediction, keeping the stage at `"predicting"` with no result — which the UI renders as "Collecting frames...".

## Files Changed

- `src/features/recognition/buffer.ts` — `SEQUENCE_LENGTH` 60→30, `TEMPORAL_STEPS` 15→30, removed `EARLY_TEMPORAL_STEPS` split, always output 30 timesteps via interpolation
- `src/features/recognition/model/loader.ts` — Dynamic `timesteps` derived from `features.length / 126` instead of hardcoded `30`
- `src/features/recognition/useRecognition.ts` — Exposed `bufferLength`, `bufferCap`, `minimumFrames`, `inferenceTimeMs` for diagnostics
- `src/features/recognition/DebugOverlay.tsx` — New component showing all pipeline metrics
- `src/features/recognition/__tests__/buffer.test.ts` — Updated for new parameters (5 minimum, 30 cap, 30 timesteps)
