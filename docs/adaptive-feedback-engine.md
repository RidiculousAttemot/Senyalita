# Adaptive Feedback Engine

## Overview

The Adaptive Feedback Engine analyzes recognition sessions to identify which gestures need improvement. It tracks confidence, corrections, rejections, and conversation success rates, then automatically recommends dataset collection priorities — all without changing the deployed BiLSTM v1 model.

## Architecture

Implemented in `src/features/feedback/adaptiveFeedback.ts`.

### Key Components

- **AdaptiveFeedbackEngine** — Main analysis engine
- **GestureStats** — Per-gesture performance tracking
- **SessionAnalysis** — Individual gesture analysis results
- **Recommendation** — Prioritized improvement suggestions

## Data Tracked

| Data Point | Description |
|-----------|-------------|
| `avgConfidence` | Average recognition confidence |
| `correctionCount` | How often users correct the prediction |
| `rejectionCount` | How often suggestions are rejected |
| `successfulConversations` | Conversations that completed successfully |
| `failedConversations` | Conversations that failed or were abandoned |
| `trend` | Whether performance is improving, declining, or stable |

## Recommendation Engine

The engine generates prioritized recommendations based on:

### 1. Low Confidence (Priority: 1 - avgConfidence)
- Triggered when average confidence < 0.6
- Suggests collecting more training data

### 2. High Correction Rate (Priority: correctionRate)
- Triggered when >30% of recognitions are corrected
- Suggests reviewing the gesture label for clarity

### 3. High Rejection Rate (Priority: rejectionRate)
- Triggered when >20% of suggestions are rejected
- Suggests adding variations to the gesture definition

### 4. Low Conversation Success (Priority: (1 - successRate) * 80)
- Triggered when success rate < 50% with >3 conversations
- Suggests more signer diversity in training data

## Example Recommendations

```
Priority  | Gesture          | Reason
----------|------------------|---------------------------------------------
92        | DON'T UNDERSTAND | Low avg confidence (35%). Needs more data.
78        | WEELCHAIR PERSON | High correction rate (65%). Review label.
65        | FAST             | High rejection rate (45%). Add variations.
52        | DEAF BLIND       | Low success rate (30%). More signers needed.
```

## Trend Analysis

Each gesture has a trend indicator based on comparing the last 5 confidences against the preceding 5:
- **Improving** — Recent average > older average + 0.05
- **Declining** — Recent average < older average - 0.05
- **Stable** — No significant change

## Files Created

- `src/features/feedback/adaptiveFeedback.ts`
- `src/features/feedback/index.ts`

## API

| Method | Description |
|--------|-------------|
| `recordFeedback(data)` | Record recognition feedback |
| `getRecommendations()` | Get prioritized improvement recommendations |
| `getGestureAnalysis(label)` | Get detailed analysis for one gesture |
| `getAllAnalyses()` | Get analyses for all tracked gestures |
| `getDatasetPrioritization()` | Get dataset collection priorities |
| `reset()` | Clear all data |

## Performance Impact

- All analysis performed client-side
- Running totals maintained for O(1) updates
- Analysis computation < 2ms for 133 gestures
- No database writes during normal operation
