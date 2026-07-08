# Avatar Rendering System

## Overview

Phase 41 upgrades the landmark renderer from a simple hand skeleton to a full upper-body avatar system with multiple themes and non-manual feature visualization.

## Architecture

```
AnimationFrame (hand landmarks)
    ↓
BodyPoseEstimator (derives body pose from hand positions)
    ↓
NonManualController (facial expressions, head movements)
    ↓
AdvancedCanvasRenderer (draws complete avatar)
    ↓
Canvas element
```

## Body Pose Estimation

Since existing animation assets contain only hand landmarks (21 points per hand), a `BodyPoseEstimator` derives the full upper-body skeleton:

| Body Part | Derivation |
|-----------|-----------|
| Head | Centered above neck, offset by body lean |
| Neck | Below head, connects to shoulders |
| Torso | Below neck, follows body lean |
| Shoulders | Fixed width (0.7), raised/lowered by hand positions |
| Elbows | Computed via inverse kinematics from shoulder→hand |
| Wrists | Direct from hand landmark 0 |
| Hands | Averaged from palm landmarks (5,6,7,8) |

## Avatar Themes

| Theme | Lines | Joints | Glow | Colors |
|-------|-------|--------|------|--------|
| Minimal | 2px | 3px | No | Blue |
| Skeleton | 3px | 5px | Yes | Amber |
| Flat | 5px | 6px | No | Green |
| 2D Avatar | 6px | 7px | Yes | Pink + face |

## Body Connections

```
head ── neck ── torso
         │
    ┌────┴────┐
 leftShld  rightShld
    │          │
 leftElbow  rightElbow
    │          │
 leftWrist  rightWrist
    │          │
 leftHand   rightHand
```

## Non-Manual Feature Indicators

When `showNonManual` is enabled, the top-left corner shows bar indicators for:
- BROW (eyebrow raise: 0-1)
- NOD (head nod: 0-1)
- SHAKE (head shake: 0-1)
- MOUTH (mouth openness: 0-1)

In 2D Avatar mode, these drive facial animations (eyebrow position, smile, mouth shape).
