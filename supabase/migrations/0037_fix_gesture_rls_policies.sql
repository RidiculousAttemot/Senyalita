-- 0037_fix_gesture_rls_policies.sql
-- Phase 27 (0029) removed public.profiles and migrated admin checks to
-- public.is_admin() which reads auth.users.raw_app_meta_data, but several
-- RLS policies created in earlier migrations still referenced public.profiles
-- directly, causing "infinite recursion detected in policy for relation
-- 'profiles'" errors when those tables are accessed by an anonymous user.

-- ===== gestures =====
drop policy if exists gestures_select_authenticated on public.gestures;
create policy gestures_select_authenticated on public.gestures
  for select using (
    (status = 'approved' and is_active = true)
    or public.is_admin()
  );

drop policy if exists gestures_admin_write on public.gestures;
create policy gestures_admin_write on public.gestures
  for all using (public.is_admin())
  with check (public.is_admin());

-- ===== gesture_replies =====
drop policy if exists gesture_replies_select_authenticated on public.gesture_replies;
create policy gesture_replies_select_authenticated on public.gesture_replies
  for select using (
    is_active = true
    or public.is_admin()
  );

drop policy if exists gesture_replies_admin_write on public.gesture_replies;
create policy gesture_replies_admin_write on public.gesture_replies
  for all using (public.is_admin())
  with check (public.is_admin());

-- ===== feedback =====
-- 0029 replaced the named feedback policies but the old ones from 0011
-- (feedback_select_self, feedback_update_admin, feedback_delete_admin)
-- were left behind because their names didn't match the DROP statements.
drop policy if exists feedback_select_self on public.feedback;
drop policy if exists feedback_update_admin on public.feedback;
drop policy if exists feedback_delete_admin on public.feedback;

-- ===== model_metrics_daily =====
drop policy if exists model_metrics_select_admin on public.model_metrics_daily;
create policy model_metrics_select_admin on public.model_metrics_daily
  for select using (public.is_admin());

drop policy if exists model_metrics_admin_write on public.model_metrics_daily;
create policy model_metrics_admin_write on public.model_metrics_daily
  for all using (public.is_admin())
  with check (public.is_admin());

-- ===== storage (gesture-videos bucket) =====
drop policy if exists "gesture-videos admin insert" on storage.objects;
create policy "gesture-videos admin insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gesture-videos'
    and public.is_admin()
  );

drop policy if exists "gesture-videos admin update" on storage.objects;
create policy "gesture-videos admin update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'gesture-videos'
    and public.is_admin()
  );

drop policy if exists "gesture-videos admin delete" on storage.objects;
create policy "gesture-videos admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'gesture-videos'
    and public.is_admin()
  );
