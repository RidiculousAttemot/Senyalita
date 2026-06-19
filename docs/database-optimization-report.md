# Database Optimization Report

## Table Audit

| Table | Size (est.) | Indexes | RLS Enabled | Notes |
|-------|------------|---------|-------------|-------|
| `profiles` | Small | Primary key, user_id | Yes | Well-indexed |
| `translation_sessions` | Medium | Primary key, user_id, created_at | Yes | Good |
| `translation_logs` | **Large** | Primary key, user_id+created_at, gesture_label | Yes | **Heaviest table** |
| `conversation_sessions` | Small | Primary key, user_id | Yes | Good |
| `conversation_messages` | Medium | Primary key, session_id | Yes | Could use session_id+created_at |
| `feedback` | Small | Primary key, user_id | Yes | Good |
| `gesture_definitions` | Small | Primary key | Yes | Static data |
| `gesture_reply_relationships` | Small | Primary key, gesture_label | Yes | Good |
| `review_queue` | Small | Primary key, status | Yes | Good |
| `training_samples` | Small | Primary key, corrected_label | Yes | Good |
| `prediction_corrections` | Small | Primary key, user_id+created_at, label | Yes | Good |
| `user_achievements` | Small | Primary key, user_id | Yes | Good |
| `telemetry_events` | Medium | Primary key, event_type+created_at | Yes | Good |
| `model_versions` | Small | Primary key | Yes | Good |

## Missing Indexes

| Table | Recommended Index | Purpose |
|-------|------------------|---------|
| `conversation_messages` | `(session_id, created_at)` | Faster timeline queries |
| `translation_logs` | `(gesture_label, created_at)` | Analytics queries |
| `translation_logs` | `(recognition_source)` | Source breakdown queries |
| `review_queue` | `(source, status)` | Filter by source type |

## Slow Query Identification

Based on typical admin page queries:

### 1. Admin Analytics Page
- **Query:** `SELECT * FROM translation_logs WHERE created_at >= $1`
- **Problem:** Full table scan on `created_at` without index
- **Fix:** Add `(created_at)` or `(user_id, created_at)` index

### 2. Coverage Dashboard
- **Query:** Multiple concurrent queries joining gestures, reply_relationships, and knowledge_base
- **Problem:** N+1 pattern — 6 separate queries when 2-3 would suffice
- **Fix:** Use a single query with joins

### 3. System Health Page
- **Query:** 8 concurrent Supabase queries
- **Problem:** Page load depends on slowest query
- **Fix:** Consider materialized view for dashboard metrics

## Duplicate Indexes

| Table | Index | Note |
|-------|-------|------|
| `profiles` | Primary key + `profiles_user_id_idx` | `user_id` is the same as `id` (PK) — **duplicate** |

## Migration Recommendations

### Migration 0028: Performance Indexes

```sql
-- Improve conversation message timeline queries
CREATE INDEX IF NOT EXISTS conv_messages_session_created_idx 
  ON public.conversation_messages(session_id, created_at);

-- Improve translation analytics queries
CREATE INDEX IF NOT EXISTS translation_logs_label_created_idx 
  ON public.translation_logs(gesture_label, created_at);

-- Improve source breakdown queries
CREATE INDEX IF NOT EXISTS translation_logs_source_idx 
  ON public.translation_logs(recognition_source);

-- Improve review queue filtering
CREATE INDEX IF NOT EXISTS review_queue_source_status_idx 
  ON public.review_queue(source, status);

-- Remove duplicate profile index
DROP INDEX IF EXISTS public.profiles_user_id_idx;
```

## RPC Function Audit

| Function | Usage | Status |
|----------|-------|--------|
| `get_admin_analytics()` | Admin analytics page | **Active** |
| `get_model_metrics_daily()` | Model monitoring page | **Active** |
| `increment_conv_message_count()` | Conversation message creation | **Active** |
| `is_admin()` | RLS policies | **Active** |

All RPC functions are actively used and appear well-optimized.
