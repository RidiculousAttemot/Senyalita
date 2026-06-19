# Supabase setup

This project uses Supabase for authentication, the Postgres database, and
object storage of reference gesture videos.

The live project is at:

- **URL:** `https://tfhpcbasfugqaimcoios.supabase.co`
- **DB host:** `db.tfhpcbasfugqaimcoios.supabase.co:5432`
- **Database:** `postgres`

## Local environment variables

Create `.env.local` (already in `.gitignore`) with:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://tfhpcbasfugqaimcoios.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...                # from Project Settings → API
SUPABASE_SERVICE_ROLE_KEY=eyJ...                    # from Project Settings → API (server-only, NEVER expose)
NEXT_PUBLIC_SITE_URL=http://localhost:3000           # set to your production domain when deploying
```

Use `.env.example` as a template. The `service_role` key bypasses Row Level
Security and must only ever be used server-side (server actions, route
handlers, scripts). Do not commit it.

## Migrations

All schema is under `supabase/migrations/`. Apply them in numeric order from
the Supabase SQL editor (or via the `supabase` CLI):

| #  | File                            | Purpose                                                                 |
| -- | ------------------------------- | ----------------------------------------------------------------------- |
| 01 | `0001_profiles.sql`             | `profiles` table + `handle_new_user()` trigger to copy auth.users rows  |
| 02 | `0002_translations.sql`         | `translation_sessions` + `translation_logs` + view                      |
| 03 | `0003_gestures.sql`             | `gestures` + `gesture_replies` + `gestures_with_replies` view           |
| 04 | `0004_rls.sql`                  | Row Level Security policies for every table                             |
| 05 | `0005_admin.sql`                | `promote_user(email)` / `demote_user(email)` SQL functions              |
| 06 | `0006_storage.sql`              | `gesture-videos` storage bucket + public read                          |
| 07 | `0007_seed.sql`                 | 26 alphabet gesture rows (idempotent)                                   |
| 08 | `0008_transcripts.sql`          | `transcripts` table + per-user row-count trigger                       |
| 09 | `0009_reply_videos.sql`         | `gesture_replies.video_path` column + partial index                    |
| 10 | `0010_gesture_status.sql`       | `gestures.status` (draft/review/approved/archived) + tighter RLS       |
| 11 | `0011_feedback.sql`             | `feedback` table (correct/incorrect + comment) + RLS                   |
| 12 | `0012_model_metrics_daily.sql`  | `model_metrics_daily` table + `upsert_model_metrics_daily()` helper    |
| 13 | `0013_extended_analytics.sql`   | rewrites `get_admin_analytics()`; adds `get_model_metrics_daily()`      |

Re-running the migrations is safe — all `CREATE` statements use `IF NOT
EXISTS` and seed inserts use `ON CONFLICT DO NOTHING`.

## Promoting the first admin

The default role for new sign-ups is `user`. To bootstrap an admin:

1. Sign up a user through the app (or via the Supabase dashboard).
2. Open the **SQL editor** in the Supabase dashboard.
3. Run:

   ```sql
   SELECT promote_user('you@example.com');
   ```

The function is `SECURITY DEFINER` and only callable by the `service_role`,
so it cannot be abused from a client.

## Storage bucket

`gesture-videos` is created by `0006_storage.sql`:

- public read (`SELECT` to `anon`, `authenticated`, `service_role`)
- write restricted to `service_role` (admins upload via server-side route
  handler using the service-role key)

Maximum file size is 50 MB (enforced in
`/api/admin/gestures/upload/route.ts`).

## How RLS works

- Every table has `ALTER TABLE … ENABLE ROW LEVEL SECURITY`.
- Users can `SELECT/INSERT/UPDATE/DELETE` rows where `user_id = auth.uid()`
  (or via a join through `translation_sessions` for `translation_logs` and
  `transcripts`).
- Admin users (`role = 'admin'`) bypass these restrictions via
  `USING (is_admin())` policies that are `OR`-ed with the user-scoped
  policy.
- Storage objects are public read; only the service role can write.

## Verifying the setup

After applying migrations, the following should all be true:

```sql
SELECT count(*) FROM profiles;             -- 0 or more
SELECT count(*) FROM gestures;             -- 26 (seeded)
SELECT count(*) FROM translation_sessions; -- 0
SELECT count(*) FROM transcripts;          -- 0
SELECT * FROM gestures_with_replies LIMIT 3;
```

If `gestures` returns 0, re-run `0007_seed.sql`.
