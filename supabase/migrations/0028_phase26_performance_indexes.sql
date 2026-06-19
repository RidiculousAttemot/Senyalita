-- 0028_phase26_performance_indexes.sql
-- Phase 26: Performance indexes for common query patterns

-- 1. Conversation message timeline queries (session view + ordering)
create index if not exists conv_messages_session_created_idx
  on public.conversation_messages(session_id, created_at);

-- 2. Translation analytics by gesture over time
create index if not exists translation_logs_label_created_idx
  on public.translation_logs(gesture_label, created_at);

-- 3. Translation analytics by recognition source
create index if not exists translation_logs_source_idx
  on public.translation_logs(recognition_source);

-- 4. Review queue filtering by source + status
create index if not exists review_queue_source_status_idx
  on public.review_queue(source, status);

-- 5. Remove duplicate index on profiles.user_id (same as PK)
drop index if exists public.profiles_user_id_idx;
