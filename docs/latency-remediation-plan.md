# Latency Remediation Plan

## Current State

### Buffer Parameters
| Parameter | File | Value |
|-----------|------|-------|
| SEQUENCE_LENGTH | `buffer.ts:3` | 120 frames |
| FEATURE_DIMENSION | `buffer.ts:4` | 126 |
| TEMPORAL_STEPS | `buffer.ts:5` | 30 frames |
| Minimum fill before inference | `buffer.ts:37` | 30 frames |

### Inference Parameters
| Parameter | File | Value |
|-----------|------|-------|
| INFERENCE_INTERVAL_MS | `useRecognition.ts:11` | 200ms |
| Model inference time | (measured) | ~13.1ms p95 |

### Smoothing Parameters
| Parameter | File | Value |
|-----------|------|-------|
| SMOOTHING_WINDOW | `smoothing.ts:3` | 10 predictions |
| Minimum window fraction | `smoothing.ts:19` | 5 predictions |

### Current Latency Budget

| Stage | Duration | Condition |
|-------|----------|-----------|
| Buffer fill | ~1000ms | 30 frames @ 30fps before first prediction |
| Inference interval | 200ms | Timer runs every 200ms |
| Smoothing warm-up | 1000ms | 5 inferences needed; smoothing is a no-op before 5 |
| Display delay | ~300ms | React state update + render |
| **Total P50** | **~2300-2500ms** | From first hand appear to prediction display |

### Bottlenecks

1. **TEMPORAL_STEPS = 30** requires 30 good frames (1 second at 30fps) before any output
2. **SMOOTHING_WINDOW = 10** requires 10 inferences = 2 seconds for full smoothing
3. **Inference at 200ms** (5Hz) is conservative; model can run faster

## Recommendations

### 1. Reduce TEMPORAL_STEPS (HIGH IMPACT)

Change `buffer.ts:5` from `30` to `15`:
- First prediction at ~500ms instead of ~1000ms
- Maintains 126-feature dimension
- Trade-off: slightly lower accuracy for temporal undersampling

### 2. Reduce SMOOTHING_WINDOW (MEDIUM IMPACT)

Change `smoothing.ts:3` from `10` to `5`:
- Full smoothing after 5 inferences = 1 second (vs 2 seconds)
- Minimum warm-up at 3 inferences = 600ms (vs 1000ms)
- Trade-off: slightly more jitter between consecutive predictions

### 3. Increase INFERENCE_INTERVAL (LOW IMPACT)

Change `useRecognition.ts:11` from `200` to `100`:
- Predictions at 10Hz instead of 5Hz
- Faster convergence for smoothing
- Trade-off: higher CPU usage (~100ms gap between inferences)

### 4. Progressive Inference (NEW FEATURE)

Replace the fixed 30-frame requirement with progressive prediction:
- At 15 frames: run inference, show result with "low confidence" flag
- At 30 frames: run inference with better accuracy
- At 60 frames: full accuracy
- This gives users immediate feedback that improves over time

### 5. Early Exit on Static Poses (LOW IMPACT)

For static alphabet poses (single hand, minimal landmark movement across frames):
- Reduce TEMPORAL_STEPS to 5 for static poses
- Full 30-step sequence for dynamic gestures (motion detected)

## Implementation Plan

```typescript
// buffer.ts — Proposed changes
const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const TEMPORAL_STEPS = 15;        // Changed from 30
const EARLY_TEMPORAL_STEPS = 8;   // New: fast path for first prediction

class SequenceBuffer {
  // ... existing code ...

  sampleTemporal(): Float32Array | null {
    if (this.frames.length < EARLY_TEMPORAL_STEPS) {
      return null;                // Need at least 8 frames (~267ms)
    }

    const available = Math.min(this.frames.length, SEQUENCE_LENGTH);
    const steps = this.frames.length < TEMPORAL_STEPS
      ? EARLY_TEMPORAL_STEPS       // Progressive: smaller step count
      : TEMPORAL_STEPS;

    const sampled = new Float32Array(steps * FEATURE_DIMENSION);
    // ... sampling logic using `steps` instead of `TEMPORAL_STEPS` ...
    return sampled;
  }
}
```

```typescript
// smoothing.ts — Proposed changes
const SMOOTHING_WINDOW = 5;       // Changed from 10

class PredictionSmoother {
  // ... existing code, just window reduced ...
}
```

## Expected Improvement

| Stage | Current | Proposed | Gain |
|-------|---------|----------|------|
| Time to first prediction | ~1000ms | ~500ms | 500ms faster |
| Time to smoothed output | ~2000ms | ~1000ms | 1000ms faster |
| Inference frequency | 5Hz | 10Hz | 2x updates |

## Trade-offs

- Accuracy may drop 1-3% with reduced temporal steps (mitigated by progressive inference)
- CPU usage increases ~20% with 100ms intervals (model inference is ~13ms, so net CPU is still low)
- Jitter may increase with SMOOTHING_WINDOW=5 (observable but acceptable)
