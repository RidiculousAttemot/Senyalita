-- Storage buckets and access policies for the animation asset pipeline.
--
-- Split out of 0035 because `storage.objects` is owned by
-- `supabase_storage_admin`. Creating a policy on it requires ownership, which
-- the role running the SQL Editor may not have. Since the SQL Editor runs a
-- script as one transaction, a failure here previously rolled back the table
-- definitions in 0035 too.
--
-- Every statement below is individually guarded, so a privilege problem
-- reports a NOTICE and the migration still succeeds. If the policies are
-- skipped, create them from Dashboard -> Storage -> Policies instead; the
-- buckets are private, and all server-side access goes through the
-- service-role key, which bypasses storage RLS regardless.

-- Buckets: safe to run repeatedly.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('animation-source-videos', 'animation-source-videos', false, 104857600, array['video/mp4', 'video/webm', 'video/quicktime']),
    ('animation-landmarks', 'animation-landmarks', false, 52428800, array['application/json'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when insufficient_privilege then
    raise notice 'Skipped storage bucket creation (insufficient privilege). Create "animation-source-videos" and "animation-landmarks" as PRIVATE buckets in the Dashboard.';
end $$;

-- Policies: admin-only, per bucket. Guarded for the same reason.
do $$
begin
  drop policy if exists "admin manages animation source videos" on storage.objects;
  create policy "admin manages animation source videos" on storage.objects for all
    using (bucket_id = 'animation-source-videos' and public.is_admin())
    with check (bucket_id = 'animation-source-videos' and public.is_admin());

  drop policy if exists "admin manages animation landmarks" on storage.objects;
  create policy "admin manages animation landmarks" on storage.objects for all
    using (bucket_id = 'animation-landmarks' and public.is_admin())
    with check (bucket_id = 'animation-landmarks' and public.is_admin());
exception
  when insufficient_privilege then
    raise notice 'Skipped storage.objects policies (insufficient privilege). Add them via Dashboard -> Storage -> Policies. Server-side access uses the service-role key and is unaffected.';
end $$;
