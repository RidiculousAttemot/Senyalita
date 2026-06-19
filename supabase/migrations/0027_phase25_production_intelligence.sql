-- 0027_phase25_production_intelligence.sql
-- Phase 25: Production Intelligence & Real-World Deployment

-- 1. Prediction corrections — user feedback loop for incorrect predictions
create table if not exists public.prediction_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  predicted_label text not null,
  corrected_label text not null,
  confidence numeric(5, 4) check (confidence between 0 and 1),
  source text check (source in ('static', 'temporal', 'hybrid', 'unknown')),
  created_at timestamptz not null default now()
);

create index if not exists pred_corrections_user_idx on public.prediction_corrections(user_id, created_at desc);
create index if not exists pred_corrections_label_idx on public.prediction_corrections(predicted_label, corrected_label);

-- 2. Training samples — approved corrections ready for model retraining
create table if not exists public.training_samples (
  id uuid primary key default gen_random_uuid(),
  original_prediction text not null,
  corrected_label text not null,
  confidence numeric(5, 4),
  source text check (source in ('correction', 'review_approval', 'admin_upload')),
  landmark_snapshot jsonb,
  review_queue_id uuid references public.review_queue(id) on delete set null,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists training_samples_label_idx on public.training_samples(corrected_label);

-- 3. Recognition source tracking — per-prediction model provenance
alter table public.translation_logs
  add column if not exists recognition_source text check (recognition_source in ('static', 'temporal', 'hybrid', 'unknown'));

-- 4. User achievements — gamification
create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null,
  title text not null,
  description text,
  category text not null check (category in ('learner', 'communication', 'contributor', 'milestone')),
  unlocked_at timestamptz not null default now(),
  unique(user_id, achievement_key)
);

create index if not exists user_achievements_user_idx on public.user_achievements(user_id);

-- Seed achievement definitions
insert into public.user_achievements (user_id, achievement_key, title, description, category)
select
  p.id, 'first_gesture', 'First Gesture', 'Recognized your first FSL gesture', 'learner'
from public.profiles p
where exists (select 1 from public.translation_logs l where l.user_id = p.id)
on conflict (user_id, achievement_key) do nothing;

-- RLS: prediction_corrections
alter table public.prediction_corrections enable row level security;
drop policy if exists "Users insert own corrections" on public.prediction_corrections;
create policy "Users insert own corrections" on public.prediction_corrections
  for insert with check (user_id = auth.uid());
drop policy if exists "Users view own corrections" on public.prediction_corrections;
create policy "Users view own corrections" on public.prediction_corrections
  for select using (user_id = auth.uid());
drop policy if exists "Admins manage all corrections" on public.prediction_corrections;
create policy "Admins manage all corrections" on public.prediction_corrections
  for all using (public.is_admin());

-- RLS: training_samples
alter table public.training_samples enable row level security;
drop policy if exists "Admins manage training samples" on public.training_samples;
create policy "Admins manage training samples" on public.training_samples
  for all using (public.is_admin());

-- RLS: user_achievements
alter table public.user_achievements enable row level security;
drop policy if exists "Users view own achievements" on public.user_achievements;
create policy "Users view own achievements" on public.user_achievements
  for select using (user_id = auth.uid());
drop policy if exists "Admins manage achievements" on public.user_achievements;
create policy "Admins manage achievements" on public.user_achievements
  for all using (public.is_admin());
