-- 0021_phase16_multilanguage.sql
-- Phase 16: Multi-language expansion framework — architecture readiness

create table if not exists public.language_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists language_profiles_active_idx on public.language_profiles(is_active);

alter table public.language_profiles enable row level security;

drop policy if exists "Everyone reads language profiles" on public.language_profiles;
create policy "Everyone reads language profiles" on public.language_profiles
  for select using (true);

drop policy if exists "Admins manage language profiles" on public.language_profiles;
create policy "Admins manage language profiles" on public.language_profiles
  for all using (public.is_admin());

-- Seed initial languages
insert into public.language_profiles (code, name, is_active, display_order) values
  ('en', 'English', true, 1),
  ('tl', 'Filipino', false, 2),
  ('ceb', 'Cebuano', false, 3)
on conflict (code) do nothing;

create table if not exists public.translations (
  id uuid primary key default gen_random_uuid(),
  language_code text not null references public.language_profiles(code) on delete cascade,
  gesture_label text not null,
  translated_text text not null,
  context_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(language_code, gesture_label)
);

create index if not exists translations_language_idx on public.translations(language_code);
create index if not exists translations_gesture_idx on public.translations(gesture_label);

alter table public.translations enable row level security;

drop policy if exists "Everyone reads translations" on public.translations;
create policy "Everyone reads translations" on public.translations
  for select using (true);

drop policy if exists "Admins manage translations" on public.translations;
create policy "Admins manage translations" on public.translations
  for all using (public.is_admin());
