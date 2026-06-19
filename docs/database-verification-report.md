# Database Verification Report — SignLangVisual

**Project:** SignLangVisual
**Supabase project:** `tfhpcbasfugqaimcoios`
**PostgreSQL:** 17.6 (aarch64-unknown-linux-gnu)
**Pooler region:** `aws-1-ap-northeast-2` (Seoul) — port 6543
**Verified on:** 2026-06-07
**Phase:** 6.1 — Database Provisioning

This report consolidates the audit, migration, RLS, and storage verification
for the live Supabase project. The supporting documents are:

- `docs/database-audit.md` — schema, RLS, and storage audit (raw JSON:
  `docs/database-audit.json`).
- `docs/rls-policy-report.md` — full policy matrix and bodies.
- `docs/storage-verification-report.md` — bucket + storage policy verification.
- `docs/supabase-setup.md` — how the project was provisioned and how to
  re-provision from scratch.
- `docs/database-schema.md` — ERD and relationship notes.

## 1. Audit results

A live audit was run **before** applying any migrations and **after** applying
the full set. The pre-migration database was empty: zero tables in the `public`
schema, zero functions, zero buckets. The post-migration database has the full
schema described below. (See `docs/database-audit.md` for the full table.)

## 2. Tables created

All 6 application tables are present in `public`:

| Table | Rows | Notes |
| --- | ---: | --- |
| `profiles` | 0 | 1:1 with `auth.users`; trigger `handle_new_user` |
| `translation_sessions` | 0 | 1:N from profiles |
| `translation_logs` | 0 | 1:N from sessions; `user_id` synced by trigger |
| `transcripts` | 0 | append-only; `user_id` synced by trigger |
| `gestures` | 36 | 26 alphabet (seed) + 10 phrase (post-seed) |
| `gesture_replies` | 40 | 4 per phrase gesture; `video_path` is NULL for all (no videos uploaded yet) |

Trigger coverage:

| Trigger | Table | Function |
| --- | --- | --- |
| `on_auth_user_created` | `auth.users` | `public.handle_new_user` → inserts into `profiles` |
| `set_updated_at` | `profiles` | `public.touch_updated_at` |
| `set_updated_at` | `gestures` | `public.touch_updated_at` |
| `translation_logs_sync_user` | `translation_logs` | `public.sync_translation_log_user` |
| `transcripts_sync_user` | `transcripts` | `public.sync_transcript_user` |

## 3. Columns added

Each table's columns are listed in `docs/database-audit.md`. All NOT NULL
columns have defaults; the application never has to write a literal `now()` or
`gen_random_uuid()`.

Notable column-level guarantees:

- `gestures.label` is `UNIQUE` (enforced by the `gestures_label_key` index).
- `gestures.video_path` is nullable — gestures can exist without a reference
  video.
- `translation_logs.confidence` and `inference_time_ms` are `numeric` so
  confidence values from the BiLSTM model (which can be >1 if un-normalized)
  fit without overflow.

## 4. RLS policies created

20 policies across the 6 tables, plus 4 storage policies. Full bodies in
`docs/rls-policy-report.md`. Highlights:

- **Default deny**: every table has RLS enabled and no permissive fallback
  (`rls_forced = false` but `rls_enabled = true`, so the table owner would
  also be denied without explicit policies).
- **Self-or-admin SELECT** on all user-scoped tables: users see their own
  rows, admins see everything.
- **Admin-only writes** on `gestures` and `gesture_replies`: a single
  `*_admin_write` policy with `cmd = ALL` covers INSERT / UPDATE / DELETE.
- **Public read** on the `gesture-videos` storage bucket so the camera page
  can render reference videos without an auth round-trip.
- **Role immutability for users**: `profiles_update_self` re-asserts the
  current role in `with_check`, so a user cannot promote themselves by
  sending `{ role: 'admin' }` in an update.

## 5. Seed data inserted

Two seed scripts:

- `0007_seed.sql` (idempotent) — 26 alphabet gestures `a`–`z`, all with
  `is_active = true`, `display_order = 0`.
- `scripts/db-seed-gestures.mjs` (post-migration) — 10 phrase gestures with
  realistic descriptions and 4 suggested replies each (40 replies total):

  | Label | Replies |
  | --- | --- |
  | HELLO | "Hello!", "Hi there.", "Hey, good to see you.", "Greetings." |
  | THANK YOU | "You're welcome.", "No problem.", "My pleasure.", "Glad I could help." |
  | YES | "Yes.", "Absolutely.", "Sure thing.", "Definitely." |
  | NO | "No.", "Not right now.", "Sorry, I can't.", "Negative." |
  | GOOD MORNING | "Good morning!", "Morning!", "Hope you slept well.", "Have a great day." |
  | GOOD AFTERNOON | "Good afternoon.", "Hope your day is going well.", "Afternoon!", "Hello." |
  | GOOD EVENING | "Good evening.", "Hope you had a good day.", "Evening!", "Hello." |
  | PLEASE | "Please.", "If you don't mind.", "Could you…?", "Would you…?" |
  | SORRY | "I'm sorry.", "My apologies.", "I didn't mean that.", "Pardon me." |
  | HELP | "I need help.", "Please assist me.", "Can you help?", "I'm in trouble." |

