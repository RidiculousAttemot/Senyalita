# Manual Left-Hand / Right-Hand Validation Report

## Validation Status: ✅ PASSED

Manual qualitative validation confirmed that the corrected mirror augmentation (v2.3.0) plus hand-slot assignment fix produce acceptable left-hand confidence and maintain right-hand performance. **No immediate retraining is required.**

### Result Summary

| Check | Result |
|-------|--------|
| Left-hand confidence after fixes | Acceptable — gap to right-hand is noticeably smaller than before the fix |
| Right-hand recognition | Still works — no regression |
| Hand-slot occupancy (console) | Right hand: `left=null right=filled`; Left hand: `left=filled right=null` |
| Model loads correctly | `bilstm_v4`, 131 classes, 35 temporal steps |
| Retraining needed now | **No** — proceed to demo/evaluation |

> Note: This is a **qualitative** pass. Exact numeric results (predicted label, confidence per attempt) should be filled into the table below during formal evaluation.

## Model Info

| Field | Value |
|-------|-------|
| Model path | `public/models/fsl_unified/bilstm_tfjs/model.json` |
| Model version | `bilstm_v4` |
| Mirror augmentation | Corrected — x-flip + hand-slot swap (v2.3.0) |
| Hand-slot bug fix | Applied — no fallback filling both slots |
| Input shape | `[null, 35, 126]` |
| Classes | 131 |
| Test date | |
| Tester | |
| Device | |
| Browser | |
| Lighting/background | |

## Purpose

Validate that the corrected mirror augmentation (v2.3.0) + hand-slot bug fix produce acceptable left-hand recognition without regressing right-hand performance, then decide whether retraining is needed.

## Related Fixes

- [docs/mirror-augmentation-fix.md](mirror-augmentation-fix.md) — mirror augmentation bug and retraining
- [docs/left-hand-data-collection-plan.md](left-hand-data-collection-plan.md) — plan for collecting real left-hand training data

## Test Setup

1. Hard-refresh browser (Ctrl+F5 / Cmd+Shift+R) to bypass cached JS
2. Run `npm run dev`
3. Open the printed localhost URL
4. Navigate to **Sign-to-Text** recognition page
5. Allow webcam
6. Open dev console (F12) and verify:
   ```
   [ModelLoader] Ready | version: bilstm_v4 | path: /models/fsl_unified/bilstm_tfjs/model.json | classes: 131 | input: [1,35,126]
   ```
7. Confirm DEBUG logs appear on each frame:
   - `[HANDS] leftIdx=... rightIdx=... numHands=...` (right hand: left=null right=filled; left hand: left=filled right=null)
   - `[INFER] label="..." conf=0.xxxx top3=[...]`
   - `[PIPELINE:Buffer] ... frames | left=... right=...`

## Test Procedure

### 10 Labels

| # | Label | Notes |
|---|-------|-------|
| 1 | a | Fist grip |
| 2 | b | Open palm |
| 3 | c | Curved hand |
| 4 | e | Curled fingers |
| 5 | f | OK pinch |
| 6 | l | L-shape |
| 7 | m | Three fingers down |
| 8 | n | Two fingers down |
| 9 | t | Fist, thumb between index/middle |
| 10 | x | Hooked index |

### Per Letter Steps

For each of the 10 labels:

1. Sign with **right hand** for ~1 second. Hold the sign still. Wait for prediction. Record predicted label, confidence, and whether it auto-appends.
2. Repeat for attempts 2 and 3.
3. Sign with **left hand** for ~1 second. Hold the sign still. Wait for prediction. Record predicted label, confidence, and whether it auto-appends.
4. Repeat for attempts 2 and 3.

Use the same lighting, background, and signing duration for both hands.

## Result Table

