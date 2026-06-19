# Roboflow Dataset Compatibility Report

Generated: 2026-06-09

## Dataset Type Analysis

The Roboflow dataset is an **image classification dataset**. Each sample is a single static JPG image of a hand performing an FSL gesture, annotated with a class label and bounding box.

**Not:** object detection, keypoint detection, action recognition, or video classification.

## Compatibility with MediaPipe

| Factor | Compatible? | Details |
|--------|-------------|---------|
| Image input | ✅ | MediaPipe Hands processes static images natively |
| Hand detection | ✅ | Single hand clearly visible in each image |
| Landmark extraction | ✅ | 21 landmarks per hand can be extracted |
| Bounding box pre-filtering | ✅ | Annotations provide crop regions |

**Compatibility: FULL**

## Compatibility with BiLSTM Pipeline

| Factor | Compatible? | Details |
|--------|-------------|---------|
| Feature format (126-dim) | ✅ | Same landmark format, can be extracted |
| Temporal sequences (120 frames) | ❌ | Images have no temporal dimension |
| 30-step temporal sampling | ❌ | No motion across frames |
| Per-frame variance | ❌ | All frames in a sequence would be identical |
| Multi-signer variation | ⚠️ | Only 1-2 signers from the photos |

**Compatibility: PARTIAL**

## Required Preprocessing

### For single-frame use (not recommended):
The dataset CANNOT be used for temporal sequence training without synthetic padding.

### For synthetic sequence generation:
1. Extract MediaPipe landmarks from each image (21 landmarks × 3 coords = 63 features per hand)
2. Normalize (wrist-center, max-abs scale)
3. Repeat the single frame 120 times to create a synthetic sequence
4. Use as training data alongside real sequence data

**Caveats:**
- Synthetic sequences lack motion information critical for gesture recognition
- Models trained on synthetic sequences may overfit to static poses
- Real-world gesture recognition requires temporal dynamics
- Only 26 alphabet classes have meaningful sample counts

## Impact Assessment

| Use Case | Impact | Rationale |
|----------|--------|-----------|
| Alphabet recognition | Low positive | Already well-covered by existing 5,721 samples |
| Phrase recognition | Negligible | Only 1-150 samples per phrase class, no temporal data |
| Real-world generalization | Negative risk | Static pose training may reduce temporal sensitivity |
| Conversation quality | None | No meaningful improvement expected |
| Model robustness | Neutral | Small addition to overall dataset size |

## Verdict

The Roboflow dataset is an **image classification dataset** with limited applicability to the temporal gesture recognition pipeline. It can provide marginal supplementary training data for alphabet classes but should **not** be relied upon for improving phrase recognition or real-world gesture understanding.
