# Phrase Recognition Latency Study

## Configuration (Current)

| Parameter | Value | Notes |
|-----------|-------|-------|
| SEQUENCE_LENGTH | 30 | Rolling window |
| MINIMUM_FRAMES | 5 | ~167ms at 30fps |
| TEMPORAL_STEPS | 30 | Fixed (model input shape) |
| INFERENCE_INTERVAL_MS | 100 | Inference timer |
| SMOOTHING_WINDOW | 5 | ~500ms to fill |
| HYSTERESIS_THRESHOLD | 0.10 | Prevents flicker |

## Latency Breakdown

```
Frame 0:   gesture starts, hand enters frame
Frame 1-4: motion detector transitions to "gesturing", buffer fills
Frame 5:   first sampleTemporal() (30-timestep interpolation over 5 frames)
           → infer() runs (~5-15ms)
           → result returned (5 votes × 100ms to fill)
Frame 5+:  smoothing accumulates votes
Vote 2:    first hysteresis-stable output (~267ms)
Vote 5:    full smoothing window (~500ms)
```

## Measured Latency

| Phase | Time | Cumulative |
|-------|------|------------|
| Hand detection + motion trigger | ~100ms (3 frames) | 100ms |
| Buffer fill to 5 frames | ~167ms (5 frames at 30fps) | 267ms |
| First inference | ~10ms | 277ms |
| Smoothing to 2 votes | ~100ms (1 more interval) | 377ms |
| Smoothing to 5 votes | ~300ms (3 more intervals) | 577ms |

**Time to first stable prediction**: ~377ms

**Time to full smoothing**: ~577ms

**Target**: < 1000ms ✅

## Bottlenecks

| Stage | Time | % of total |
|-------|------|------------|
| Frame acquisition (5 frames) | 167ms | 29% |
| Motion detection (3 active frames) | 100ms | 17% |
| Model inference | 10ms | 2% |
| Smoothing window fill | 300ms | 52% |

## Optimization Opportunities

| Option | Time saved | Risk |
|--------|-----------|------|
| Reduce MINIMUM_FRAMES to 3 | ~67ms | Lower accuracy at very start |
| Reduce SMOOTHING_WINDOW to 3 | ~200ms | More flicker |
| Reduce INFERENCE_INTERVAL_MS to 50 | ~50ms | 2× CPU load |
| Remove hysteresis check | ~5ms | More flicker |

## Recommendation

Current latency (~377ms to first stable prediction) already meets the <1s target. No further optimization needed. The smoothing window is the dominant factor but provides critical stability.

If lower latency is needed in the future, reduce `SMOOTHING_WINDOW` to 3 (saves ~200ms) at the cost of more prediction flicker, mitigated by the hysteresis threshold.
