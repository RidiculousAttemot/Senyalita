# Dynamic Gesture Detection — Analysis

## Problem
The current gesture detection pipeline runs continuously regardless of whether the user is actively signing. During idle frames (no hand in frame, or hand stationary), the model still produces predictions, leading to:
- False positive recognitions
- Wasted inference work
- Poor UX (phantom gestures appearing)

## Proposed Solution: Frame-Level Motion + Fill Analysis

### Metrics to Track
| Metric | Source | Threshold | Purpose |
|--------|--------|-----------|---------|
| **Motion score** | Frame-to-frame landmark displacement (average l2 distance across all 126 keypoints) | >0.015 | Detect active signing motion |
| **Sequence fill rate** | Ratio of visible hands in the current buffer window | >60% | Ensure hands are present |
| **Active frame count** | Number of frames since buffer clear where motion exceeded threshold | — | Track signing duration |

### Implementation Plan

#### 1. Diagnostic Hook (`useDiagnostics`)
Wraps the existing recognition pipeline. Exposes:
```typescript
type DiagnosticsInfo = {
  bufferFillRate: number;       // 0–100%
  motionScore: number;          // 0–1+
  activeFrameCount: number;
  isSigning: boolean;           // auto-detected
  inferenceCount: number;
};
```

#### 2. Motion Score Calculation
Compute in `buffer.append()`:
```typescript
const motionScore = landmarks.reduce(
  (sum, kp, i) => sum + dist(kp, prevLandmarks[i]),
  0
) / 126;
```
Only when `prevLandmarks` exists.

#### 3. Auto-Start / Auto-Stop
- **Auto-start**: When `motionScore > 0.015 && fillRate > 60%` for 3 consecutive frames → begin recognition.
- **Auto-stop**: When `motionScore < 0.005 || fillRate < 20%` for 15 consecutive frames → clear buffer, stop inference.

### Effect on Recognition Pipeline
- **Before**: Recognition runs every 100ms regardless of user activity.
- **After**: Recognition only runs during `isSigning === true` periods. Saves ~70% of inference calls during idle/reading time.

### Admin Debug Overlay
Add an optional overlay to the camera page toggled by `?debug` query param or admin state:
```
┌─────────────────────────────┐
│ Buffer:  ━━━━━━━━░░ 72%     │
│ Motion:  0.042 (active)     │
│ Frames:  34 active          │
│ Inferences: 12              │
│ Status:  SIGNING             │
└─────────────────────────────┘
```

## Open Questions
1. Should the diagnostic data be persisted to `model_metrics_daily` for monitoring?
2. Should `isSigning` gate the transcript entry creation (no idle transcript entries)?
