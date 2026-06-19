# Active Learning Workflow

## Overview

The active learning workflow enables continuous model improvement by routing low-confidence predictions, user corrections, and admin flags through a structured review pipeline. Approved samples feed directly into the retraining dataset.

## Data Flow

```
Recognition ──low conf (<0.60)──> Auto Queue ──┐
User Feedback ──incorrect mark──> Auto Queue ──┤──> Review Queue ──> Approve/Relabel/Reject ──> Training Samples ──> Retrain
Admin Flag ──manual──> Review Queue ───────────┘
```

## Review Queue Actions

### Approve Sample

- **Action**: Click "Approve" on a pending item
- **Effect**:
  - Status changes to `approved`
  - Record inserted into `training_samples` with:
    - `original_prediction` = original inference
    - `corrected_label` = original prediction (unchanged)
    - `confidence` = model confidence score
    - `source` = `'review_approval'`
    - `landmark_snapshot` = captured landmarks (if available)
  - Sample becomes available for next retraining cycle

### Reject Sample

- **Action**: Click "Reject" on a pending item
- **Effect**:
  - Status changes to `rejected`
  - No insertion into `training_samples`
  - False positives are filtered out of future analysis
  - Useful for: noisy data, incorrect auto-queues, test artifacts

### Relabel Sample

- **Action**: Click "Relabel" → system prompts for corrected label
- **Effect**:
  - Status changes to `relabeled`
  - `corrected_label` set to admin-provided value
  - Record inserted into `training_samples` with:
    - `original_prediction` = original (wrong) prediction
    - `corrected_label` = admin correction (uppercased)
    - `source` = `'review_approval'`
  - Most valuable action — captures model blind spots

## Batch Processing

Items can be grouped into review batches using `batch_id`:

```sql
-- Create a batch
UPDATE review_queue SET batch_id = 'batch-uuid' WHERE status = 'pending' LIMIT 20;

-- Review throughput calculated per batch
SELECT batch_id,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved,
  AVG(review_throughput_seconds) AS avg_seconds
FROM review_queue
GROUP BY batch_id;
```

## Throughput Measurement

| Metric | Definition | Target |
|--------|------------|--------|
| Review throughput | Items reviewed per hour | >= 20/hr |
| Review latency | Time from creation to review | < 48 hours |
| Correction rate | User corrections per 100 predictions | < 5% (lower = better model) |
| Acceptance rate | Approved + relabeled / total reviewed | >= 60% |
| Relabel accuracy | Exact match corrections / total relabeled | >= 80% |

## Correction Quality Classification

When relabeling, classify the correction quality:

| Category | Definition | Example |
|----------|------------|---------|
| `exact` | Correct label matches ground truth | `HELLO` → `HELLO` |
| `similar` | Confusable gesture class | `V` → `U` |
| `unrelated` | Completely different gesture | `HELLO` → `FATHER` |

Track correction quality over time to identify:
- Persistent confusion pairs (e.g., V/U, M/N)
- Noisy auto-queue triggers (false low-confidence)
- Signer-specific biases

## Dashboard Integration

The `/admin/review` page displays:

- **Pending count** — unprocessed items requiring admin attention
- **Throughput chart** — items reviewed per day (7-day trend)
- **Acceptance rate** — % approved vs rejected
- **Correction quality** — distribution of exact/similar/unrelated

## Auto-Queue Performance Indicators

Monitor these metrics to tune the low-confidence threshold:

| Indicator | Formula | Action if Degraded |
|-----------|---------|-------------------|
| Auto-queue precision | Approved / total auto-queued | Raise confidence threshold |
| Auto-queue recall | Low-conf predictions captured / total low-conf | Lower confidence threshold |
| User correction alignment | User corrections matching auto-queue | Improve auto-queue accuracy |

## RLS Policy

```sql
-- Admins have full access to review_queue and training_samples
CREATE POLICY "Admins manage review queue" ON public.review_queue
  FOR ALL USING (public.is_admin());

CREATE POLICY "Admins manage training samples" ON public.training_samples
  FOR ALL USING (public.is_admin());
```

## Related Tables

| Table | Purpose |
|-------|---------|
| `review_queue` | Pending/approved/rejected review items |
| `training_samples` | Approved samples for retraining |
| `prediction_corrections` | Raw user correction events |
| `translation_logs` | Source prediction data |
| `daily_performance_metrics` | Aggregated throughput and correction rates |