Replies are inserted in `display_order` 0–3 so the camera UI lists them in
the same order shown above.

## 6. Storage verification

| Check | Result |
| --- | --- |
| Bucket `gesture-videos` exists | yes (50 MiB cap, public) |
| MIME whitelist enforced | yes — by bucket, not just the route |
| Public read works (no auth) | yes — verified by the bucket being `public` |
| Admin upload via `/api/admin/gestures/upload` | implemented; not yet exercised end-to-end (no admin user) |
| Storage policies present | 4 (read, admin insert/update/delete) |

Full details in `docs/storage-verification-report.md`.

## 7. API verification (PostgREST + Auth + RPC)

Verified via `scripts/api-verify.mjs` against the live project:

| Endpoint | Result |
| --- | --- |
| `GET /auth/v1/admin/users?per_page=10` | 200, 0 users (no one has signed up yet) |
| `GET /rest/v1/gestures?order=display_order&limit=50` | 200, 36 rows (alphabet + 10 phrase) |
| `GET /rest/v1/gesture_replies?limit=100` | 200, 40 rows |
| `GET /rest/v1/gestures_with_replies?limit=3` | 200, view works (sample gestures have 0 replies because alphabet gestures are intentionally reply-less) |
| `GET /storage/v1/bucket` | 200, `gesture-videos` present |
| `POST /rest/v1/rpc/get_admin_analytics` (with `days_back: 30`) | 400 `P0001 admin only` — **expected**; the RPC guards on `auth.uid() IS NOT NULL AND is_admin()` and there are no users yet |

The `get_admin_analytics` response is the correct behaviour: a service-role
key alone is not enough — the RPC also checks the caller's `profiles.role`.
This will return real numbers once an admin signs in and the function is
called with their JWT.

## 8. Analytics verification

The `get_admin_analytics(days_back int)` SQL function (from `0005_admin.sql`)
returns:

```jsonc
{
  "totals": {
    "users": 0,
    "sessions": 0,
    "translations": 0,
    "avg_confidence": null,
    "gestures": 36
  },
  "active_users_30d": 0,
  "top_gestures": [],
  "daily_counts": []
}
```

— or an `admin only` error if the caller is not an admin. Both responses are
expected on an empty database. The admin dashboard at `/admin/analytics`
already calls this function via `fetchAdminAnalytics(30)` and renders the
totals + top gestures + daily counts cards.

## 9. Outstanding tasks

- [ ] **Create at least one admin user.** Sign up via the app, then run
      `select promote_user('you@example.com');` from the SQL editor (the
      function is `SECURITY DEFINER` and only callable by the service role).
- [ ] **Upload reference videos** for the 10 phrase gestures via
      `/admin/gestures` (the "Edit" modal has a video upload field). The
      files will be stored at `gestures/<id>/reference.<ext>` in the
      `gesture-videos` bucket.
- [ ] **Upload custom response videos** for selected replies via
      `/admin/replies` (the "Edit" modal has a "Response video" field).
      Files land at `gestures/<gesture_id>/replies/<reply_id>/response.<ext>`.
      Replies with a video show a ▶ badge on the camera page and play the
      response video in a modal overlay when tapped.
- [ ] **End-to-end smoke test**: sign in as the admin → confirm the
      `/admin/analytics` card shows real numbers → sign in as a regular user →
      record a translation on `/camera` → confirm the session appears in
      `/history`.
- [ ] **Production deploy**: see `docs/vercel-deployment.md` for env
      configuration and model-asset placement.

## 10. How to re-provision from scratch

The migration set is idempotent. To wipe and re-apply:

```powershell
# 1. Drop and recreate the schema in the Supabase SQL editor
#    (or run a one-off `drop schema public cascade; create schema public;`).

$env:DATABASE_URL = "postgresql://postgres.tfhpcbasfugqaimcoios:<DB_PASSWORD>@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"
node scripts/db-migrate.mjs      # 8/8 OK
node scripts/db-seed-gestures.mjs
node scripts/db-audit.mjs        # writes docs/database-audit.json
node scripts/api-verify.mjs      # HTTP sanity check
```

Each script logs to `scripts/db-migrate-log.json` (for `db-migrate`) and
overwrites the audit JSON for `db-audit`. The seed script is idempotent on
`gesture_id × reply_text` via the `ON CONFLICT DO NOTHING` clause.
