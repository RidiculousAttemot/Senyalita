# Conversation Insights

## Overview

Conversation Insights extends the analytics system to measure communication effectiveness. It tracks conversation quality metrics across all sessions, enabling data-driven improvements to the conversation assistant.

## Architecture

Implemented in `src/features/analytics/conversationInsights.ts`.

### Key Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| Average Conversation Length | Gestures per conversation | Total gestures / total conversations |
| Gestures Per Minute | Communication speed | Total gestures / total duration in minutes |
| Communication Completion | Successful completion rate | Completed conversations / total conversations |
| Correction Frequency | How often corrections happen | Total corrections / total gestures |
| Confidence Trend | Accuracy over time | Moving average window of confidences |
| Reply Acceptance | Reply adoption rate | Accepted replies / total replies offered |
| Most Common Topics | Frequency distribution | Topic occurrence count across sessions |

### Trend Analysis

Confidence data is divided into windows of N samples, and the average per window is calculated to show how confidence evolves over time. This provides a smoothed trend line that reveals:

- Improvement from practice
- Degradation from confusion
- Stability across different sessions

### Data Model

```typescript
type SessionRecord = {
  conversationId: string;
  durationMs: number;
  gestureCount: number;
  corrections: number;
  avgConfidence: number;
  repliesAccepted: number;
  repliesTotal: number;
  topic: string;
  completedSuccessfully: boolean;
  timestamps: number[];
  confidences: number[];
};
```

## Files Created

- `src/features/analytics/conversationInsights.ts`
- Updated `src/features/analytics/index.ts`

## Admin Dashboard Integration

The Conversation Insights data is available for the admin dashboard to visualize:

1. **Conversation length distribution** — Histogram of gesture counts per conversation
2. **Communication speed** — Gestures per minute over time
3. **Completion rate** — Percentage of conversations successfully completed
4. **Correction frequency** — Corrections per gesture over time
5. **Confidence trend** — Average confidence per time window
6. **Reply acceptance** — Percentage of suggested replies accepted
7. **Topic popularity** — Most common conversation topics

## Performance Impact

- Metrics computed in-memory from recorded sessions
- No database queries during computation
- Lightweight (< 1ms per metrics calculation)
- Session data stored in memory (configurable limit)
