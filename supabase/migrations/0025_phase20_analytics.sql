-- 0025_phase20_analytics.sql
-- Phase 20: Extended Analytics & Confidence Tracking

-- Gesture confidence analytics (daily aggregates)
create table if not exists public.gesture_confidence_daily (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  gesture_label text not null,
  total_predictions integer not null default 0,
  correct_predictions integer not null default 0,
  avg_confidence real,
  min_confidence real,
  max_confidence real,
  confusion_count jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(day, gesture_label)
);

create index if not exists gesture_confidence_daily_day_idx on public.gesture_confidence_daily(day);
create index if not exists gesture_confidence_daily_label_idx on public.gesture_confidence_daily(gesture_label);

alter table public.gesture_confidence_daily enable row level security;

drop policy if exists "Admins manage gesture confidence daily" on public.gesture_confidence_daily;
create policy "Admins manage gesture confidence daily" on public.gesture_confidence_daily
  for all using (public.is_admin());

-- Confusion pairs tracking
create table if not exists public.confusion_pairs (
  id uuid primary key default gen_random_uuid(),
  predicted_label text not null,
  actual_label text not null,
  occurrence_count integer not null default 1,
  day date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(predicted_label, actual_label, day)
);

create index if not exists confusion_pairs_predicted_idx on public.confusion_pairs(predicted_label);
create index if not exists confusion_pairs_actual_idx on public.confusion_pairs(actual_label);
create index if not exists confusion_pairs_day_idx on public.confusion_pairs(day);

alter table public.confusion_pairs enable row level security;

drop policy if exists "Admins manage confusion pairs" on public.confusion_pairs;
create policy "Admins manage confusion pairs" on public.confusion_pairs
  for all using (public.is_admin());

-- Dataset quality metrics
create table if not exists public.dataset_quality (
  id uuid primary key default gen_random_uuid(),
  gesture_label text not null,
  total_samples integer not null default 0,
  approved_samples integer not null default 0,
  rejected_samples integer not null default 0,
  pending_review integer not null default 0,
  avg_confidence real,
  class_balance_score real,
  last_updated timestamptz not null default now()
);

alter table public.dataset_quality enable row level security;

drop policy if exists "Admins manage dataset quality" on public.dataset_quality;
create policy "Admins manage dataset quality" on public.dataset_quality
  for all using (public.is_admin());

-- User analytics for personalized insights
create table if not exists public.user_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  metric_name text not null,
  metric_value jsonb not null,
  period text not null check (period in ('daily', 'weekly', 'monthly', 'all_time')),
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  unique(user_id, metric_name, period, period_start)
);

create index if not exists user_analytics_user_idx on public.user_analytics(user_id);
create index if not exists user_analytics_period_idx on public.user_analytics(period, period_start);

alter table public.user_analytics enable row level security;

drop policy if exists "Users read own analytics" on public.user_analytics;
create policy "Users read own analytics" on public.user_analytics
  for select using (auth.uid() = user_id);

drop policy if exists "Admins read all analytics" on public.user_analytics;
create policy "Admins read all analytics" on public.user_analytics
  for select using (public.is_admin());
