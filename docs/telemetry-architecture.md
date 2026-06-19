# Telemetry Architecture

## Overview

Real-time production telemetry for SignLangVisual. Tracks recognition quality, conversation flow, AI reply usage, and user engagement metrics.

## Data Flow

```
Browser (client)
  → RealtimeMetrics component fires insert to telemetry_events table (via Supabase client)
  → Server-side query helpers aggregate data
  → Admin dashboards render metrics

Event triggers:
  - Recognition success  → every prediction (throttled by RealtimeMetrics dedup)
  - Low confidence       → when confidence < 0.5
  - AI reply used        → when user selects AI-generated reply
  - Conversation complete → when conversation session ends (communication_success set)
  - Session abandoned    → when session remains active > 30 min without updates
  - Gesture used         → per unique gesture detection
  - Reply used           → when responder selects a reply chip
```

## Database Table

### `telemetry_events`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| event_type | text | Enum: recognition_success, recognition_failure, low_confidence, ai_reply_used, conversation_completed, session_abandoned, gesture_used, reply_used |
| event_data | jsonb | Flexible payload for extra context |
| user_id | uuid | Nullable reference to profiles |
| session_id | uuid | Nullable reference to conversation_sessions |
| gesture_label | text | The recognized gesture label |
| confidence | real | Confidence score (0.0–1.0) |
| created_at | timestamptz | Event timestamp |

## Client Integration

The `RealtimeMetrics` component (`src/features/recognition/RealtimeMetrics.tsx`) is mounted in the camera and conversation pages. It fires events to Supabase with automatic deduplication (only logs each distinct gesture once per session).

```tsx
<RealtimeMetrics
  sessionId={sessionId}
  userId={userId}
  currentGesture={currentLabel}
  confidence={confidence}
  isLowConfidence={confidence < 0.5}
  isAiReply={replyWasAiGenerated}
/>
```

## Query Helpers

Located in `src/lib/supabase/queries/telemetry.ts`:

- `insertTelemetryEvent()` — server-side insert
- `listTelemetryEvents()` — list with optional event type filter
- `getTelemetrySummary()` — aggregated stats (success count, failure count, top gestures, top replies)

## Admin Dashboards

- `/admin/conversations` — shows AI reply acceptance rate, conversation quality metrics
- `/admin/analytics` — recognition success rate, low-confidence rate
- `/admin/review` — review queue powered by low-confidence + correction events

## Retention

Events are retained indefinitely for research purposes. A future cleanup job could archive events older than 12 months to a separate cold storage table.

## Privacy

Telemetry events do not contain:
- Raw video frames
- Landmark coordinates (these go to review_queue instead)
- Personal identifiable information

Only aggregated counts and event types are stored.
