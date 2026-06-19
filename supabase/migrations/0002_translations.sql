-- 0002_translations.sql
-- Translation sessions and individual log entries produced by the
-- recognition pipeline.

create table if not exists public.translation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms bigint,
  source text not null default 'web' check (source in ('web', 'mobile', 'embedded')),
  created_at timestamptz not null default now()
);

create index if not exists translation_sessions_user_idx
  on public.translation_sessions(user_id, started_at desc);

create index if not exists translation_sessions_active_idx
  on public.translation_sessions(user_id)
  where ended_at is null;

create table if not exists public.translation_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.translation_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  gesture_label text not null,
  confidence numeric(5, 4) not null check (confidence between 0 and 1),
  inference_time_ms numeric(10, 3) not null check (inference_time_ms >= 0),
  selected_reply text,
  was_custom_reply boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists translation_logs_user_idx
  on public.translation_logs(user_id, created_at desc);

create index if not exists translation_logs_session_idx
  on public.translation_logs(session_id, created_at);

create index if not exists translation_logs_label_idx
  on public.translation_logs(gesture_label);

-- A trigger that keeps translation_logs.user_id consistent with
-- translation_sessions.user_id so RLS can rely on either.
create or replace function public.sync_translation_log_user()
returns trigger
language plpgsql
as $$
begin
  select user_id into new.user_id
  from public.translation_sessions
  where id = new.session_id;
  if new.user_id is null then
    raise exception 'translation_sessions row % not found', new.session_id;
  end if;
  return new;
end;
$$;

drop trigger if exists translation_logs_sync_user on public.translation_logs;
create trigger translation_logs_sync_user
  before insert on public.translation_logs
  for each row execute function public.sync_translation_log_user();
