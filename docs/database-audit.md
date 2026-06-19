# Supabase Database Audit Report

**Project:** SignLangVisual
**Supabase URL:** `https://tfhpcbasfugqaimcoios.supabase.co`
**PostgreSQL:** 17.6 on aarch64-unknown-linux-gnu
**Pooler region:** `aws-1-ap-northeast-2` (Seoul) — port 6543 (transaction)
**Audit timestamp:** 2026-06-07T15:18:47.544Z
**Script:** `scripts/db-audit.mjs`
**Raw output:** `docs/database-audit.json`

This audit is run against the live Supabase project **after** applying the 8 migrations
under `supabase/migrations/`. The state of the database is the source of truth for the
schema, RLS policies, and storage configuration used by the application.

## Summary

| Check | Result |
| --- | --- |
| Required tables present | **8/8** |
| Row-level security enabled | **8/8** tables (`rls_forced = false` in all cases) |
| Table policies defined | **26** total across all tables |
| Helper functions | **9** (auth lifecycle, admin promotion, analytics, metrics rollup) |
| Storage buckets | **1** (`gesture-videos`) |
| Storage policies | **4** (admin insert / update / delete, public read) |

## Tables

| Table | Columns | Indexes | Policies | RLS |
| --- | ---: | ---: | ---: | :---: |
| `public.profiles` | 6 | 3 | 4 | enabled |
| `public.translation_sessions` | 7 | 3 | 4 | enabled |
| `public.translation_logs` | 9 | 4 | 4 | enabled |
| `public.transcripts` | 5 | 3 | 4 | enabled |
| `public.gestures` | 10 | 4 | 2 | enabled |
| `public.gesture_replies` | 7 | 3 | 2 | enabled |
| `public.feedback` | 7 | 3 | 4 | enabled |
| `public.model_metrics_daily` | 9 | 1 | 2 | enabled |

### `public.profiles`

Holds the application user profile. Created from `auth.users` via the `handle_new_user`
trigger on signup. The `role` column defaults to `'user'`; admins are promoted via the
`promote_user(email)` SQL function.

| Column | Type | Null | Default |
| --- | --- | :---: | --- |
| `id` | uuid | NO | — (FK to `auth.users.id`) |
| `email` | text | NO | — |
| `display_name` | text | YES | NULL |
| `role` | text | NO | `'user'` |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

Policies: `profiles_insert`, `profiles_select_self_or_admin`, `profiles_update_admin`,
`profiles_update_self`. See `docs/rls-policy-report.md` for full policy bodies.

### `public.translation_sessions`

A translation session represents one user-initiated capture run on the camera page.

| Column | Type | Null | Default |
| --- | --- | :---: | --- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | NO | — |
| `started_at` | timestamptz | NO | `now()` |
| `ended_at` | timestamptz | YES | NULL |
| `duration_ms` | bigint | YES | NULL |
| `source` | text | NO | `'web'` |
| `created_at` | timestamptz | NO | `now()` |

Policies: `translation_sessions_select_self`, `translation_sessions_insert_self`,
`translation_sessions_update_self`, `translation_sessions_delete_self`.

### `public.translation_logs`

Append-only log of every confirmed gesture prediction. `user_id` is kept in sync with
the parent session via the `sync_translation_log_user` trigger.

| Column | Type | Null | Default |
| --- | --- | :---: | --- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `session_id` | uuid | NO | — |
| `user_id` | uuid | NO | (set by trigger) |
| `gesture_label` | text | NO | — |
| `confidence` | numeric | NO | — |
| `inference_time_ms` | numeric | NO | — |
| `selected_reply` | text | YES | NULL |
| `was_custom_reply` | boolean | NO | `false` |
| `created_at` | timestamptz | NO | `now()` |

Policies: `translation_logs_select_self`, `translation_logs_insert_self`,
`translation_logs_update_self`, `translation_logs_delete_self`.

### `public.transcripts`

Append-only transcript history. The latest row per session is the current running
recognized text. `user_id` is set by the `sync_transcript_user` trigger.

| Column | Type | Null | Default |
| --- | --- | :---: | --- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `session_id` | uuid | NO | — |
| `user_id` | uuid | NO | (set by trigger) |
| `content` | text | NO | — |
| `created_at` | timestamptz | NO | `now()` |

