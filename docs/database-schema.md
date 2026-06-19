# Database schema

Eight tables, four views, nine SQL functions, one storage bucket. All tables
have Row Level Security enabled.

## Entity-relationship diagram

```
auth.users
   │
   ├──< profiles (1:1)
   │
   ├──< translation_sessions (1:N)
   │       │
   │       └──< translation_logs (1:N)
   │       │
   │       └──< transcripts (1:N, append-only)
   │
   └──< feedback (1:N)
   │
gestures (admin-curated, no FK to users)
   │
   └──< gesture_replies (1:N)

model_metrics_daily (admin-only, no FK)
```

## Tables

### `profiles`

| Column         | Type        | Notes                                          |
| -------------- | ----------- | ---------------------------------------------- |
| `id`           | `uuid` PK   | Mirrors `auth.users.id`                        |
| `email`        | `text`      | Mirrors `auth.users.email`                     |
| `display_name` | `text?`     | User-chosen, editable in profile page          |
| `role`         | `text`      | `'user' \| 'admin'`; default `'user'`          |
| `created_at`   | `timestamptz` | Auto on insert                              |
| `updated_at`   | `timestamptz` | Auto on update (trigger)                    |

RLS: users can read all profiles, update only their own row, and cannot
insert (rows are created by the `handle_new_user()` trigger on auth signup).

### `translation_sessions`

| Column        | Type        | Notes                                            |
| ------------- | ----------- | ------------------------------------------------ |
| `id`          | `uuid` PK   | Client-generated, so the same id spans local and cloud |
| `user_id`     | `uuid` FK   | `auth.users.id`                                  |
| `source`      | `text`      | `'web' \| 'mobile'`                              |
| `started_at`  | `timestamptz` |                                              |
| `ended_at`    | `timestamptz?` | NULL while session is active                 |
| `duration_ms` | `bigint?`   | Computed on `UPDATE` of `ended_at`               |

RLS: users see/update their own sessions, admins see all.

### `translation_logs`

| Column              | Type        | Notes                                       |
| ------------------- | ----------- | ------------------------------------------- |
| `id`                | `bigserial` PK |                                         |
| `session_id`        | `uuid` FK   | `translation_sessions.id` (cascade delete)  |
| `gesture_label`     | `text`      | Predicted label, e.g. `'a'`                 |
| `confidence`        | `real`      | 0–1                                         |
| `inference_time_ms` | `real`      | Time spent in `model.predict()`             |
| `selected_reply`    | `text?`     | Reply the user picked, if any               |
| `was_custom_reply`  | `boolean`   | Whether the user typed their own reply      |
| `created_at`        | `timestamptz` | Default `now()`                           |

RLS: same pattern — join through `translation_sessions.user_id`.

### `transcripts`

| Column       | Type        | Notes                                            |
| ------------ | ----------- | ------------------------------------------------ |
| `id`         | `uuid` PK   |                                                  |
| `session_id` | `uuid` FK   | `translation_sessions.id` (cascade delete)       |
| `user_id`    | `uuid` FK   | `auth.users.id` (snapshot — survives user delete?) |
| `content`    | `text`      | Full running transcript at one point in time     |
| `created_at` | `timestamptz` | Default `now()`                              |

A `sync_transcript_user()` BEFORE INSERT trigger copies
`translation_sessions.user_id` into the new row so RLS on the
`transcripts` table itself can grant access via a single `user_id` check
without needing to join.

### `gestures`

| Column          | Type        | Notes                                            |
| --------------- | ----------- | ------------------------------------------------ |
| `id`            | `uuid` PK   |                                                  |
| `label`         | `text`      | Unique, used by the model (e.g. `'a'`)           |
| `description`   | `text`      | Human-readable, shown on camera + admin pages    |
| `video_path`    | `text?`     | Storage object path under `gesture-videos/`      |
| `thumbnail_path`| `text?`     | Storage object path                              |
| `is_active`     | `boolean`   | Toggle in admin; inactive gestures are filtered  |
| `status`        | `text`      | `'draft' \| 'review' \| 'approved' \| 'archived'` (default `'approved'`) — moderation status. Only `status='approved' AND is_active=true` is visible to non-admins. |
| `display_order` | `int`       | For sorting in the UI                            |
| `created_at`    | `timestamptz` |                                              |
| `updated_at`    | `timestamptz` |                                              |

### `gesture_replies`

| Column          | Type        | Notes                                            |
| --------------- | ----------- | ------------------------------------------------ |
| `id`            | `uuid` PK   |                                                  |
| `gesture_id`    | `uuid` FK   | `gestures.id` (cascade delete)                   |
| `reply_text`    | `text`      | The phrase the camera can speak or insert        |
| `display_order` | `int`       |                                                  |
| `is_active`     | `boolean`   |                                                  |
| `video_path`    | `text?`     | Optional storage object path under `gesture-videos/gestures/<gesture_id>/replies/<reply_id>/response.<ext>`; rendered as a custom response video on the camera page |
| `created_at`    | `timestamptz` |                                              |

