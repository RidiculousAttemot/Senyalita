# Non-Manual Features

## Overview

Non-manual signals (facial expressions, head movements, body orientation) are essential for natural sign language communication. Phase 41 adds support infrastructure that works with existing hand-only animation assets.

## Supported Features

| Feature | Range | Description |
|---------|-------|-------------|
| Eyebrow Raise | 0-1 | Question/surprise marker |
| Head Nod | 0-1 | Affirmation/agreement |
| Head Shake | 0-1 | Negation/disagreement |
| Mouth Open | 0-1 | Emphasis/expression |
| Body Orientation | -1 to 1 | Left/right lean |
| Facial Expression | string | neutral, happy, sad, surprised, questioning, etc. |

## Default Expression Mapping

When no expression data exists (hand-only assets), the `NonManualController` maps gesture labels to default expressions:

| Gesture | Eyebrow | Nod | Shake | Mouth | Expression |
|---------|---------|-----|-------|-------|------------|
| HELLO | 0.6 | 0 | 0 | 0.3 | happy |
| HOW ARE YOU | 0.7 | 0.2 | 0 | 0 | questioning |
| YES | 0 | 0.8 | 0 | 0.2 | affirmative |
| NO | 0 | 0 | 0.6 | 0.3 | negative |
| THANK YOU | 0 | 0.5 | 0 | 0.4 | grateful |
| DON'T KNOW | 0.7 | 0 | 0.5 | 0 | uncertain |
| SAD | 0.2 | 0 | 0 | 0.1 | sad |

## Smoothing

Expression values are smoothed with exponential decay:
```
current += (target - current) × (1 - exp(-5 × dt))
```

## Future Data Compatibility

The `NonManualFeatures` interface and `EnhancedFrame` type support future MediaPipe Holistic datasets that include:
- Face landmarks (468 points)
- Pose landmarks (33 points)
- Full body tracking

Adding new data sources requires only:
1. Populating `EnhancedFrame.nonManual` from face landmarks
2. Populating `EnhancedFrame.bodyPose` from pose landmarks
