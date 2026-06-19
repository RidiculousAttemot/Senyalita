-- 0011_feedback.sql
-- Real-usage feedback table. A signed-in user can attach a thumbs-up
-- / thumbs-down + optional comment to a recognized gesture so the admin
-- can spot recognition regressions.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.translation_sessions(id) on delete set null,
  gesture_label text not null,
  rating text not null check (rating in ('correct', 'incorrect')),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_idx
  on public.feedback(user_id, created_at desc);

create index if not exists feedback_gesture_idx
  on public.feedback(gesture_label);

create index if not exists feedback_rating_idx
  on public.feedback(rating, created_at desc);

alter table public.feedback enable row level security;

-- Users can read their own feedback; admins can read all.
drop policy if exists feedback_select_self on public.feedback;
create policy feedback_select_self on public.feedback
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Users can insert their own feedback; user_id must match auth.uid().
drop policy if exists feedback_insert_self on public.feedback;
create policy feedback_insert_self on public.feedback
  for insert with check (user_id = auth.uid());

-- Updates / deletes are admin-only — feedback is write-once for users.
drop policy if exists feedback_update_admin on public.feedback;
create policy feedback_update_admin on public.feedback
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists feedback_delete_admin on public.feedback;
create policy feedback_delete_admin on public.feedback
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
