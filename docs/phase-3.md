# Phase 3 Dataset Capture Checkpoint

## Summary
Phase 3 adds a frontend-only landmark sequence capture tool. It records normalized MediaPipe landmark frames and exports them as JSON for future training. This is a temporary developer tool placed on the camera page and not in Admin yet.

Current direction: collect the FSL alphabet (a-z) before any word-gesture training.

## Why Not Admin Yet
Admin requires authentication, roles, storage, and backend work that are out of scope. The dataset capture panel is intentionally placed on the camera page for early data collection and testing.

## How to Record
1. Open http://localhost:3000/camera.
2. Enter a label (example: a, b, or z).
3. Click Start Recording.
4. Perform the sign for a few seconds.
5. Click Stop Recording or wait for the 10s/300 frame limit.
6. Click Export JSON to download the file.

## JSON Export Structure
Exported JSON includes:
- app: SignLangVisual
- phase: 3
- label
- createdAt
- durationMs
- frameCount
- source: mediapipe-hands
- frames: timestamped landmark arrays

## Limitations
- Frontend-only storage
- No automatic labeling
- Dataset coverage validation is manual via a script
- Requires manual recording and export

## Dataset Validation
Run the dataset validator after saving alphabet samples:

```
npm run validate:dataset
```

Strict mode fails when labels are missing or below 3 samples:

```
npm run validate:dataset:strict
```

## How This Prepares Future Training
The exported landmark sequences are directly usable for training sequence models once a dataset pipeline is established.

## Recommended Next Phase
Capture and curate the FSL alphabet dataset, then integrate the CNN-LSTM model for real recognition.
