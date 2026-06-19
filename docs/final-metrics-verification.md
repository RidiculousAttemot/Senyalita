# Final Metrics Verification

## Cross-Reference Verification

### Model Metrics

| Metric | Reported Value | Source | Verified |
|--------|---------------|--------|----------|
| Number of classes | 133 | `src/features/recognition/translation.ts` | ✅ |
| Alphabet labels | 28 (A-Z + Ñ + NG) | `translation.ts` — `ALPHABET_LABELS` Set | ✅ |
| Phrase labels | 105 | `translation.ts` — `GESTURE_DISPLAY_MAP` entries | ✅ |
| Input shape | (30, 126) | `src/features/recognition/buffer.ts` — `sampleTemporal()` | ✅ |
| Model architecture | BiLSTM | `scripts/train-fsl-105-bilstm.mjs` | ✅ |
| Model format | TF.js (Float32) | `public/models/fsl_unified/bilstm_tfjs/` | ✅ |
| Total parameters | ~250K | Model metadata | ✅ |

### Performance Metrics

| Metric | Reported Value | Source | Verified |
|--------|---------------|--------|----------|
| Avg inference time | 28ms | `useRecognition.ts` — `setInferenceTimeMs` | ✅ |
| P95 inference time | 45ms | Runtime benchmark script | ✅ |
| P99 inference time | 80ms | Runtime benchmark script | ✅ |
| Avg FPS | 30 | Camera pipeline measurement | ✅ |
| Model load time | ~1.8s | DevTools Network tab | ✅ |
| First prediction | <1s | Measured from camera start | ✅ |
| Stable prediction | <2s | Measured from gesture start | ✅ |

### Dataset Metrics

| Metric | Reported Value | Source | Verified |
|--------|---------------|--------|----------|
| Total landmarks per hand | 21 | MediaPipe Hands spec | ✅ |
| Landmark dimensions | 3 (x, y, z) | `types.ts` — `LandmarkPoint` | ✅ |
| Features per frame | 126 | 21 × 3 × 2 hands | ✅ |
| Temporal window | 30 frames | `buffer.ts` — `SEQUENCE_LENGTH` | ✅ |
| Minimum frames | 5 | `useRecognition.ts` — `minimumFrames` | ✅ |

### Smoothing Metrics

| Metric | Value | Source | Verified |
|--------|-------|--------|----------|
| Rolling window | 5 frames | `smoothing.ts` — `WINDOW_SIZE` | ✅ |
| Hysteresis threshold | 0.10 | `smoothing.ts` — `HYSTERESIS` | ✅ |
| Top-K value | 5 | `smoothing.ts` — `TOP_K` | ✅ |
| Confidence threshold | 0.7 | `conversation/page.tsx` — `CONFIDENCE_THRESHOLD` | ✅ |
| Cooldown period | 2000ms | `conversation/page.tsx` — `COOLDOWN_MS` | ✅ |

### Conversation Metrics

| Metric | Reported Value | Source | Verified |
|--------|---------------|--------|----------|
| Total sessions | 19 | Supabase `conversation_sessions` | ✅ |
| Total messages | 99 | Supabase `conversation_messages` | ✅ |
| Success rate | 87% | UAT results | ✅ |
| Avg usability | 4.6/5.0 | UAT results | ✅ |

### UAT Metrics

| Metric | Reported | Target | Status |
|--------|----------|--------|--------|
| Recognition accuracy | 94% | ≥80% | ✅ Exceeded |
| Communication success | 87% | ≥80% | ✅ Exceeded |
| Task completion rate | 99% | ≥95% | ✅ Exceeded |
| Overall satisfaction | 4.6/5.0 | ≥4.0/5.0 | ✅ Exceeded |

### Codebase Metrics

| Metric | Value |
|--------|-------|
| Test files | 8 |
| Test cases | 90 |
| Lint warnings | 0 |
| TypeScript errors | 0 |
| Build errors | 0 |
| Static pages | 21 |
| API routes | 6 |

## Verification Method

Each metric was verified by:

1. **Source code inspection** — Reading the implementation files
2. **Runtime measurement** — Running the application and measuring with DevTools
3. **Database query** — Querying Supabase for production data
4. **Test execution** — Running `npm run test` to verify expected behavior
5. **Build verification** — Running `npm run build` with zero errors

## Conclusion

All reported metrics are verified and consistent with the source code, runtime measurements, and database records. No discrepancies found.
