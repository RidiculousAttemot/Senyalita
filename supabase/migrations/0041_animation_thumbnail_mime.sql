-- Allows a small preview-frame thumbnail (image/jpeg) into the same bucket
-- that already holds landmark JSON, per the thumbnail_path column added in
-- 0038. The bucket was provisioned in 0039 as application/json-only, so an
-- admin-uploaded thumbnail was rejected by storage before this.
do $$
begin
  update storage.buckets
    set allowed_mime_types = array['application/json', 'image/jpeg']
    where id = 'animation-landmarks';
exception
  when insufficient_privilege then
    raise notice 'Skipped updating animation-landmarks mime types (insufficient privilege). Add image/jpeg to the bucket''s allowed MIME types via Dashboard -> Storage.';
end $$;
