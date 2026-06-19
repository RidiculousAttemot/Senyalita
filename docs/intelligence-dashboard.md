# System Intelligence Dashboard

## Overview

The System Intelligence Dashboard extends the existing `/admin/model-health`
page with conversation, gesture difficulty, and adaptive learning metrics.

## Dashboard Sections

### 1. Model Status
- Current model status (ready/loading/error)
- Number of classes (133)
- Architecture (BiLSTM)
- Runtime (TF.js WebGL)

### 2. Recognition Quality (30 days)
- Total predictions (formatted with commas)
- Average confidence (%)
- Average inference time (ms)
- High/Medium/Low confidence breakdown with counts

### 3. Conversation Trends (30 days)
- Total conversations
- Successful conversations (count and percentage)
- Total messages
- Average messages per conversation

### 4. Gesture Difficulty Rankings
Top 10 hardest gestures ranked by difficulty score:
| Rank | Gesture | Difficulty Score | Avg Confidence | Corrections | Confusions | Total |
|------|---------|-----------------|----------------|-------------|------------|-------|

### 5. Correction Heatmap
Shows recent low-confidence events grouped by day:
- Color-coded cards (red for >5 events, yellow otherwise)
- Shows daily correction counts

### 6. Acceptance & Learning Statistics
- Reply acceptance rate (percentage)
- Total corrections (30 days)
- Total training samples
- Pending review queue count

### 7. Low-Confidence Trends
- Current low-confidence rate
- Trend vs baseline (15%)
- Color-coded indicators

### 8. Dataset Growth
- Total training samples count
- Pending review queue items

### 9. Most Confused Labels (30 days)
Table showing labels with >30% low-confidence rate:
- Label name
- Total predictions
- Low-confidence count
- Low-confidence rate
- Suggestion (re-record or monitor)

### 10. User Feedback (30 days)
- Recent feedback entries with date, gesture, rating, and comment

### 11. Explainable AI Panel
Description of the explanation system with link to the debug overlay.

## Database: `conversation_intelligence`

Daily rollup table for dashboard analytics:

| Column | Type | Description |
|--------|------|-------------|
| `day` | `date` (unique) | Date of aggregation |
| `total_conversations` | `integer` | Conversations started |
| `successful_conversations` | `integer` | Conversations marked successful |
| `total_messages` | `integer` | Total messages across conversations |
| `avg_response_delay_ms` | `real` | Average response time |
| `avg_corrections_per_conversation` | `real` | Average corrections per conversation |
| `avg_confidence` | `real` | Mean recognition confidence |
| `acceptance_rate` | `real` | Reply acceptance rate |
| `low_confidence_trend` | `real` | Low-confidence rate deviation |
| `top_topics` | `jsonb` | Most common conversation topics |
| `gesture_difficulty_summary` | `jsonb` | Difficulty distribution snapshot |
| `correction_heatmap` | `jsonb` | Daily correction counts |
| `dataset_growth` | `integer` | New training samples added |

## Data Refresh

The dashboard queries live data from:
- `translation_logs` — Recognition metrics
- `feedback` — User ratings
- `conversation_sessions` — Conversation outcomes
- `gesture_difficulty_tracking` — Difficulty rankings
- `prediction_corrections` — Correction counts
- `training_samples` — Dataset growth
- `review_queue` — Pending reviews
