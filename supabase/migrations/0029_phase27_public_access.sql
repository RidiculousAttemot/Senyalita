-- 0029_phase27_public_access.sql
-- Phase 27: Remove end-user authentication, add anonymous session support

-- 1. Add session_token to tables that previously required user_id
alter table public.translation_sessions
  add column if not exists session_token text;

alter table public.feedback
  add column if not exists session_token text;

alter table public.conversation_sessions
  add column if not exists session_token text;

alter table public.gesture_captures
  add column if not exists session_token text;

alter table public.telemetry_events
  add column if not exists session_token text;

alter table public.prediction_corrections
  add column if not exists session_token text;

-- 2. Make user_id nullable on tables that can now be anonymous
alter table public.translation_sessions
  alter column user_id drop not null;

alter table public.translation_logs
  alter column user_id drop not null;

alter table public.transcripts
  alter column user_id drop not null;

alter table public.feedback
  alter column user_id drop not null;

alter table public.conversation_sessions
  alter column user_id drop not null;

alter table public.gesture_captures
  alter column captured_by drop not null;

alter table public.prediction_corrections
  alter column user_id drop not null;

-- 3. Update triggers to handle nullable user_id (use session_token when user_id is null)
-- translation_logs inherits from parent translation_sessions
create or replace function public.sync_translation_log_user()
returns trigger as $$
begin
  if new.user_id is null then
    new.user_id := (select user_id from public.translation_sessions where id = new.session_id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- transcripts inherits from parent translation_sessions
create or replace function public.sync_transcript_user()
returns trigger as $$
begin
  if new.user_id is null then
    new.user_id := (select user_id from public.translation_sessions where id = new.session_id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 4. Drop user-account-only tables
drop table if exists public.user_achievements cascade;
drop table if exists public.user_learning_progress cascade;
drop table if exists public.practice_sessions cascade;
drop table if exists public.user_analytics cascade;
drop table if exists public.admin_ai_conversations cascade;
drop table if exists public.profiles cascade;

-- 5. Update RLS policies for public access
-- translation_sessions: allow insert/select without auth
drop policy if exists "Users insert own sessions" on public.translation_sessions;
drop policy if exists "Users view own sessions" on public.translation_sessions;
drop policy if exists "Users update own sessions" on public.translation_sessions;
drop policy if exists "Users delete own sessions" on public.translation_sessions;
drop policy if exists "Admins manage all sessions" on public.translation_sessions;
create policy "Public insert sessions" on public.translation_sessions
  for insert with check (true);
create policy "Public view sessions" on public.translation_sessions
  for select using (true);
create policy "Admin manage sessions" on public.translation_sessions
  for all using (public.is_admin());

-- translation_logs: allow insert/select without auth
drop policy if exists "Users insert own logs" on public.translation_logs;
drop policy if exists "Users view own logs" on public.translation_logs;
drop policy if exists "Users update own logs" on public.translation_logs;
drop policy if exists "Users delete own logs" on public.translation_logs;
create policy "Public insert logs" on public.translation_logs
  for insert with check (true);
create policy "Public view logs" on public.translation_logs
  for select using (true);
create policy "Admin manage logs" on public.translation_logs
  for all using (public.is_admin());

-- transcripts: allow insert/select without auth
drop policy if exists "Users insert own transcripts" on public.transcripts;
drop policy if exists "Users view own transcripts" on public.transcripts;
drop policy if exists "Users update own transcripts" on public.transcripts;
drop policy if exists "Users delete own transcripts" on public.transcripts;
create policy "Public insert transcripts" on public.transcripts
  for insert with check (true);
create policy "Public view transcripts" on public.transcripts
  for select using (true);
create policy "Admin manage transcripts" on public.transcripts
  for all using (public.is_admin());

-- feedback: allow insert without auth
drop policy if exists "Users insert own feedback" on public.feedback;
drop policy if exists "Users view own feedback" on public.feedback;
drop policy if exists "Admins manage all feedback" on public.feedback;
create policy "Public insert feedback" on public.feedback
  for insert with check (true);
create policy "Admin manage feedback" on public.feedback
  for all using (public.is_admin());

-- conversation_sessions: allow insert/select without auth
drop policy if exists "Users insert own conversation sessions" on public.conversation_sessions;
drop policy if exists "Users view own conversation sessions" on public.conversation_sessions;
drop policy if exists "Admins manage all conversation sessions" on public.conversation_sessions;
create policy "Public insert conversation sessions" on public.conversation_sessions
  for insert with check (true);
create policy "Public view conversation sessions" on public.conversation_sessions
  for select using (true);
create policy "Admin manage conversation sessions" on public.conversation_sessions
  for all using (public.is_admin());

-- conversation_messages: allow insert/select without auth
drop policy if exists "Users insert own messages" on public.conversation_messages;
drop policy if exists "Users view own messages" on public.conversation_messages;
create policy "Public insert messages" on public.conversation_messages
  for insert with check (true);
create policy "Public view messages" on public.conversation_messages
  for select using (true);
create policy "Admin manage messages" on public.conversation_messages
  for all using (public.is_admin());

-- prediction_corrections: allow insert without auth
drop policy if exists "Users insert own corrections" on public.prediction_corrections;
drop policy if exists "Users view own corrections" on public.prediction_corrections;
drop policy if exists "Admins manage all corrections" on public.prediction_corrections;
create policy "Public insert corrections" on public.prediction_corrections
  for insert with check (true);
create policy "Admin manage corrections" on public.prediction_corrections
  for all using (public.is_admin());

-- telemetry_events: allow insert without auth
drop policy if exists "Users insert telemetry events" on public.telemetry_events;
drop policy if exists "Admins view telemetry events" on public.telemetry_events;
create policy "Public insert telemetry" on public.telemetry_events
  for insert with check (true);
create policy "Admin view telemetry" on public.telemetry_events
  for select using (public.is_admin());

-- gesture_captures: admin-only (already correct)
-- review_queue: admin-only (already correct)
-- training_samples: admin-only (already correct)

-- 6. Drop the is_admin function reference in profiles (replaced by auth.users.app_metadata)
-- The public.is_admin() function is still needed by remaining RLS policies.
-- Update it to check auth.users.raw_app_meta_data instead of profiles table.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
    and raw_app_meta_data->>'role' = 'admin'
  );
$$;
