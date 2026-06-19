# FSL Kaggle Landmark Audit

Generated: 2026-06-07T00:08:21.910Z

## Source

- Input: `datasets/processed/fsl_kaggle_landmarks/samples_<a-z>.json`
- Extracted by: `scripts/extract-fsl-kaggle-mediapipe.mjs` + `scripts/extract-fsl-kaggle-resume.mjs` (Y, Z re-run)
- Backend: MediaPipe `@mediapipe/tasks-vision` `HandLandmarker` running in a headless Chromium via Puppeteer over self-signed HTTPS (loopback treated as a secure context).
- Confidence threshold: 0.3; numHands: 2; runningMode: IMAGE; delegate: CPU.
- Each Kaggle image is a single static frame. We replicate the resulting 126-feature vector to 120 frames to match the training pipeline's sequence length.
- Normalization: wrist-centered (`hand[0]`), then max-abs scaled to `[-1, 1]` — same as `src/features/recognition/normalize.ts`.

## Headline numbers

- Original Kaggle images: 11,700 (450 per label, A-Z)
- Total samples kept: **10865** (detection rate: 92.86%)
- Bad-shape samples: 0
- Samples with non-zero landmarks: 10865 (100.00% of kept)
- Value range across all samples: [-1.0000, 1.0000], mean -0.088082

## Per-label breakdown

| Label | Samples | Non-zero | Min | Max | Mean |
|-------|---------|----------|-----|-----|------|
| A | 397 | 397 | -1.0000 | 1.0000 | -0.1162 |
| B | 447 | 447 | -1.0000 | 1.0000 | -0.1128 |
| C | 381 | 381 | -1.0000 | 1.0000 | -0.0817 |
| D | 443 | 443 | -1.0000 | 1.0000 | -0.0799 |
| E | 430 | 430 | -1.0000 | 1.0000 | -0.1184 |
| F | 450 | 450 | -1.0000 | 0.5141 | -0.0977 |
| G | 448 | 448 | -1.0000 | 1.0000 | -0.0501 |
| H | 450 | 450 | -1.0000 | 1.0000 | -0.0067 |
| I | 447 | 447 | -1.0000 | 1.0000 | -0.0837 |
| J | 446 | 446 | -1.0000 | 1.0000 | -0.0664 |
| K | 447 | 447 | -1.0000 | 1.0000 | -0.0727 |
| L | 430 | 430 | -1.0000 | 1.0000 | -0.0873 |
| M | 337 | 337 | -1.0000 | 0.8937 | -0.1330 |
| N | 354 | 354 | -1.0000 | 0.8747 | -0.1309 |
| O | 326 | 326 | -1.0000 | 1.0000 | -0.1049 |
| P | 432 | 432 | -1.0000 | 1.0000 | 0.0316 |
| Q | 356 | 356 | -1.0000 | 1.0000 | 0.0004 |
| R | 447 | 447 | -1.0000 | 0.4927 | -0.1008 |
| S | 342 | 342 | -1.0000 | 1.0000 | -0.1238 |
| T | 444 | 444 | -1.0000 | 0.8046 | -0.1011 |
| U | 450 | 450 | -1.0000 | 0.3866 | -0.1036 |
| V | 431 | 431 | -1.0000 | 0.5652 | -0.1136 |
| W | 445 | 445 | -1.0000 | 0.7621 | -0.1159 |
| X | 427 | 427 | -1.0000 | 1.0000 | -0.0992 |
| Y | 440 | 440 | -1.0000 | 1.0000 | -0.1282 |
| Z | 418 | 418 | -1.0000 | 0.9276 | -0.1119 |

## Comparison to placeholder

The previous `datasets/external/fsl_kaggle_landmarks/` contained 11,700 placeholder samples with all-zero 126-feature frames. They have been **fully replaced** with real MediaPipe extractions in this run.

## Files

- Raw audit numbers: `datasets/processed/fsl_kaggle_landmarks/audit.json`
- Per-label samples: `datasets/processed/fsl_kaggle_landmarks/samples_<a-z>.json`
- Manifest: `datasets/processed/fsl_kaggle_landmarks/manifest.json`
- Stats: `datasets/processed/fsl_kaggle_landmarks/extraction_stats.json`