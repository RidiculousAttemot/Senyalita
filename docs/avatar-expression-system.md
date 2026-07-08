# Avatar Expression System

## Overview

The `NonManualController` (Part E) manages 6 non-manual feature channels that drive the avatar's facial expressions, head movements, and body orientation.

## Feature Channels

| Channel | Range | Description |
|---------|-------|-------------|
| `eyebrowRaise` | 0–1 | Eyebrow elevation for questions/surprise |
| `headNod` | 0–1 | Nodding for affirmation/agreement |
| `headShake` | 0–1 | Shaking for negation/disagreement |
| `mouthOpen` | 0–1 | Mouth aperture for emphasis/emotion |
| `bodyOrientation` | -1–1 | Lean forward/backward for engagement |
| `facialExpression` | string | Semantic label for renderer interpretation |

## Expression Profiles (20 total)

| Profile | eyebrowRaise | headNod | headShake | mouthOpen | bodyOrientation |
|---------|-------------|---------|-----------|-----------|-----------------|
| neutral | 0 | 0 | 0 | 0 | 0 |
| happy | 0.5 | 0.1 | 0 | 0.4 | 0 |
| sad | 0.2 | 0 | 0 | 0.1 | 0 |
| surprised | 0.9 | 0 | 0 | 0.7 | 0.1 |
| angry | 0.1 | 0 | 0.1 | 0.3 | -0.1 |
| questioning | 0.7 | 0.2 | 0.1 | 0.2 | 0 |
| affirmative | 0.2 | 0.8 | 0 | 0.2 | 0 |
| negative | 0.1 | 0 | 0.6 | 0.3 | 0 |
| grateful | 0.3 | 0.5 | 0 | 0.4 | 0 |
| emphatic | 0.6 | 0.3 | 0 | 0.3 | 0.15 |

## Gesture-to-Expression Mapping

40+ gesture labels are mapped to expression profiles, e.g.:
- HELLO → cheerful
- HOW ARE YOU → questioning
- YES → affirmative
- NO → negative
- SAD → sad
- WHY → questioning

## Integration

Expressions are computed in `SignAnimationPlayer`'s frame callback:
```
CoarticulationEngine → NonManualController → AdvancedCanvasRenderer
```

The renderer's `avatar2d` theme uses these features to draw dynamic facial expressions.
