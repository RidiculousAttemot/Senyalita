# Auth Removal Audit — Database Table Classification

## Classification Summary

| Category | Count |
|----------|-------|
| **KEEP** | 17 tables/views |
| **REFACTOR** | 9 tables |
| **REMOVE** | 6 tables |

---

## KEEP (No user FK — reference/admin/aggregate data)

| Table | Reason |
|-------|--------|
| `gestures` | 133 FSL label definitions |
| `gesture_replies` | Suggested replies per gesture |
| `gestures_with_replies` (VIEW) | Read-only join view |
| `gesture_reply_relationships` | Context-aware reply suggestions |
| `model_metrics_daily` | Aggregated daily model metrics |
| `model_versions` | Model version metadata |
| `language_profiles` | Multi-language framework |
| `translations` | Multi-language translation entries |
| `gesture_metadata` | Gesture enrichment |
| `gesture_knowledge_base` | Gesture enrichment metadata |
| `gesture_confusion_pairs` | Aggregate confusion tracking |
| `gesture_confidence_daily` | Aggregate daily confidence |
| `confusion_pairs` | Aggregate confusion pairs |
| `dataset_quality` | Aggregate dataset quality |
| `feedback_summaries` | AI-generated summaries |
| `training_samples` | ML training data (admin attribution only) |
| `conversation_messages` | No direct user FK; auth via parent session |

---

## REFACTOR (Convert user_id → session_token)

| Table | Current User FK | Change |
|-------|----------------|--------|
| `translation_sessions` | `user_id` NOT NULL → profiles | Add `session_token`, make `user_id` nullable |
| `translation_logs` | `user_id` NOT NULL (via trigger) | Inherit `session_token` from session |
| `transcripts` | `user_id` NOT NULL (via trigger) | Inherit `session_token` from session |
| `feedback` | `user_id` NOT NULL → profiles | Add `session_token`, make `user_id` nullable |
| `conversation_sessions` | `user_id` NOT NULL → profiles | Add `session_token`, make `user_id` nullable |
| `gesture_captures` | `captured_by` NOT NULL → profiles | Add `session_token`, make `captured_by` nullable |
| `telemetry_events` | `user_id` nullable → profiles | Already nullable; add `session_token` |
| `review_queue` | `corrected_by`/`reviewed_by` nullable → profiles | Admin attribution, make FKs nullable without session_token |
| `prediction_corrections` | `user_id` NOT NULL → profiles | Add `session_token`, make `user_id` nullable |

---

## REMOVE (Purely user-account related)

| Table | User FK | Content |
|-------|---------|---------|
| `profiles` | `id` = `auth.users.id` (1:1) | User profile, email, role, display name |
| `user_learning_progress` | `user_id` NOT NULL | Per-user gesture practice progress |
| `practice_sessions` | `user_id` NOT NULL | Per-user practice session details |
| `user_analytics` | `user_id` NOT NULL | Per-user weekly analytics rollup |
| `user_achievements` | `user_id` NOT NULL | Gamification badges |
| `admin_ai_conversations` | `admin_id` NOT NULL | Admin AI assistant chat |

---

## RLS Policy Impact

- `auth.uid()` references: **42 occurrences** across 12 migrations
- `public.is_admin()` references: **24 occurrences** across 10 migrations
- All `auth.uid()` policies for public tables will be removed
- `public.is_admin()` policies will be preserved for admin tables
