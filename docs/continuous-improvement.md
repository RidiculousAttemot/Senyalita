# Continuous Improvement Pipeline

## Script
**`scripts/build-improvement-report.mjs`**

## Purpose
Automatically analyze all system metrics and generate a prioritized improvement report without manual effort.

## Usage
```bash
node scripts/build-improvement-report.mjs [--days 30] [--output report.json]
```

## Data Sources

| Source | Data |
|--------|------|
| `translation_logs` | Recognition confidence, latency, gesture distribution |
| `conversation_sessions` | Success rate, stall rate, message count |
| `feedback` | Accuracy rate per gesture |
| `prediction_corrections` | Confusion matrix, correction targets |
| `gesture_difficulty_tracking` | Difficulty scores |
| `gestures` | Coverage status |
| `signer_profiles` | Signer diversity |
| `public/animations/manifest.json` | Animation asset coverage |

## Report Structure

```json
{
  "generatedAt": "ISO timestamp",
  "summary": { /* aggregate metrics */ },
  "metrics": {
    "recognition": { /* confidence, latency, low-conf rate */ },
    "conversation": { /* success rate, stall rate */ },
    "feedback": { /* accuracy */ },
    "dataset": { /* training samples, review queue */ },
    "animation": { /* coverage */ }
  },
  "topPriorities": [ /* ranked by impact */ ],
  "allPriorities": [ /* full list */ ],
  "recommendations": [ /* action items */ ]
}
```

## Priority Categories
- `recognition` — Low-confidence gestures
- `confusion` — Frequently confused pairs
- `animation` — Missing animation assets
- `conversation` — Conversation flow issues
- `dataset` — Training sample diversity
- `feedback` — Low feedback accuracy
- `coverage` — Gesture approval coverage