## Views

### `gestures_with_replies`

```sql
CREATE VIEW gestures_with_replies AS
SELECT g.*, COALESCE(json_agg(...) FILTER (…), '[]') AS replies
FROM gestures g LEFT JOIN gesture_replies r ON r.gesture_id = g.id
GROUP BY g.id;
```

Returns the same row as `gestures` plus a `replies: Array<{id, reply_text,
display_order}>` column. Use this view from client code so you get both
in one RLS check.

## Functions

### `promote_user(p_email text)`

`SECURITY DEFINER`. Sets `profiles.role = 'admin'` for the user with the
matching email. Only callable by `service_role`.

### `demote_user(p_email text)`

Mirror of `promote_user`.

### `get_admin_analytics(p_days_back int default 30)`

Returns:

```ts
{
  totals: {
    users, sessions, translations, avg_confidence, avg_inference_ms
  },
  recognition: {
    total, today, this_week, this_month, low_confidence_rate
  },
  top_gestures:  Array<{ label, count, avg_confidence }>,
  top_replies:   Array<{ reply_text, count }>,
  users: {
    total, active_30d, sessions_per_user, avg_session_duration_ms
  },
  daily_counts:  Array<{ day, count }>,
  active_users_30d: number
}
```

Admin-only (raises `'admin only'` if the caller's `profiles.role` is not
`'admin'`). Used by `/admin/analytics` and `/admin` (overview).

### `get_model_metrics_daily(p_days_back int default 30)`

Returns `Array<{ day, total_predictions, low_confidence_count,
unknown_count, avg_confidence, avg_inference_ms, failure_rate }>` for
the last `p_days_back` days. Admin-only. Used by `/admin/monitoring`.

### `upsert_model_metrics_daily(...)`

`SECURITY DEFINER`. Idempotent upsert keyed on `day`. Called by a
service-role client after running the daily rollup.

### `feedback` table

| Column        | Type        | Notes                                            |
| ------------- | ----------- | ------------------------------------------------ |
| `id`          | `uuid` PK   |                                                  |
| `user_id`     | `uuid` FK   | `auth.users.id` (cascade delete)                 |
| `session_id`  | `uuid?` FK  | `translation_sessions.id` (set null on delete)   |
| `gesture_label`| `text`     | The label the user is rating                     |
| `rating`      | `text`      | `'correct' \| 'incorrect'` (CHECK constraint)    |
| `comment`     | `text?`     | Optional free-form note                          |
| `created_at`  | `timestamptz` | Default `now()`                              |

RLS: users insert their own row (`user_id = auth.uid()`), read their own
+ admin reads all. Updates/deletes are admin-only.

### `model_metrics_daily` table

| Column                 | Type        | Notes                                       |
| ---------------------- | ----------- | ------------------------------------------- |
| `id`                   | `uuid` PK   |                                             |
| `day`                  | `date`      | Unique                                       |
| `total_predictions`    | `int`       |                                             |
| `low_confidence_count` | `int`       | Predictions with `confidence < 0.6`         |
| `unknown_count`        | `int`       | Predictions outside the trained label set   |
| `avg_confidence`       | `numeric?`  |                                             |
| `avg_inference_ms`     | `numeric?`  |                                             |
| `failure_rate`         | `numeric?`  | `(low_confidence + unknown) / total`        |
| `updated_at`           | `timestamptz` |                                         |

RLS: admin-only read + write.

## Storage

### `gesture-videos` bucket

- Public read (`anon` + `authenticated`)
- Write restricted to `service_role`
- Used to store MP4/WebM reference videos uploaded by admins from
  `/admin/gestures` and per-reply response videos from `/admin/replies`
- Object layout:
  - `gestures/<gesture_id>/reference.<ext>` — gesture reference video
  - `gestures/<gesture_id>/replies/<reply_id>/response.<ext>` — reply response video

## Indexes

- `translation_sessions(user_id, started_at DESC)` — own-sessions list
- `translation_logs(session_id, created_at DESC)` — per-session detail
- `transcripts(session_id, created_at DESC)` — same
- `gestures(is_active, display_order)` — library list

## Row counts at deployment

| Table                  | Count (typical) |
| ---------------------- | --------------- |
| `profiles`             | 0–1000          |
| `translation_sessions` | 0–10000         |
| `translation_logs`     | 0–500k          |
| `transcripts`          | 0–10000         |
| `gestures`             | 26 (alphabet)   |
| `gesture_replies`      | 0–100; 40 with seed phrases |
| `feedback`             | 0–1000 (per user, per session) |
| `model_metrics_daily`  | 0–365 (one row per UTC day)  |
