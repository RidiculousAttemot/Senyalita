# Database Cleanup Report

## Table Audit

| Table | Status | Notes |
|-------|--------|-------|
| `translation_sessions` | **KEEP** | Core functionality |
| `translation_logs` | **KEEP** | Core functionality |
| `transcripts` | **KEEP** | Core functionality |
| `gestures` | **KEEP** | Core functionality |
| `gesture_replies` | **KEEP** | Core functionality |
| `gestures_with_replies` (view) | **KEEP** | Core functionality |
| `gesture_reply_relationships` | **KEEP** | Conversation context |
| `feedback` | **KEEP** | User feedback |
| `feedback_summaries` | **KEEP** | Admin analytics |
| `model_metrics_daily` | **KEEP** | Admin monitoring |
| `conversation_sessions` | **KEEP** | Conversation feature |
| `conversation_messages` | **KEEP** | Conversation feature |
| `gesture_captures` | **KEEP** | Dataset collection |
| `telemetry_events` | **KEEP** | Production monitoring |
| `review_queue` | **KEEP** | Model improvement |
| `model_versions` | **KEEP** | Model tracking |
| `language_profiles` | **KEEP** | Multi-language support |
| `translations` | **KEEP** | Multi-language support |
| `gesture_knowledge_base` | **KEEP** | Admin knowledge base |
| `gesture_metadata` | **KEEP** | Gesture metadata |
| `prediction_corrections` | **KEEP** | Correction feedback |
| `training_samples` | **KEEP** | Model retraining |
| `gesture_confidence_daily` | **KEEP** | Admin daily metrics |
| `confusion_pairs` | **KEEP** | Confusion tracking |
| `dataset_quality` | **KEEP** | Dataset quality monitoring |
| `user_analytics` | **DROP** | Orphaned — no user accounts |
| `profiles` | Already dropped (0029) | — |
| `user_achievements` | Already dropped (0029) | — |
| `user_learning_progress` | Already dropped (0029) | — |
| `practice_sessions` | Already dropped (0029) | — |
| `admin_ai_conversations` | Already dropped (0029) | — |

## Orphan Tables to Drop

- `user_analytics` — survived 0029 cleanup; no user accounts, no code references

## Unused Indexes

| Index | Table | Reason |
|-------|-------|--------|
| `pred_corrections_user_idx` | prediction_corrections | User_id is now nullable; session_token is the lookup key |
| `training_samples_label_idx` | training_samples | Low query volume; covered by other indexes |
| `user_achievements_user_idx` | user_achievements | Table was dropped in 0029 |

## Unused Policies

All RLS policies were updated in migration 0029. No unused policies remain.

## Unused Functions

| Function | Reason |
|----------|--------|
| `promote_user(text)` | User accounts removed; admin managed via Supabase dashboard |
| `demote_user(text)` | User accounts removed; admin managed via Supabase dashboard |
| `handle_new_user()` | No user registration; only admins exist |
| `sync_translation_log_user()` | user_id is nullable; session_token is primary identifier |
| `sync_transcript_user()` | user_id is nullable; session_token is primary identifier |

## Unused Storage Buckets

No unused storage buckets identified. The `gesture-videos` bucket is actively used.

## Recommendations

1. **Drop** `user_analytics` table
2. **Drop** `promote_user()` and `demote_user()` functions
3. **Simplify** `handle_new_user()` trigger (no-op for admin-only system)
4. **Remove** `sync_translation_log_user()` and `sync_transcript_user()` triggers (no user_id sync needed)
5. **Drop** `pred_corrections_user_idx` index
