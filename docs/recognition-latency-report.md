# Recognition Latency Report

## Measurement Method

Latency measured as: time from first frame appended to buffer → prediction displayed in UI.

Measured using the debug overlay (`?debug=1`):
- `Buffer: 5 / 30 (17%)` → first inference fires
- `Inference time: Xms` → model execution
- Smoothing window fills at 5 × 100ms = 500ms after first inference

## Current Configuration (Post-Fix)

| Parameter | Value | Latency Contribution |
|-----------|-------|---------------------|
| `MINIMUM_FRAMES` | 5 | ~167ms (at 30fps) |
| `SEQUENCE_LENGTH` | 30 | ~1000ms queue (rolling window) |
| `TEMPORAL_STEPS` | 30 | Fixed (model requirement) |
| `INFERENCE_INTERVAL_MS` | 100ms | Up to 100ms jitter |
| `SMOOTHING_WINDOW` | 5 votes | ~500ms after first inference |
| `MINIMUM_VOTES` | 2 | First stable output at vote 2 |

## Latency Breakdown

```
Frame 0:  gesture starts
Frame 5:  first buffer sample (167ms)
          → infer() runs (5-15ms)
          → result returned immediately
Frame 5+: smoothing accumulates votes
Vote 2:   first smoothed output (~267ms cumulative)
Vote 5:   full smoothing window (~500ms cumulative)
```

**Estimated time-to-first-prediction**: **~267ms** (5 frames × 33ms + 1 inference × 15ms + 1 interval × 100ms)

## Bottleneck Analysis

| Stage | Time | Notes |
|-------|------|-------|
| Frame acquisition | ~167ms (5 frames) | Minimum threshold; could be lower |
| Temporal sampling | <1ms | Negligible |
| Model inference | 5–15ms | Fast; model is small (BiLSTM 32u) |
| Smoothing | <1ms | Negligible |
| Translation | <1ms | Negligible |
| UI render | ~16ms | One frame at 60fps |

**Dominant factor**: **Frame collection** (waiting for 5 frames at 30fps).

## Latency Reduction Options

| Option | Impact | Risk |
|--------|--------|------|
| Reduce `MINIMUM_FRAMES` to 3 | Saves ~67ms | Less temporal context; lower accuracy on dynamic signs |
| Increase MediaPipe FPS (reduce resolution) | More frames/second | Higher GPU load |
| Remove smoothing minimum (always smooth) | Removes ~167ms | More flicker between predictions |
| Reduce `INFERENCE_INTERVAL_MS` to 50ms | Reduces jitter to 50ms | 2× more inferences/sec |

**Recommendation**: Keep current parameters. 267ms TFP is well under the 1-second target.

## Summary

| Metric | Pre-Fix | Post-Fix |
|--------|---------|----------|
| Pipeline functional? | NO (stuck) | YES |
| Time-to-first-prediction | Never | ~267ms |
| Stable prediction | Never | ~500ms |
| Inference time | Error | ~5-15ms |
