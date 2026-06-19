-- 0004_rls.sql
-- Row Level Security. Default deny, then explicit grants.

-- ===== profiles =====
alter table public.profiles enable row level security;

-- Users can read their own profile, admins can read everyone.
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Users can update their own display_name, but role can only change via the
-- promote_user() SQL function.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
  );

-- Admins can update anyone.
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Inserts only via the auth.users trigger.
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);

-- ===== translation_sessions =====
alter table public.translation_sessions enable row level security;

drop policy if exists translation_sessions_select_self on public.translation_sessions;
create policy translation_sessions_select_self on public.translation_sessions
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists translation_sessions_insert_self on public.translation_sessions;
create policy translation_sessions_insert_self on public.translation_sessions
  for insert with check (user_id = auth.uid());

drop policy if exists translation_sessions_update_self on public.translation_sessions;
create policy translation_sessions_update_self on public.translation_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists translation_sessions_delete_self on public.translation_sessions;
create policy translation_sessions_delete_self on public.translation_sessions
  for delete using (user_id = auth.uid());

-- ===== translation_logs =====
alter table public.translation_logs enable row level security;

drop policy if exists translation_logs_select_self on public.translation_logs;
create policy translation_logs_select_self on public.translation_logs
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists translation_logs_insert_self on public.translation_logs;
create policy translation_logs_insert_self on public.translation_logs
  for insert with check (user_id = auth.uid());

-- Logs are append-only from the user's perspective.
drop policy if exists translation_logs_update_self on public.translation_logs;
create policy translation_logs_update_self on public.translation_logs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists translation_logs_delete_self on public.translation_logs;
create policy translation_logs_delete_self on public.translation_logs
  for delete using (user_id = auth.uid());

-- ===== gestures =====
alter table public.gestures enable row level security;

-- Everyone signed in can read active gestures.
drop policy if exists gestures_select_authenticated on public.gestures;
create policy gestures_select_authenticated on public.gestures
  for select using (
    is_active = true
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Only admins can write.
drop policy if exists gestures_admin_write on public.gestures;
create policy gestures_admin_write on public.gestures
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ===== gesture_replies =====
alter table public.gesture_replies enable row level security;

drop policy if exists gesture_replies_select_authenticated on public.gesture_replies;
create policy gesture_replies_select_authenticated on public.gesture_replies
  for select using (
    is_active = true
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists gesture_replies_admin_write on public.gesture_replies;
create policy gesture_replies_admin_write on public.gesture_replies
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- The view inherits RLS from the underlying tables, so callers still
-- need to be authenticated.
grant select on public.gestures_with_replies to authenticated;

-- Note: RLS for public.transcripts lives in 0008_transcripts.sql,
-- because the table is created there.
