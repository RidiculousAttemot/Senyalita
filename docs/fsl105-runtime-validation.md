# FSL-105 Runtime Validation

## How to Run

1. `npm run dev`
2. Open `http://localhost:3000/camera?debug=1`
3. Allow camera access
4. Wait for model to load (observe "Loading model..." → "Predicting")
5. Perform each gesture and note the result

## Validation Table

Fill in the following for each gesture:

| # | Gesture | Model Label | Confidence | Top-3 Predictions | `lookupGesture()` | Replies | Video | PASS/FAIL |
|---|---------|------------|-----------|-------------------|-------------------|---------|-------|-----------|
| 1 | Thank You | `THANK YOU` | | | | | | |
| 2 | Good Morning | `GOOD MORNING` | | | | | | |
| 3 | Family | `FAMILY` → *not in model* — closest is `FATHER` / `MOTHER` | | | | | | |
| 4 | Water | *not in model* — closest is `JUICE` / `MILK` / `COFFEE` | | | | | | |
| 5 | How Are You | `HOW ARE YOU` | | | | | | |

> **Note**: `family` and `water` are not in the model's 133 labels. Use `FATHER`, `MOTHER`, or `JUICE`/`MILK`/`COFFEE` instead.

## Diagnostic Overlay Verification

| Diagnostic | Expected | Actual |
|-----------|----------|--------|
| MediaPipe FPS | ~30 | |
| Inference FPS | ~10 (100ms interval) | |
| Buffer fill | < 5 → 5+ as hand is held | |
| Buffer Fill % | 17% → 100% | |
| Prediction | e.g. `THANK YOU` | |
| Confidence | > 60% | |
| Top-3 shown | Yes (3 rows) | |
| Inference time | < 20ms | |

## Checklist

- [ ] Buffer never stuck at < 5 frames with hand visible
- [ ] Prediction appears within 1 second of gesture start
- [ ] Smoothing produces stable label after ~500ms
- [ ] Confidence shows in UI
- [ ] Translation shows human-readable name (e.g. "Thank You" not "THANK YOU")
- [ ] `lookupGesture()` returns gesture info (after migration applied)
- [ ] Suggested replies appear (after migration applied)
- [ ] Reference video section shows (after admin uploads video)
- [ ] `?debug=1` overlay shows all diagnostics
