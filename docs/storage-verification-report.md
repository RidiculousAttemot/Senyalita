# Storage Verification Report

**Bucket:** `gesture-videos`
**Supabase project:** `tfhpcbasfugqaimcoios`
**Verified on:** 2026-06-07
**Migration:** `supabase/migrations/0006_storage.sql`

## Bucket configuration (live)

| Property | Value |
| --- | --- |
| `id` | `gesture-videos` |
| `name` | `gesture-videos` |
| `public` | `true` |
| `file_size_limit` | 52,428,800 bytes (50 MiB) |
| `allowed_mime_types` | `video/mp4`, `video/webm`, `video/quicktime`, `image/jpeg`, `image/png`, `image/webp` |

The bucket is created by `0006_storage.sql` and verified via the Storage HTTP API:

```text
GET https://tfhpcbasfugqaimcoios.supabase.co/storage/v1/bucket
Authorization: Bearer <service_role>
→ 200 OK
  { "id": "gesture-videos", "name": "gesture-videos", "public": true, ... }
```

## Policies on `storage.objects`

Four policies are in place for the `gesture-videos` bucket:

| Policy | Verb | Effect |
| --- | --- | --- |
| `gesture-videos read` | SELECT | Anyone (anonymous + authenticated) can read any object in the bucket. |
| `gesture-videos admin insert` | INSERT | Service role can insert objects. |
| `gesture-videos admin update` | UPDATE | Only admins (in `profiles.role = 'admin'`) can update existing objects. |
| `gesture-videos admin delete` | DELETE | Only admins can delete objects. |

The admin check is the same pattern used by table-level policies:

```sql
EXISTS (SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin')
```

## Read path (public)

The camera page displays a small reference video next to a recognized gesture. It
fetches the URL with:

```ts
const { data } = supabase.storage.from("gesture-videos").getPublicUrl(path);
// data.publicUrl  →  https://tfhpcbasfugqaimcoios.supabase.co/storage/v1/object/public/gesture-videos/<path>
```

The bucket is marked `public`, so this URL works **without** an Authorization
header. The application does not need to mint signed URLs for viewing.

## Upload path (admin only)

Uploads go through two Next.js route handlers, both behind
`requireAdmin()`:

- `POST /api/admin/gestures/upload` — gesture reference video. Stores at
  `gestures/<gesture_id>/reference.<ext>` and calls
  `updateGestureVideoPath(gesture_id, path)`.
- `POST /api/admin/replies/upload` — reply response video. Stores at
  `gestures/<gesture_id>/replies/<reply_id>/response.<ext>` and calls
  `updateReplyVideoPath(reply_id, path)`.

Both routes:

1. Read the multipart `file` field, enforce a 50 MB cap, validate the
   `Content-Type` against the bucket's allowed MIME list
   (`video/mp4 | video/webm | video/quicktime`).
2. Pick a deterministic object path under the bucket.
3. Stream the file to the bucket via the service-role Supabase client
   (with `upsert: true` so re-uploads overwrite).
4. Persist the path on the corresponding table row.

Because both routes use the service-role key, the
`gesture-videos admin insert` policy's `with_check` is satisfied even
though the user is not the bucket "owner".

## Verification steps performed

1. `GET /storage/v1/bucket` with service-role key returned the bucket metadata
   shown in the table above.
2. `GET /rest/v1/gestures?select=id,label` returned 36 rows (26 alphabet + 10
   phrase gestures). The `video_path` column is currently `NULL` for all rows;
   that is expected — the seed data only describes the gestures, it does not
   upload reference videos.
3. The four `storage.objects` policies listed above were confirmed present via
   the `pg_policies` view (output captured in `docs/database-audit.json` under
   `storage.policies`).

## Tests still outstanding

- **End-to-end upload test** through `/api/admin/gestures/upload` and
  `/api/admin/replies/upload` requires a real signed-in admin user. The
  dev environment has no users yet; this will be exercised manually once
  an admin is created (see `docs/database-verification-report.md` §
  "Outstanding tasks").
- **Public read test** (e.g. downloading a known-good object via its public
  URL) also requires a non-empty bucket, so it will be run after the first
  reference video is uploaded.

Both tests are cheap to run on demand and are documented in the verification
report.