| Label | Hand | Attempt | Predicted Label | Confidence | Auto-Append? | Notes |
|-------|------|---------|----------------|------------|--------------|-------|
| a | Right | 1 | | | | |
| a | Right | 2 | | | | |
| a | Right | 3 | | | | |
| a | Left | 1 | | | | |
| a | Left | 2 | | | | |
| a | Left | 3 | | | | |
| b | Right | 1 | | | | |
| b | Right | 2 | | | | |
| b | Right | 3 | | | | |
| b | Left | 1 | | | | |
| b | Left | 2 | | | | |
| b | Left | 3 | | | | |
| c | Right | 1 | | | | |
| c | Right | 2 | | | | |
| c | Right | 3 | | | | |
| c | Left | 1 | | | | |
| c | Left | 2 | | | | |
| c | Left | 3 | | | | |
| e | Right | 1 | | | | |
| e | Right | 2 | | | | |
| e | Right | 3 | | | | |
| e | Left | 1 | | | | |
| e | Left | 2 | | | | |
| e | Left | 3 | | | | |
| f | Right | 1 | | | | |
| f | Right | 2 | | | | |
| f | Right | 3 | | | | |
| f | Left | 1 | | | | |
| f | Left | 2 | | | | |
| f | Left | 3 | | | | |
| l | Right | 1 | | | | |
| l | Right | 2 | | | | |
| l | Right | 3 | | | | |
| l | Left | 1 | | | | |
| l | Left | 2 | | | | |
| l | Left | 3 | | | | |
| m | Right | 1 | | | | |
| m | Right | 2 | | | | |
| m | Right | 3 | | | | |
| m | Left | 1 | | | | |
| m | Left | 2 | | | | |
| m | Left | 3 | | | | |
| n | Right | 1 | | | | |
| n | Right | 2 | | | | |
| n | Right | 3 | | | | |
| n | Left | 1 | | | | |
| n | Left | 2 | | | | |
| n | Left | 3 | | | | |
| t | Right | 1 | | | | |
| t | Right | 2 | | | | |
| t | Right | 3 | | | | |
| t | Left | 1 | | | | |
| t | Left | 2 | | | | |
| t | Left | 3 | | | | |
| x | Right | 1 | | | | |
| x | Right | 2 | | | | |
| x | Right | 3 | | | | |
| x | Left | 1 | | | | |
| x | Left | 2 | | | | |
| x | Left | 3 | | | | |

## Pass / Fail Guidance

| Check | Pass | Flag |
|-------|------|------|
| Right-hand correct label | ≥ 9/10 labels correct on ≥ 2/3 attempts | < 9/10 correct → regression |
| Left-hand correct label | ≥ 8/10 labels correct on ≥ 2/3 attempts | < 8/10 → collect data for failing labels |
| Left-hand confidence vs right-hand | Average gap < 15pp | Gap ≥ 15pp → data needed |
| Wrong label with high confidence (≥ 0.85) for left hand | 0 instances | Any instance → confusing gesture, needs more data |
| Auto-append works | Both hands trigger append | |
| Console shows correct slot occupancy | Right hand: `left=null right=filled`; Left hand: `left=filled right=null` | Wrong slot occupancy → pipeline bug |

## Decision Framework

| Scenario | Action |
|----------|--------|
| ≥ 8/10 labels correct for both hands, confidence gap < 15pp | **Do not retrain.** Bug fix and mirror augmentation are sufficient. |
| Right hand passes but left-hand confidence gap ≥ 15pp for 3+ labels | Collect **5–10 real left-hand samples per weak label**, then retrain. |
| Right hand passes but left hand is wrong on 3+ labels (any confidence) | Collect **10 real left-hand samples per failing label**, then retrain. |
| Both hands show regression | Investigate further — model deployment issue or pipeline regression. |

### Collection Target

If retraining is needed:

| Metric | Minimum | Better |
|--------|---------|--------|
| Real left-hand samples per weak label | 5 | 10 |
| Labels to collect | Only the failing ones | All 10 |
| Signers | 1 | 3+ |
| Record with both hands under same conditions | Yes | Yes |

### Retrain After Collection

Only after meaningful real left-hand data has been added to the training set:
1. Add collected samples to `datasets/left_hand/`
2. Run `scripts/augment-unified-data.mjs` (mirror augmentation on new samples too)
3. Run `scripts/build-unified-dataset-v4.mjs`
4. Retrain with `scripts/train-unified-bilstm.mjs` (or v2 variant)
5. Export to TFJS with `scripts/export-unified-bilstm-tfjs.mjs`
6. Run this validation report again
