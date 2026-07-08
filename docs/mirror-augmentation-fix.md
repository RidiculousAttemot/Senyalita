# Mirror Augmentation Fix

## Bug

File: `scripts/augment-unified-data.mjs` — `augmentMirror` function.

**Before (broken):**
```js
const augmentMirror = (sequence) => {
  return sequence.map((frame) => {
    const out = [...frame];
    for (let i = 0; i < 66; i += 2) {
      out[i] = -frame[i];
    }
    return out;
  });
};
```

**Three bugs:**
1. **Wrong stride**: `i += 2` on a frame layout of `[x0, y0, z0, x1, y1, z1, ...]` negates indices 0 (x), 2 (z), 4 (y)... instead of only x at stride 3.
2. **Wrong range**: `i < 66` only processes the first 66 of 126 features, missing most of the right-hand data.
3. **No hand-slot swap**: Mirror should swap slot 0 (left hand, indices 0–62) and slot 1 (right hand, indices 63–125) to teach left-hand recognition.

## Fix

Replaced with `mirrorAndSwapHand`:

```js
const mirrorAndSwapHand = (frame) => {
  const slot0 = frame.slice(0, 63);  // left hand
  const slot1 = frame.slice(63, 126); // right hand
  const out = new Array(126);
  // Mirror slot1 → output slot 0 (teaches left-hand recognition)
  // Mirror slot0 → output slot 1
  const mirrorSlot = (src, dst, dstOffset) => {
    for (let i = 0; i < 63; i += 3) {
      dst[dstOffset + i]     = -src[i];       // x negated
      dst[dstOffset + i + 1] =  src[i + 1];   // y preserved
      dst[dstOffset + i + 2] =  src[i + 2];   // z preserved
    }
  };
  mirrorSlot(slot1, out, 0);    // mirrored right hand → left slot
  mirrorSlot(slot0, out, 63);   // mirrored left hand → right slot
  return out;
};
```

## Verification

A self-check runs at the top of the augmentation script. It verifies:
- Output length = 126 ✓
- x coordinates negated and slots swapped (slot1→slot0) ✓
- x coordinates negated and slots swapped (slot0→slot1) ✓
- y/z values preserved after swap ✓
- Double mirror is identity (involution) ✓

## Additional Fixes

### Streaming NDJSON output
The augment script used `JSON.stringify` which hit Node's string size limit (~536M chars) on the large augmented dataset. Changed to NDJSON streaming output (`train_augmented.ndjson`).

### Dedup key
The build script's dedup key `datasetOrigin|signerId|sessionId` did not include `augmentationPreset`, causing augmented samples to be treated as duplicates. Added `augmentationPreset` to the dedup key.

### NDJSON loading
The augment script used `readJson` (read whole file) on 1.4 GB train.json files, exceeding Node's string limit. Changed to stream-based NDJSON loading.

## Dataset Changes

| Metric | Old (buggy mirror) | New (corrected) |
|--------|---------------------|-----------------|
| Total samples | 18,303 | 51,192 |
| Alphabet (a-z) | 14,217 | 14,217 |
| FSL-105 phrases | 2,129 | 2,129 |
| Augmented | 3,957 (limited by dedup bug) | 34,189 (dedup fixed) |
| Hard cases | — | 657 |

## Model Metrics

| Metric | Old v4 (buggy mirror) | New v4 (corrected mirror) |
|--------|----------------------|--------------------------|
| Test accuracy | 94.81% | 93.99% |
| Test macro F1 | 89.51% | **94.10%** |
| Test weighted F1 | 94.80% | 93.97% |
| Val accuracy | 94.53% | 93.65% |
| Best val F1 | 89.44% | **94.68%** |
| Dataset size | 18,303 | 51,192 |
| Epochs | 60 | 80 |

**Analysis**: The new model has ~0.8% lower test accuracy but **+4.6% higher macro F1**, indicating better per-class balance. This is expected from the mirror augmentation which improves hand-dominance invariance. The slight accuracy drop is due to the 2.8× larger dataset containing more varied augmented samples.

## Files Changed

| File | Change |
|------|--------|
| `scripts/augment-unified-data.mjs` | Fixed `augmentMirror`, added `mirrorAndSwapHand`, added self-verification, streaming NDJSON output, NDJSON loading |
| `scripts/build-unified-dataset-v4.mjs` | Updated `loadAugmented` for NDJSON, fixed dedup key, made `loadAugmented` async |
| `scripts/train-unified-bilstm-v2.mjs` | Added checkpoint saving on best-model improvement |
| `scripts/fix-mirror-augmentation.mjs` | (new) Standalone patcher script |
| `docs/mirror-augmentation-fix.md` | (new) This document |

## Manual Validation Result

✅ **Manual left-hand / right-hand validation passed** (2026-07-03).

After deploying the corrected model (`bilstm_v4`, exported 2026-07-03T04:17:00Z) and fixing the hand-slot assignment bug in the translate page:

- Left-hand confidence is now acceptable — the gap to right-hand is significantly smaller than before the mirror augmentation fix.
- Right-hand recognition shows no regression.
- Hand-slot occupancy is correct (console logs `left=filled right=null` for left hand, `left=null right=filled` for right hand).
- Model loads successfully (warmup shape [1, 35, 126], 131 classes).

**Retraining is not currently recommended.** If future formal evaluation reveals weak labels, collect real left-hand samples for those specific labels first (see [left-hand data collection plan](left-hand-data-collection-plan.md)).

The full test procedure and result table template are in:

➡️ [docs/manual-left-right-hand-validation.md](manual-left-right-hand-validation.md)

## Manual Test Checklist

- [x] Right-hand alphabet signs: confidence ≥ 0.6 for most letters
- [x] Left-hand alphabet signs: comparable confidence to right hand
- [x] No regression on two-handed FSL-105 phrase signs
- [x] Model loads without errors (warmup shape [1, 35, 126])
- [x] Inference produces predictions within expected confidence range
