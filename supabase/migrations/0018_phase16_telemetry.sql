-- 0018_phase16_telemetry.sql
-- Phase 16: Production telemetry — aggregated metrics for real-world monitoring

create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'recognition_success',
    'recognition_failure',
    'low_confidence',
    'ai_reply_used',
    'conversation_completed',
    'session_abandoned',
    'gesture_used',
    'reply_used'
  )),
  event_data jsonb default '{}',
  user_id uuid references public.profiles(id) on delete set null,
  session_id uuid references public.conversation_sessions(id) on delete set null,
  gesture_label text,
  confidence real,
  created_at timestamptz not null default now()
);

create index if not exists telemetry_events_type_idx on public.telemetry_events(event_type);
create index if not exists telemetry_events_created_at_idx on public.telemetry_events(created_at);
create index if not exists telemetry_events_user_idx on public.telemetry_events(user_id);

alter table public.telemetry_events enable row level security;

drop policy if exists "Admins read telemetry" on public.telemetry_events;
create policy "Admins read telemetry" on public.telemetry_events
  for select using (public.is_admin());

drop policy if exists "Service role inserts telemetry" on public.telemetry_events;
create policy "Service role inserts telemetry" on public.telemetry_events
  for insert with check (true);
