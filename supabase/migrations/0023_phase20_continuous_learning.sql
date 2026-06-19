-- 0023_phase20_continuous_learning.sql
-- Phase 20: Gesture knowledge base, learning mode, analytics, recommendations

-- Part A: Gesture Knowledge Base
create table if not exists public.gesture_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  label text not null unique references public.gestures(label) on delete cascade,
  display_name text not null,
  category text not null check (category in ('alphabet', 'phrase')),
  description text,
  usage_explanation text,
  reference_video_url text,
  difficulty_level integer not null default 1 check (difficulty_level between 1 and 5),
  frequency_of_use integer not null default 0,
  common_mistakes text,
  related_gestures text[] default '{}',
  suggested_replies text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gesture_kb_category_idx on public.gesture_knowledge_base(category);
create index if not exists gesture_kb_label_idx on public.gesture_knowledge_base(label);

alter table public.gesture_knowledge_base enable row level security;

drop policy if exists "Everyone reads gesture knowledge base" on public.gesture_knowledge_base;
create policy "Everyone reads gesture knowledge base" on public.gesture_knowledge_base
  for select using (true);

drop policy if exists "Admins manage gesture knowledge base" on public.gesture_knowledge_base;
create policy "Admins manage gesture knowledge base" on public.gesture_knowledge_base
  for all using (public.is_admin());

-- Part B: Learning Progress
create table if not exists public.user_learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  gesture_label text not null,
  attempts integer not null default 0,
  successful_attempts integer not null default 0,
  last_attempt_at timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, gesture_label)
);

create index if not exists ulp_user_idx on public.user_learning_progress(user_id);
create index if not exists ulp_gesture_idx on public.user_learning_progress(gesture_label);

alter table public.user_learning_progress enable row level security;

drop policy if exists "Users read own learning progress" on public.user_learning_progress;
create policy "Users read own learning progress" on public.user_learning_progress
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own learning progress" on public.user_learning_progress;
create policy "Users insert own learning progress" on public.user_learning_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own learning progress" on public.user_learning_progress;
create policy "Users update own learning progress" on public.user_learning_progress
  for update using (auth.uid() = user_id);

-- Part C: Confusion Pairs (tracked from telemetry)
create table if not exists public.gesture_confusion_pairs (
  id uuid primary key default gen_random_uuid(),
  gesture_label text not null,
  confused_with text not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gesture_label, confused_with)
);

create index if not exists gcp_gesture_idx on public.gesture_confusion_pairs(gesture_label);

alter table public.gesture_confusion_pairs enable row level security;

drop policy if exists "Admins manage confusion pairs" on public.gesture_confusion_pairs;
create policy "Admins manage confusion pairs" on public.gesture_confusion_pairs
  for all using (public.is_admin());

-- Part H: User Analytics (personalized tracking)
create table if not exists public.user_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  total_translations integer not null default 0,
  total_conversations integer not null default 0,
  total_learning_attempts integer not null default 0,
  gestures_used text[] default '{}',
  favorite_replies text[] default '{}',
  avg_confidence real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, week_start)
);

create index if not exists ua_user_idx on public.user_analytics(user_id);
create index if not exists ua_week_idx on public.user_analytics(week_start);

alter table public.user_analytics enable row level security;

drop policy if exists "Users read own analytics" on public.user_analytics;
create policy "Users read own analytics" on public.user_analytics
  for select using (auth.uid() = user_id);

drop policy if exists "Admins read all analytics" on public.user_analytics;
create policy "Admins read all analytics" on public.user_analytics
  for select using (public.is_admin());

-- Part E: Extend review_queue source options
-- Already has source: low_confidence, user_correction, admin_flag
-- No schema change needed; consumption side handles auto-triggers

-- Seed gesture_knowledge_base entries for all 133 labels
insert into public.gesture_knowledge_base (label, display_name, category, description, difficulty_level, suggested_replies)
select
  g.label,
  g.label as display_name,
  case when length(g.label) = 1 then 'alphabet' else 'phrase' end as category,
  coalesce(g.description, '') as description,
  1 as difficulty_level,
  array_agg(gr.reply_text) filter (where gr.reply_text is not null) as suggested_replies
from public.gestures g
left join public.gesture_replies gr on gr.gesture_id = g.id
group by g.label, g.description
on conflict (label) do nothing;
