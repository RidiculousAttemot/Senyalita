# Category Confusion Analysis

## Test Protocol

For each alphabet letter (A–E), hold the sign and observe whether any FSL-105 phrase gestures appear in the top-3 predictions.

For each phrase gesture (Thank You, Good Morning, How Are You), perform the sign and observe whether any alphabet letters appear in the top-3.

## Alphabet → Phrase Confusion

| Gesture | Top-1 | Top-2 | Top-3 | Phrase in top-3? | False positive? |
|---------|-------|-------|-------|------------------|-----------------|
| A | | | | | |
| B | | | | | |
| C | | | | | |
| D | | | | | |
| E | | | | | |

## Phrase → Alphabet Confusion

| Gesture | Top-1 | Top-2 | Top-3 | Letter in top-3? | False positive? |
|---------|-------|-------|-------|------------------|-----------------|
| Thank You | | | | | |
| Good Morning | | | | | |
| How Are You | | | | | |
| Juice | | | | | |
| Father | | | | | |

## Expected Confusion Matches

Based on hand shape similarity:

| Alphabet | Possibly Confused With | Reason |
|----------|----------------------|--------|
| A (fist) | No obvious phrase match | Closed fist is distinct |
| B (flat palm) | — | Flat palm, fingers together |
| C (curved hand) | — | Curved shape is distinct |
| D (index up) | ONE (index up) | **Potential confusion** — D and ONE both use raised index finger |
| E (bent fingers) | — | Distinct bent-finger shape |

## Mitigations

1. **Category gating**: Alphabet predictions never trigger reply suggestions or gesture lookup, reducing the impact of false phrase classifications.
2. **Smoothing**: The 5-vote window prevents single-frame noise from being reported as a stable prediction.
3. **Confidence threshold**: Alphabet predictions typically have very high confidence (>90%), while phrase-level false positives from alphabet signs tend to be low-confidence (<40%).
4. **Top-3 visibility**: The debug overlay always shows all top-3 predictions, allowing developers to spot confusion patterns.

## Known Apostrophe Issue

Two labels use Unicode RIGHT SINGLE QUOTATION MARK (`'`) in the model:
- `DON\u2019T UNDERSTAND`
- `DON\u2019T KNOW`

If the translation map or gesture DB uses ASCII apostrophe (`'`), the label will not match. `translateLabel` falls back to the raw label, and `lookupGesture` may return null. Verify model output matches DB entries.
