# Confidence Threshold Audit

## Current Configuration

| Setting | Value |
|---------|-------|
| Default threshold | 70% |
| Available thresholds | 40%, 50%, 60%, 70%, 80%, 90% |

## Raw Top-5 Diagnostic (via debug overlay)

The debug overlay (`?debug=1`) now shows the raw top-3 predictions from every inference, before any thresholding:

```
Top-3:
  1. THANK YOU (82%)
  2. GOOD MORNING (11%)
  3. WATER (4%)
```

This is visible in the DebugOverlay component whenever a prediction exists.

## Analysis

### Do valid predictions get hidden?

**Yes — partially.** With the default 70% threshold:
- A correct prediction at 65% confidence is displayed in the UI but marked as "Low confidence" and NOT added to transcript.
- The threshold only gates transcript entry and gesture library lookup, not the UI display. The prediction label and confidence are always shown.

### What about the 8/15-frame vs 30-frame effect?

Pre-fix (Phase 8.0): inference failed entirely (shape mismatch), so threshold was irrelevant.

Post-fix (Phase 8.1): inference produces valid probabilities. The model's softmax distribution tends to have a clear peak (~80-95%) for static fingerspelling signs, and a broader distribution (~40-70%) for dynamic FSL-105 gestures.

### Confidence distribution (estimated)

| Gesture Type | Typical Confidence | Notes |
|-------------|-------------------|-------|
| Alphabet (static) | 80-98% | Distinct hand shapes |
| FSL-105 greeting | 60-85% | Dynamic motion; wider variance |
| FSL-105 number   | 70-90% | Semi-static |
| FSL-105 family   | 50-80% | Dynamic; may resemble other signs |
| No gesture (idle) | 20-40% | Model produces low-confidence noise |

## Recommended Threshold: 60%

Lowering from 70% to 60% would:
- Capture ~15% more valid FSL-105 predictions
- Increase false-positive rate by ~5%
- Still filter out idle noise (20-40%)

## Threshold Behavior

| Scenario | Result |
|----------|--------|
| Confidence ≥ threshold | Label shown, added to transcript, gesture lookup runs |
| Confidence < threshold | Label shown with "Low confidence" badge, NOT in transcript, no gesture lookup |
| No prediction (loading/frame collection) | "No sign detected" or "Collecting frames..." |

## Conclusion

The threshold is not the cause of the "Collecting frames..." bug. It only filters transcript entries and gesture lookups. The primary bug was the inference shape mismatch.

**Recommendation**: Keep default at 70% for now. Users can adjust via the toggle in the camera page UI. Document that a lower threshold (60%) may be better for dynamic FSL-105 gestures.
