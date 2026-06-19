# Final Database Audit

## Audit Date

2026-06-08

## Tables

### `profiles`

| Check | Status |
|-------|--------|
| Table exists | ✅ |
| Primary key (id → auth.users) | ✅ |
| RLS enabled | ✅ |
| `handle_new_user()` trigger | ✅ |
| `touch_updated_at()` trigger | ✅ |
| Index on `role` | ✅ |
| Index on `created_at` | ✅ |
| Row count | |

### `gestures`

| Check | Status |
|-------|--------|
| Table exists | ✅ |
| Primary key (uuid) | ✅ |
| RLS enabled | ✅ |
| Unique constraint on `label` | ✅ |
| Status check constraint (draft/review/approved/archived) | ✅ |
| Index on `is_active` | ✅ |
| Index on `status` | ✅ |
| Index on `display_order` | ✅ |
| Row count | 133 (post-migration) |

### `gesture_replies`

| Check | Status |
|-------|--------|
| Table exists | ✅ |
| Primary key (uuid) | ✅ |
| RLS enabled | ✅ |
| Foreign key → gestures(id) | ✅ |
| Index on `gesture_id` | ✅ |
| Index on `is_active` | ✅ |
| Row count | 339+ (post-seed) |

### `translation_sessions`

| Check | Status |
|-------|--------|
| Table exists | ✅ |
| Primary key (uuid) | ✅ |
| RLS enabled | ✅ |
| Index on `user_id` | ✅ |
| Index on `started_at` | ✅ |

### `translation_logs`

| Check | Status |
|-------|--------|
| Table exists | ✅ |
| Primary key (uuid) | ✅ |
| RLS enabled | ✅ |
| Index on `session_id` | ✅ |
| Index on `user_id` | ✅ |
| Index on `created_at` | ✅ |
| Index on `gesture_label` | ✅ |
| Partitioning | (future) |

### `transcripts`

| Check | Status |
|-------|--------|
| Table exists | ✅ |
| Primary key (uuid) | ✅ |
| RLS enabled | ✅ |
| Index on `session_id` | ✅ |
| Index on `user_id` | ✅ |
| Row-count trigger | ✅ |

### `feedback`

| Check | Status |
|-------|--------|
| Table exists | ✅ |
| Primary key (uuid) | ✅ |
| RLS enabled | ✅ |
| Index on `user_id` | ✅ |
| Index on `gesture_label` | ✅ |

### `model_metrics_daily`

| Check | Status |
|-------|--------|
| Table exists | ✅ |
| Primary key (day) | ✅ |
| RLS enabled | ✅ |
| Row count | (populated by rollup script) |

## Views

### `gestures_with_replies`

| Check | Status |
|-------|--------|
| View exists | ✅ |
| Returns expected columns | ✅ |

## Functions

| Function | Type | Status |
|----------|------|--------|
| `handle_new_user()` | Trigger | ✅ |
| `touch_updated_at()` | Trigger | ✅ |
| `promote_user(email)` | SECURITY DEFINER | ✅ |
| `demote_user(email)` | SECURITY DEFINER | ✅ |
| `get_admin_analytics()` | Stable | ✅ |
| `get_model_metrics_daily()` | Stable | ✅ |
| `upsert_model_metrics_daily()` | VOLATILE | ✅ |

## RLS Policies

| Table | Policy | Status |
|-------|--------|--------|
| profiles | User reads own row | ✅ |
| profiles | Admin reads all | ✅ |
| profiles | User updates own profile | ✅ |
| gestures | Admin CRUD | ✅ |
| gestures | Authenticated reads active | ✅ |
| gesture_replies | Admin CRUD | ✅ |
| gesture_replies | Authenticated reads active | ✅ |
| translation_sessions | User owns session | ✅ |
| translation_sessions | Admin reads all | ✅ |
| translation_logs | User owns logs via session | ✅ |
| translation_logs | Admin reads all | ✅ |
| transcripts | User owns entries | ✅ |
| transcripts | Admin reads all | ✅ |
| feedback | User owns feedback | ✅ |
| feedback | Admin reads all | ✅ |
| model_metrics_daily | Authenticated read only | ✅ |

## Storage

| Bucket | Public Read | Write | Max File |
|--------|-------------|-------|----------|
| `gesture-videos` | ✅ (anon + auth + service_role) | Service role only | 50MB |
