-- 0023_phase20_gesture_metadata.sql
-- Phase 20: Gesture Knowledge Base — extended gesture metadata

create table if not exists public.gesture_metadata (
  id uuid primary key default gen_random_uuid(),
  gesture_label text not null unique,
  display_name text not null,
  category text not null check (category in ('alphabet', 'phrase', 'number', 'emotion', 'action', 'question', 'greeting', 'courtesy')),
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  description text,
  usage_explanation text,
  reference_video_url text,
  thumbnail_url text,
  frequency_rank integer,
  common_mistakes text[],
  related_gestures text[],
  suggested_replies text[],
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gesture_metadata_category_idx on public.gesture_metadata(category);
create index if not exists gesture_metadata_difficulty_idx on public.gesture_metadata(difficulty);

alter table public.gesture_metadata enable row level security;

drop policy if exists "Everyone reads gesture metadata" on public.gesture_metadata;
create policy "Everyone reads gesture metadata" on public.gesture_metadata
  for select using (true);

drop policy if exists "Admins manage gesture metadata" on public.gesture_metadata;
create policy "Admins manage gesture metadata" on public.gesture_metadata
  for all using (public.is_admin());

-- Seed with existing gesture labels from gestures table
insert into public.gesture_metadata (gesture_label, display_name, category, difficulty, description, frequency_rank)
select 
  label as gesture_label,
  label as display_name,
  case 
    when label ~ '^[A-Z]$' then 'alphabet'
    else 'phrase'
  end as category,
  'beginner' as difficulty,
  'Auto-generated from gesture library' as description,
  row_number() over (order by display_order) as frequency_rank
from public.gestures
where is_active = true
on conflict (gesture_label) do nothing;
