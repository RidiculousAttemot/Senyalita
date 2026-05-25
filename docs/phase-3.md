# Phase 3 Dataset Capture Checkpoint

## Summary
Phase 3 adds a frontend-only landmark sequence capture tool. It records normalized MediaPipe landmark frames and exports them as JSON for future CNN-LSTM training. This is a temporary developer tool placed on the camera page and not in Admin yet.

## Why Not Admin Yet
Admin requires authentication, roles, storage, and backend work that are out of scope. The dataset capture panel is intentionally placed on the camera page for early data collection and testing.

## How to Record
1. Open http://localhost:3000/camera.
2. Enter a label (example: hello).
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
- No automatic labeling or dataset validation
- Requires manual recording and export

## How This Prepares CNN-LSTM
The exported landmark sequences are directly usable for training sequence models once a dataset pipeline is established.

## Recommended Next Phase
Capture and curate a labeled dataset, then integrate the CNN-LSTM model for real recognition.
