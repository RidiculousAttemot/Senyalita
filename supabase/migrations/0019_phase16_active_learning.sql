-- 0019_phase16_active_learning.sql
-- Phase 16: Active learning pipeline — review queue for AI-assisted dataset improvement

create table if not exists public.review_queue (
  id uuid primary key default gen_random_uuid(),
  gesture_label text not null,
  landmarks_data jsonb not null,
  confidence real not null,
  source text not null check (source in ('low_confidence', 'user_correction', 'admin_flag')),
  original_prediction text not null,
  corrected_label text,
  corrected_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'relabeled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  session_id uuid references public.conversation_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists review_queue_status_idx on public.review_queue(status);
create index if not exists review_queue_created_at_idx on public.review_queue(created_at);

alter table public.review_queue enable row level security;

drop policy if exists "Admins manage review queue" on public.review_queue;
create policy "Admins manage review queue" on public.review_queue
  for all using (public.is_admin());
