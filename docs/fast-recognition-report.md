# Fast Recognition Mode — Implementation Report

## Objective
Reduce the time-to-first-prediction (TFP) from ~1300ms to **500–800ms** so users see recognition results within one second of performing a sign.

## Changes

| Component | Before | After | Impact |
|-----------|--------|-------|--------|
| `buffer.ts` — `SEQUENCE_LENGTH` | 120 frames | **60 frames** | Maximum wait drops from 2000ms to 1000ms (at 60fps) |
| `buffer.ts` — `TEMPORAL_STEPS` | 30 | **15** | Fewer downsample steps → faster inference preparation |
| `buffer.ts` — `EARLY_TEMPORAL_STEPS` | — | **8** | First prediction fires after ~267ms (8 frames at 30fps) |
| `smoothing.ts` — `SMOOTHING_WINDOW` | 10 | **5** | Faster majority-vote settling; 5 predictions @100ms = first stable output at ~800ms |
| `smoothing.ts` — minimum votes | 5 | **2** | Allows a confident 2-out-of-5 majority to surface faster |
| `useRecognition.ts` — `INFERENCE_INTERVAL_MS` | 200ms | **100ms** | Inference runs twice as often → smoother real-time feedback |

## Progressive Inference Flow
1. **Early prediction** (8 temporal samples, ~267ms) — lightweight first guess
2. **Full prediction** (15 temporal samples, ~500ms) — full-quality inference
3. **Smoothing window** fills (5 votes × 100ms = 500ms) — stable output by ~800ms
4. **Buffer cap** (60 frames, ~1000ms) — oldest frames discarded; pipeline keeps running

## Validation
- All 7 buffer tests pass: early window returns `8×126`, full window `15×126`, cap at 60 frames.
- All 5 smoothing tests pass: 5-vote window, 2-vote minimum, confidence correctly averaged.
- `useRecognition.ts` passes existing hook tests without logic changes.

## Trade-offs
- **Fewer temporal samples** → marginally lower accuracy on very fast vs. very slow signing. The original 30 samples gave more temporal context; 15 still captures ~500ms of hand motion.
- **Smaller smoothing window** → slightly more flicker between top predictions. Mitigated by 2-vote minimum.
- **Faster inference interval** → higher CPU/GPU usage (10 inferences/sec vs 5). Acceptable on modern devices.

## Recommendation
If flutter/jitter is observed with the 2-vote minimum, increase to `MINIMUM_VOTES = 3` (still faster than the original 5).
