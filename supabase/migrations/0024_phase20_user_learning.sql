-- 0024_phase20_user_learning.sql
-- Phase 20: User Learning Progress & Practice Mode

create table if not exists public.user_learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  gesture_label text not null references public.gesture_metadata(gesture_label) on delete cascade,
  attempts integer not null default 0,
  successful_attempts integer not null default 0,
  best_confidence real,
  last_practiced_at timestamptz,
  completed_at timestamptz,
  mastery_level text not null default 'not_started' check (mastery_level in ('not_started', 'learning', 'practicing', 'mastered', 'needs_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, gesture_label)
);

create index if not exists user_learning_progress_user_idx on public.user_learning_progress(user_id);
create index if not exists user_learning_progress_gesture_idx on public.user_learning_progress(gesture_label);
create index if not exists user_learning_progress_mastery_idx on public.user_learning_progress(mastery_level);

alter table public.user_learning_progress enable row level security;

drop policy if exists "Users read own learning progress" on public.user_learning_progress;
create policy "Users read own learning progress" on public.user_learning_progress
  for select using (auth.uid() = user_id);

drop policy if exists "Users manage own learning progress" on public.user_learning_progress;
create policy "Users manage own learning progress" on public.user_learning_progress
  for all using (auth.uid() = user_id);

drop policy if exists "Admins read all learning progress" on public.user_learning_progress;
create policy "Admins read all learning progress" on public.user_learning_progress
  for select using (public.is_admin());

-- Practice sessions for detailed tracking
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  gesture_label text not null references public.gesture_metadata(gesture_label) on delete cascade,
  attempt_number integer not null,
  confidence real not null,
  recognized_label text,
  was_correct boolean not null,
  duration_ms integer,
  landmarks_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists practice_sessions_user_idx on public.practice_sessions(user_id);
create index if not exists practice_sessions_gesture_idx on public.practice_sessions(gesture_label);
create index if not exists practice_sessions_created_idx on public.practice_sessions(created_at);

alter table public.practice_sessions enable row level security;

drop policy if exists "Users read own practice sessions" on public.practice_sessions;
create policy "Users read own practice sessions" on public.practice_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own practice sessions" on public.practice_sessions;
create policy "Users insert own practice sessions" on public.practice_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "Admins read all practice sessions" on public.practice_sessions;
create policy "Admins read all practice sessions" on public.practice_sessions
  for select using (public.is_admin());
