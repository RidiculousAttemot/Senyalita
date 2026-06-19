-- 0006_storage.sql
-- Storage bucket for FSL demonstration videos (admin uploads only).
--
-- Run AFTER enabling the storage extension in the Supabase dashboard.
-- This migration is idempotent: it creates the bucket if it does not
-- exist and is safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gesture-videos',
  'gesture-videos',
  true,
  52428800,  -- 50 MB
  array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS: only admins can write; everyone signed in can read.
drop policy if exists "gesture-videos read" on storage.objects;
create policy "gesture-videos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'gesture-videos');

drop policy if exists "gesture-videos admin insert" on storage.objects;
create policy "gesture-videos admin insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gesture-videos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "gesture-videos admin update" on storage.objects;
create policy "gesture-videos admin update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'gesture-videos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "gesture-videos admin delete" on storage.objects;
create policy "gesture-videos admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'gesture-videos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
