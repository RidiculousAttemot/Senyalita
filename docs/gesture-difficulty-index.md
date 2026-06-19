# Gesture Difficulty Index

## Overview

The Gesture Difficulty Index ranks all 133 gesture classes by how difficult
users find them to perform correctly. This enables targeted learning
recommendations and dataset improvement efforts.

## Scoring Formula

```
difficulty_score = (1 - avg_confidence) × 0.4
                 + correction_rate × 0.3
                 + confusion_rate × 0.2
                 + retry_rate × 0.1
```

Where:
- **avg_confidence**: Mean recognition confidence (0-1)
- **correction_rate**: corrections / total_recognitions
- **confusion_rate**: confusion_events / total_recognitions
- **retry_rate**: retry_attempts / total_recognitions

## Difficulty Levels

| Score Range | Label | Meaning |
|-------------|-------|---------|
| 0.00–0.24 | Easy | Most users perform this gesture correctly |
| 0.25–0.44 | Moderate | Some users struggle with this gesture |
| 0.45–0.64 | Hard | Frequently confused or corrected |
| 0.65–1.00 | Very Hard | Users consistently struggle with this gesture |

## Database Table: `gesture_difficulty_tracking`

| Column | Type | Description |
|--------|------|-------------|
| `gesture_label` | `text` (unique) | The gesture class |
| `total_recognitions` | `integer` | Total inference count |
| `avg_confidence` | `real` | Mean confidence across all recognitions |
| `correction_count` | `integer` | Number of user corrections |
| `confusion_count` | `integer` | Count of confusion events (near-topK) |
| `retry_count` | `integer` | Count of user retry attempts |
| `difficulty_score` | `real` (generated) | Computed difficulty (0-1) |

## Implementation

### Client-side: `GestureDifficultyAnalyzer`

The analyzer in `src/features/analytics/gestureDifficulty.ts`:

- Ranks gestures by difficulty score
- Classifies each into easy/moderate/hard/very_hard
- Provides `getTopHardest(n)` and `getEasiest(n)` helpers
- Caches rankings for the session

### Data Collection

Difficulty data is populated from:

1. **Translation logs**: Confidence scores per gesture
2. **Prediction corrections**: User-corrected predictions
3. **Gesture confusion pairs**: Cross-label confusion events
4. **Retry logs**: User retry behavior from `gesture_retry_log`

## Integration

- **Learn Page**: Displays difficulty badges on gesture cards
- **Learning Recommendations**: Difficult gestures get higher recommendation priority
- **Admin Dashboard**: Shows ranked difficulty table with per-gesture breakdown
