-- 0031_database_cleanup.sql
-- Phase 28: Database Cleanup — Remove orphan tables, unused functions, stale indexes

-- 1. Drop orphan tables that survived Phase 27 cleanup
drop table if exists public.user_analytics cascade;

-- 2. Drop unused functions (user account features removed)
drop function if exists public.promote_user(text);
drop function if exists public.demote_user(text);

-- 3. Simplify handle_new_user trigger (no-op for admin-only system)
-- The trigger still exists but does nothing since profiles table is gone.
-- Keep the function but make it a no-op to avoid breaking existing triggers.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- No-op: user profiles were removed in Phase 27.
  -- Admin accounts are managed via Supabase dashboard directly.
  return new;
end;
$$;

-- 4. Remove sync triggers that reference user_id synchronization
-- (user_id is nullable; session_token is the primary identifier)
drop trigger if exists sync_translation_log_user on public.translation_logs;
drop function if exists public.sync_translation_log_user();

drop trigger if exists sync_transcript_user on public.transcripts;
drop function if exists public.sync_transcript_user();

-- 5. Drop unused indexes
drop index if exists public.pred_corrections_user_idx;
drop index if exists public.training_samples_label_idx;

-- 6. Add session_token indexes for anonymous access patterns
create index if not exists idx_telemetry_events_token
  on public.telemetry_events (session_token);

create index if not exists idx_prediction_corrections_token
  on public.prediction_corrections (session_token);
