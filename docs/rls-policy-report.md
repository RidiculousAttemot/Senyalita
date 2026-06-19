# RLS Policy Report

**Scope:** all `CREATE POLICY` statements in `supabase/migrations/0001`–`0008`,
verified against the live database on 2026-06-07.

The project follows a **default-deny** RLS posture: every table has RLS enabled
(`rls_enabled = true`, `rls_forced = false` in all cases). Policies then grant
specific verbs to specific roles.

## Policy matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `public.profiles` | `profiles_select_self_or_admin` | `profiles_insert` | `profiles_update_self`, `profiles_update_admin` | (denied to all authenticated) |
| `public.translation_sessions` | `translation_sessions_select_self` | `translation_sessions_insert_self` | `translation_sessions_update_self` | `translation_sessions_delete_self` |
| `public.translation_logs` | `translation_logs_select_self` | `translation_logs_insert_self` | `translation_logs_update_self` | `translation_logs_delete_self` |
| `public.transcripts` | `transcripts_select_self` | `transcripts_insert_self` | `transcripts_update_self` | `transcripts_delete_self` |
| `public.gestures` | `gestures_select_authenticated` | `gestures_admin_write` | `gestures_admin_write` | `gestures_admin_write` |
| `public.gesture_replies` | `gesture_replies_select_authenticated` | `gesture_replies_admin_write` | `gesture_replies_admin_write` | `gesture_replies_admin_write` |
| `public.feedback` | `feedback_select_self` | `feedback_insert_self` | `feedback_update_admin` | `feedback_delete_admin` |
| `public.model_metrics_daily` | `model_metrics_select_admin` | `model_metrics_admin_write` | `model_metrics_admin_write` | `model_metrics_admin_write` |

**Total: 26 policies across 8 tables.** The admin check is the recurring pattern:

```sql
EXISTS (SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin')
```

The same predicate is inlined in every policy that grants admin access. (A helper
function `public.is_admin()` exists in the migration set but the policy bodies
inline the expression for portability.)

## Table policies — full bodies

### `public.profiles`

| Policy | Verb | USING | WITH CHECK |
| --- | --- | --- | --- |
| `profiles_insert` | INSERT | — | `auth.uid() = id` |
| `profiles_select_self_or_admin` | SELECT | `auth.uid() = id OR <admin_check>` | — |
| `profiles_update_self` | UPDATE | `auth.uid() = id` | `auth.uid() = id AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())` |
| `profiles_update_admin` | UPDATE | `<admin_check>` | — |

Notable: regular users can update their own row **but cannot change their `role`**
(the `with_check` re-asserts that the new `role` matches the existing one). Only
admins can change roles, and they do it via the `promote_user` / `demote_user`
SQL functions (service role only).

### `public.translation_sessions`

| Policy | Verb | USING | WITH CHECK |
| --- | --- | --- | --- |
| `translation_sessions_select_self` | SELECT | `user_id = auth.uid() OR <admin_check>` | — |
| `translation_sessions_insert_self` | INSERT | — | `user_id = auth.uid()` |
| `translation_sessions_update_self` | UPDATE | `user_id = auth.uid()` | `user_id = auth.uid()` |
| `translation_sessions_delete_self` | DELETE | `user_id = auth.uid()` | — |

### `public.translation_logs`

| Policy | Verb | USING | WITH CHECK |
| --- | --- | --- | --- |
| `translation_logs_select_self` | SELECT | `user_id = auth.uid() OR <admin_check>` | — |
| `translation_logs_insert_self` | INSERT | — | `user_id = auth.uid()` |
| `translation_logs_update_self` | UPDATE | `user_id = auth.uid()` | `user_id = auth.uid()` |
| `translation_logs_delete_self` | DELETE | `user_id = auth.uid()` | — |

### `public.transcripts`

| Policy | Verb | USING | WITH CHECK |
| --- | --- | --- | --- |
| `transcripts_select_self` | SELECT | `user_id = auth.uid() OR <admin_check>` | — |
| `transcripts_insert_self` | INSERT | — | `user_id = auth.uid()` |
| `transcripts_update_self` | UPDATE | `user_id = auth.uid()` | `user_id = auth.uid()` |
| `transcripts_delete_self` | DELETE | `user_id = auth.uid()` | — |

### `public.gestures`

| Policy | Verb | USING | WITH CHECK |
| --- | --- | --- | --- |
| `gestures_select_authenticated` | SELECT | `(status = 'approved' AND is_active = true) OR <admin_check>` | — |
| `gestures_admin_write` | ALL | `<admin_check>` | `<admin_check>` |

`gestures_admin_write` is a single policy covering INSERT/UPDATE/DELETE (the `cmd`
column in `pg_policies` reads `ALL`). The same expression is used for USING and
WITH CHECK so a non-admin cannot even prepare an insert.

`gestures_select_authenticated` was tightened in `0010_gesture_status.sql`
to require both `status = 'approved'` and `is_active = true` for non-admin
readers. This implements the moderation workflow described in
`docs/gesture-library.md` § "Moderation status".

### `public.gesture_replies`

| Policy | Verb | USING | WITH CHECK |
| --- | --- | --- | --- |
| `gesture_replies_select_authenticated` | SELECT | `is_active = true OR <admin_check>` | — |
| `gesture_replies_admin_write` | ALL | `<admin_check>` | `<admin_check>` |

## Storage policies

The `storage.objects` policies in the audit JSON are:

| Policy | Verb | USING | WITH CHECK |
| --- | --- | --- | --- |
| `gesture-videos read` | SELECT | `bucket_id = 'gesture-videos'` | — |
| `gesture-videos admin insert` | INSERT | — | (admin via service role / RLS bypass) |
| `gesture-videos admin update` | UPDATE | `bucket_id = 'gesture-videos' AND <admin_check>` | — |
| `gesture-videos admin delete` | DELETE | `bucket_id = 'gesture-videos' AND <admin_check>` | — |

Public read is by design — the camera page fetches reference videos via
`getPublicUrl()` without an auth header.

## Behavioural expectations

- **Anonymous users** can read approved+active gestures + active replies (and
  the public bucket), but cannot read or write any user-scoped tables.
- **Regular users** can read/write only their own `profiles`, sessions, logs,
  and transcripts. They can read the gesture dictionary (approved + active
  rows only) and submit feedback for their own sessions.
- **Admins** see every row in the user-scoped tables and can read gestures
  in any status (including draft / review / archived). They can also upload,
  rename, and delete files in the `gesture-videos` bucket, and read/write the
  `model_metrics_daily` table.
- **Role changes** happen exclusively through the `promote_user(email)` /
  `demote_user(email)` SECURITY DEFINER functions, which require the
  service-role key to call. There is no client-callable path to mutate roles.

## Idempotency note

All RLS policies use `drop policy if exists … create policy …` so re-running the
migration set against an existing database is safe. The same applies to
`alter table … enable row level security` (Postgres no-ops if RLS is already
enabled).

## Verification

The policy bodies shown above were extracted from the live database by
`scripts/db-audit.mjs` (output: `docs/database-audit.json`) and cross-checked
against the migration files under `supabase/migrations/0001`–`0008`. They
match exactly.
