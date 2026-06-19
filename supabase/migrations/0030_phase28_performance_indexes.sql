-- 0030_phase28_performance_indexes.sql
-- Phase 28: Performance indexes for analytics queries and session lookups

-- High priority: created_at indexes on frequently queried tables
create index if not exists idx_translation_logs_created_at
  on public.translation_logs (created_at desc);

create index if not exists idx_translation_logs_session_created
  on public.translation_logs (session_id, created_at desc);

create index if not exists idx_translation_logs_gesture_created
  on public.translation_logs (gesture_label, created_at desc);

create index if not exists idx_feedback_created_at
  on public.feedback (created_at desc);

create index if not exists idx_telemetry_events_event_created
  on public.telemetry_events (event_type, created_at desc);

create index if not exists idx_conversation_sessions_created_at
  on public.conversation_sessions (created_at desc);

-- Medium priority: equality filter indexes
create index if not exists idx_conversation_messages_session
  on public.conversation_messages (session_id);

create index if not exists idx_conversation_messages_session_created
  on public.conversation_messages (session_id, created_at asc);

create index if not exists idx_review_queue_status_created
  on public.review_queue (status, created_at desc);

create index if not exists idx_gesture_knowledge_base_label
  on public.gesture_knowledge_base (label);

create index if not exists idx_gestures_is_active
  on public.gestures (is_active);

create index if not exists idx_gesture_reply_rel_gesture_active
  on public.gesture_reply_relationships (gesture_label, is_active);

create index if not exists idx_gesture_replies_gesture
  on public.gesture_replies (gesture_id);

create index if not exists idx_transcripts_session
  on public.transcripts (session_id);

create index if not exists idx_conversation_messages_selected
  on public.conversation_messages (created_at, is_selected_reply);

create index if not exists idx_model_metrics_daily_day
  on public.model_metrics_daily (day asc);

-- session_token indexes for anonymous session lookups
create index if not exists idx_translation_sessions_token
  on public.translation_sessions (session_token);

create index if not exists idx_conversation_sessions_token
  on public.conversation_sessions (session_token);

create index if not exists idx_feedback_token
  on public.feedback (session_token);

-- Drop the now-unnecessary is_admin RPC helper that references auth.users
-- (the profiles table no longer exists, so this function was updated in 0029)
-- Keep the function as-is; it was already updated in 0029.
