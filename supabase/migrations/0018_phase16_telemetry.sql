-- 0018_phase16_telemetry.sql
-- Production telemetry for real-world monitoring.
--
-- This migration intentionally does not reference profiles or conversation
-- tables. Those tables are optional or removed in the anonymous public-access
-- schema, while telemetry must remain installable on both schema versions.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and raw_app_meta_data->>'role' = 'admin'
  );
$$;

create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  user_id uuid,
  session_id uuid,
  session_token text,
  gesture_label text,
  confidence real,
  created_at timestamptz not null default now()
);

alter table public.telemetry_events
  add column if not exists session_token text;

alter table public.telemetry_events
  drop constraint if exists telemetry_events_event_type_check;

alter table public.telemetry_events
  add constraint telemetry_events_event_type_check check (event_type in (
    'recognition_success',
    'recognition_failure',
    'low_confidence',
    'ai_reply_used',
    'conversation_completed',
    'session_abandoned',
    'gesture_used',
    'reply_used',
    'translation_started',
    'translation_completed',
    'translation_failed',
    'model_loaded',
    'model_prediction',
    'admin_login',
    'retraining_started',
    'retraining_completed'
  ));

create index if not exists telemetry_events_type_idx on public.telemetry_events(event_type);
create index if not exists telemetry_events_created_at_idx on public.telemetry_events(created_at);
create index if not exists telemetry_events_user_idx on public.telemetry_events(user_id);
create index if not exists telemetry_events_session_idx on public.telemetry_events(session_id);
create index if not exists telemetry_events_session_token_idx on public.telemetry_events(session_token);

alter table public.telemetry_events enable row level security;

drop policy if exists "Admins read telemetry" on public.telemetry_events;
drop policy if exists "Admins view telemetry" on public.telemetry_events;
drop policy if exists "Service role inserts telemetry" on public.telemetry_events;
drop policy if exists "Public insert telemetry" on public.telemetry_events;

create policy "Admin view telemetry" on public.telemetry_events
  for select using (public.is_admin());

create policy "Public insert telemetry" on public.telemetry_events
  for insert with check (true);