Policies: `transcripts_select_self`, `transcripts_insert_self`,
`transcripts_update_self`, `transcripts_delete_self`.

### `public.gestures`

The gesture dictionary (lookup table). RLS restricts writes to admins;
reads are open to any authenticated user for `is_active = true` AND
`status = 'approved'` rows.

| Column | Type | Null | Default |
| --- | --- | :---: | --- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `label` | text | NO | — (unique) |
| `description` | text | NO | `''` |
| `video_path` | text | YES | NULL |
| `thumbnail_path` | text | YES | NULL |
| `is_active` | boolean | NO | `true` |
| `status` | text | NO | `'approved'` |
| `display_order` | integer | NO | `0` |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

Policies: `gestures_select_authenticated`, `gestures_admin_write`.

### `public.gesture_replies`

Suggested reply strings attached to a gesture. Surfaced in the camera UI when a gesture
is recognized. Each reply may also carry a custom response video that the camera
page plays in a modal overlay when the user selects it.

| Column | Type | Null | Default |
| --- | --- | :---: | --- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `gesture_id` | uuid | NO | — |
| `reply_text` | text | NO | — |
| `display_order` | integer | NO | `0` |
| `is_active` | boolean | NO | `true` |
| `video_path` | text | YES | NULL |
| `created_at` | timestamptz | NO | `now()` |

Policies: `gesture_replies_select_authenticated`, `gesture_replies_admin_write`.

## Functions

| Name | Type | Origin |
| --- | --- | --- |
| `handle_new_user` | trigger function | `0001_profiles.sql` |
| `promote_user` | SECURITY DEFINER | `0005_admin.sql` |
| `demote_user` | SECURITY DEFINER | `0005_admin.sql` |
| `is_admin` | helper | `0004_rls.sql` |
| `touch_updated_at` | trigger function | `0001_profiles.sql` |
| `sync_translation_log_user` | trigger function | `0002_translations.sql` |
| `sync_transcript_user` | trigger function | `0008_transcripts.sql` |
| `get_admin_analytics` | SQL function (Phase 7 extended) | `0005_admin.sql`, `0013_extended_analytics.sql` |
| `get_model_metrics_daily` | SQL function | `0013_extended_analytics.sql` |
| `upsert_model_metrics_daily` | SECURITY DEFINER | `0012_model_metrics_daily.sql` |

`is_admin` is implicitly available inside RLS policy bodies (inlined as a subquery).
`promote_user(email)` and `demote_user(email)` are the only call-sites for role
changes and require the service role to execute.

## Storage

One bucket is provisioned:

| Bucket | Public | Size limit | Allowed MIME types |
| --- | :---: | ---: | --- |
| `gesture-videos` | yes | 50 MB | `video/mp4`, `video/webm`, `video/quicktime`, `image/jpeg`, `image/png`, `image/webp` |

Four storage policies are attached to the `objects` table for this bucket: public
read, admin-only insert/update/delete. See `docs/storage-verification-report.md` for
verification details.

## View: `public.gestures_with_replies`

Defined in `0003_gestures.sql`. Returns `(id, label, description, is_active,
display_order, replies jsonb)` — each row's `replies` is the array of active replies
for that gesture. RLS is inherited from the underlying tables; the `SELECT` privilege
on the view is granted to `authenticated`.

## Audit method

The `scripts/db-audit.mjs` script connects to the live database via the Supavisor
transaction pooler (`aws-1-ap-northeast-2`, port 6543) using the `pg` library and
queries:

- `information_schema.columns` and `pg_indexes` for table structure.
- `pg_policies` for the policy bodies.
- `pg_class.relrowsecurity` and `pg_class.relforcerowsecurity` for RLS status.
- `information_schema.routines` for the function list.
- `storage.buckets` and `storage.objects` policies for the storage configuration.

The complete machine-readable output lives in `docs/database-audit.json`.

## How to re-run

```powershell
$env:DATABASE_URL = "postgresql://postgres.tfhpcbasfugqaimcoios:<DB_PASSWORD>@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"
node scripts/db-audit.mjs
```

The script will overwrite `docs/database-audit.json`.
