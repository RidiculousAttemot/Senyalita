# Explainable Recognition Report

## Overview

Every prediction now produces a human-readable explanation describing why the
model arrived at its result. The explanation system is a lightweight rule-based
engine that interprets model outputs, motion analysis, and confidence metrics.

## Explanation Categories

| Category | Description |
|----------|-------------|
| `high_confidence` | Confidence ≥ 0.8 and strong temporal pattern match |
| `low_confidence` | Confidence < 0.5 due to various factors |
| `confusion` | Close call between two similar gestures |
| `motion` | Gesture phase or motion score affected the result |
| `edge_case` | Moderate confidence (0.5–0.8) with partial pattern match |

## Explanation Engine

The `PredictionExplainer` class in `src/features/recognition/explainer.ts`:

```
Input: label, confidence, topK, gesturePhase, motionScore, bufferLength
  │
  ├─ ≥0.8 confidence → "High confidence: motion matched temporal pattern"
  ├─ "start" phase → "Gesture still in progress"
  ├─ low motion + no phase → "Hand orientation differed from training"
  ├─ <10 frames → "Insufficient frame history"
  ├─ close topK → "Similar to gesture X (Y%), but motion favored Z"
  └─ else → "Partial match" or "Weak match"
```

## Confusion Detection

The engine detects label confusion using two methods:

1. **Similarity Groups**: Hand-crafted groups of visually similar gestures:
   - V ↔ U ↔ W
   - M ↔ N
   - D ↔ E ↔ F
   - B ↔ P
   - G ↔ Q
   - "Good Morning" ↔ "Good Afternoon" ↔ "Good Evening"
   - "Thank You" ↔ "Please" ↔ "Sorry"

2. **Confidence Proximity**: If the second prediction has confidence > 60% of
   the first, it's flagged as a close call.

## UI Components

### Debug Overlay (`ExplainabilityPanel`)

Shown on the translation page with the debug overlay:
- Color-coded header based on explanation category (green/red/yellow/blue/purple)
- Human-readable explanation text
- Top-K prediction list with highlighted primary prediction
- Raw metrics (phase, motion, buffer, inference time)

### Admin Explanation Panel (`AdminExplanationPanel`)

Exported for admin pages:
- Category header with color coding
- Full explanation text
- Contributing factor breakdown
- Top-K comparison table

## Database: `prediction_explanations`

Each prediction explanation can be logged for later analysis:

| Column | Type | Description |
|--------|------|-------------|
| `gesture_label` | `text` | The gesture being recognized |
| `predicted_label` | `text` | What the model predicted |
| `confidence` | `real` | Prediction confidence |
| `explanation_text` | `text` | Human-readable explanation |
| `explanation_category` | `text` | Category enum |
| `top_alternatives` | `jsonb` | Top-K alternatives |
| `contributing_factors` | `jsonb` | Factor breakdown |

## Benefits

1. **Debugging**: Developers can identify why specific gestures fail
2. **Trust**: Users understand why the system made a particular prediction
3. **Dataset Improvement**: Confusion patterns guide re-recording priorities
4. **Education**: Explanations help users understand gesture mechanics
