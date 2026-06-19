-- 0017_phase15.sql
-- Phase 15 additions: gesture captures for dataset collection, model health tracking

create table if not exists public.gesture_captures (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  video_url text not null,
  captured_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists gesture_captures_label_idx on public.gesture_captures(label);
create index if not exists gesture_captures_status_idx on public.gesture_captures(status);

alter table public.gesture_captures enable row level security;

drop policy if exists "Admins manage gesture captures" on public.gesture_captures;
create policy "Admins manage gesture captures" on public.gesture_captures
  for all using (public.is_admin());
