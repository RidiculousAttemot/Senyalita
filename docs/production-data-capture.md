# Production Data Capture Pipeline

## Overview

The production data capture pipeline automatically ingests low-confidence predictions, user corrections, and admin flags into a structured review queue for continuous model improvement.

## Triggers

### 1. Low Confidence Auto-Queue (confidence < 0.60)

When the model produces a prediction with confidence below 0.60, the system automatically creates a `review_queue` record:

| Field | Source |
|-------|--------|
| `gesture_label` | Predicted label |
| `landmarks_data` | Empty (can be enriched by client) |
| `confidence` | Raw confidence score |
| `source` | `'low_confidence'` |
| `original_prediction` | Predicted label |
| `session_id` | Active session ID |

Trigger: `auto_queue_low_confidence_trigger` on `translation_logs` INSERT.

### 2. User Correction Auto-Queue

When a user explicitly marks a prediction as incorrect and provides the correct label, a `review_queue` record is created:

| Field | Source |
|-------|--------|
| `gesture_label` | Corrected label |
| `landmarks_data` | Empty (enrichable) |
| `confidence` | Original model confidence |
| `source` | `'user_correction'` |
| `original_prediction` | What the model predicted |
| `corrected_label` | What the user said it should be |
| `session_id` | Active session ID |

Trigger: `auto_queue_user_correction_trigger` on `prediction_corrections` INSERT.

### 3. Admin Manual Review

Admins can manually flag predictions via the `/admin/review` page for relabeling or rejection.

## Review Queue Table Schema

```sql
review_queue (
  id                      uuid PRIMARY KEY,
  gesture_label           text NOT NULL,
  landmarks_data          jsonb NOT NULL,
  confidence              real NOT NULL,
  source                  text CHECK (source IN ('low_confidence', 'user_correction', 'admin_flag')),
  original_prediction     text NOT NULL,
  corrected_label         text,
  corrected_by            uuid REFERENCES profiles(id),
  status                  text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'relabeled')),
  reviewed_by             uuid REFERENCES profiles(id),
  reviewed_at             timestamptz,
  review_notes            text,
  session_id              uuid REFERENCES conversation_sessions(id),
  review_throughput_seconds integer,
  correction_quality      text CHECK (correction_quality IN ('exact', 'similar', 'unrelated')),
  batch_id                uuid,
  created_at              timestamptz DEFAULT now()
);
```

## Ingestion Automation

### Automatic Pipeline Steps

1. **Capture** — Trigger fires on `translation_logs.confidence < 0.60` or `prediction_corrections INSERT`
2. **Queue** — Record inserted into `review_queue` with `status = 'pending'`
3. **Notify** — Admin dashboard shows pending count via real-time subscription
4. **Review** — Admin approves, relabels, or rejects
5. **Store** — Approved records move to `training_samples` table
6. **Monitor** — Throughput tracked via `reviewed_at` timestamps

### Indexes

| Index | Purpose |
|-------|---------|
| `review_queue_status_idx` | Filter by pending/approved/rejected |
| `review_queue_confidence_idx` | Sort by confidence |
| `review_queue_source_idx` | Filter by source type |
| `review_queue_created_at_idx` | Time-based queries |
| `review_queue_reviewed_at_idx` | Review latency tracking |

## Enrichment Flow

To enrich `landmarks_data` with actual landmark sequences:

1. Client captures the full `[120, 126]` landmark sequence at time of prediction
2. Client sends landmarks alongside the feedback submission
3. Server stores the data in `review_queue.landmarks_data`
4. On approval, landmarks move to `training_samples.landmark_snapshot`

## Metrics

Track capture pipeline effectiveness:

- **Ingestion rate** — reviews created per day
- **Review latency** — time from creation to review
- **Approval rate** — % of reviewed items approved
- **Correction quality** — exact vs similar vs unrelated
- **Auto-queue accuracy** — % of auto-queued items that are valid
