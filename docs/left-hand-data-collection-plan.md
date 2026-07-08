# Left-Hand Data Collection Plan

## Motivation

The mirror augmentation fix (v2.3.0) generates synthetic left-hand training data by x-flipping right-hand samples and swapping hand slots. While this improves per-class balance (macro F1: 89.51% → 94.10%), synthetic data cannot fully replicate real left-hand biomechanics:

- Left-hand wrist position relative to the body is different
- Left-hand finger articulation angles differ from mirrored right hand
- Signers may angle or orient their left hand differently

Real left-hand training data will improve the model's ability to recognize left-handed signing.

## Root Cause Addressed

The hand-slot assignment bug in the translate page (`numHands > 0` fallback filling both slots with left-hand landmarks) has been fixed. The model now receives the correct input shape for left-hand gestures (left slot filled, right slot = zeros), matching the mirror-augmented training data. If left-hand confidence remains low after this fix, real left-hand data collection is the next step.

## Target

| Metric | Minimum | Better | Ideal |
|--------|---------|--------|-------|
| Left-hand samples per label | 5 | 10 | 20+ |
| Total left-hand samples (131 labels) | 655 | 1,310 | 2,620+ |
| Signers | 1 | 3 | 5+ |
| Left-hand dominant signers | 0 | 1 | 2+ |
| Recording environments | 1 | 2 | 3+ |

## Collection Method

### Preferred: Live App Recording

1. Enable `DEBUG=true` in `src/app/translate/page.tsx` and `src/features/recognition/useRecognition.ts`
2. Start the dev server (`npm run dev`)
3. Open the Sign-to-Text page
4. Open browser dev console to verify hand slot logging shows `left=filled right=null`
5. For each label, sign **with left hand only** for 3–5 repetitions
6. Record the video frames using the existing MediaPipe pipeline
7. Save the raw landmarks (before normalization) for each sequence

### Alternative: Script-Based

Use the existing extraction scripts but physically sign with the left hand while recording video:
- `scripts/extract-fsl-105-landmarks.mjs` for phrase signs
- A new script or modification to capture single left-hand alphabet signs

### Augmentation

After collecting left-hand samples, also run mirror augmentation on them to double the effective dataset (mirrored left-hand → synthetic right-hand for balance).

## Integration

1. Save left-hand samples as NDJSON in `datasets/left_hand/raw/`
2. Run `scripts/augment-unified-data.mjs` with the left-hand samples included
3. Rebuild the unified dataset with `scripts/build-unified-dataset-v4.mjs`
4. Retrain the model with left-hand data included
5. Re-export and deploy

## Expected Impact

- Improved left-hand confidence (currently lower than right-hand)
- Better generalization to left-handed signers
- More robust mirror augmentation (model sees both synthetic AND real left-hand data)

## When to Proceed

Proceed with left-hand data collection **after**:
1. The hand-slot assignment fix is deployed
2. Manual left-hand/right-hand validation confirms the slot fix alone is insufficient
3. The gap between left-hand and right-hand confidence remains > 10pp
