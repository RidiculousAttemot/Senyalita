# Personalized Learning Engine

## Overview

The Personalized Learning Engine generates gesture practice recommendations
tailored to each user's performance and conversation patterns.

## Recommendation Sources

| Source | Weight | Description |
|--------|--------|-------------|
| Low-confidence gestures | 0.2/count | Gestures the user frequently gets wrong |
| Common mistakes | 0.7 | Gestures the user confuses with others |
| Difficulty rankings | 0.5–0.8 | System-wide hardest gestures (rank-adjusted) |
| Conversation topics | 0.4 | Topic-related gestures from user's conversations |

## Engine: `LearningRecommendationEngine`

```typescript
class LearningRecommendationEngine {
  setDifficultyRankings(rankings: GestureDifficultyRank[])
  recordLowConfidence(label: string, confidence: number)
  recordMistake(predicted: string, corrected: string)
  setConversationHistory(history: ContextMessage[])
  getRecommendations(maxCount = 6): LearningRecommendation[]
}
```

## Recommendation Object

```typescript
type LearningRecommendation = {
  gestureLabel: string;
  reason: string;       // Human-readable explanation
  priorityScore: number; // 0-1, higher = more important
};
```

## UI Integration

The Learn page (`src/app/learn/page.tsx`) was enhanced with:

1. **Recommendations Banner**: Top of page shows recommended gestures as clickable tags
2. **Difficulty Badges**: Each gesture card shows difficulty level (easy/moderate/hard/very_hard)
3. **Smart Sorting**: Dropdown enables sorting by recommendation, alphabetically, or by difficulty
4. **Quick Filter**: Clicking a recommendation tag auto-searches and scrolls to matching gestures

## Database Table: `learning_recommendations`

| Column | Type | Description |
|--------|------|-------------|
| `session_token` | `text` | Anonymous user identifier |
| `gesture_label` | `text` | Recommended gesture |
| `recommendation_reason` | `text` | Reason for recommendation |
| `priority_score` | `real` | Recommendation weight |
| `is_dismissed` | `boolean` | User dismissed this recommendation |
| `is_completed` | `boolean` | User practiced this gesture |

## Server-side persistence

Recommendations are stored per session token so users see consistent suggestions
across page reloads. Dismissed/completed recommendations are filtered out.
