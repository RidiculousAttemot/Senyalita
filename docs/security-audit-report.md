# Security Audit Report

Generated: TBD — run against production environment.

---

## 1. Authentication

### Login Flow

| Check | Status | Notes |
|-------|--------|-------|
| Email/password login works | ⬜ | |
| Session persists across page reload | ⬜ | |
| Session expires after inactivity | ⬜ | Supabase default: 3600s (1hr) |
| Logout clears session | ⬜ | |
| Protected routes redirect to login | ⬜ | |
| No auth tokens exposed in client source | ⬜ | |

### Role Enforcement

| Check | Status | Notes |
|-------|--------|-------|
| Admin routes require `is_admin()` | ⬜ | Checked via `requireAdmin()` |
| Non-admin cannot access `/admin/*` | ⬜ | |
| Non-admin API calls are rejected | ⬜ | |
| Role check uses Supabase RLS | ⬜ | |

### Session Security

| Check | Status | Notes |
|-------|--------|-------|
| Session cookie is HTTP-only | ⬜ | Supabase SSR handles this |
| Session cookie is Secure | ⬜ | Requires HTTPS |
| Session cookie SameSite=Lax | ⬜ | |
| CSRF protection | ⬜ | Next.js built-in |

---

## 2. Supabase RLS Policies

### Tables

| Table | Select | Insert | Update | Delete | Notes |
|-------|--------|--------|--------|--------|-------|
| `profiles` | Own only | Trigger-based | Own only | Own only | Admins see all via `is_admin()` |
| `translation_sessions` | Own only | Own only | Own only | Own only | |
| `translation_logs` | Via session | Via session | Via session | Via session | |
| `gestures` | Public | Admin only | Admin only | Admin only | |
| `gesture_replies` | Public | Admin only | Admin only | Admin only | |
| `gesture_reply_relationships` | Public | Admin only | Admin only | Admin only | |
| `conversation_sessions` | Own only | Own only | Own only | — | Admins see all |
| `conversation_messages` | Via session | Via session | Via session | — | |
| `transcripts` | Own only | Own only | Own only | Own only | |

### Buckets

| Bucket | Public | Upload | Notes |
|--------|--------|--------|-------|
| `gesture-videos` | No | Admin only | Gesture reference videos |
| `reply-videos` | No | Admin only | Reply response videos |
| `profile-images` | Yes | Authenticated | Profile avatars |

### RLS Verification Checklist

```sql
-- Verify each table has RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'profiles', 'translation_sessions', 'translation_logs',
  'gestures', 'gesture_replies', 'gesture_reply_relationships',
  'conversation_sessions', 'conversation_messages', 'transcripts'
);

-- Verify no authenticated user can access admin data
-- This should return 0 rows for non-admin users
```

---

## 3. Storage Security

| Check | Status | Notes |
|-------|--------|-------|
| Upload MIME type validation | ⬜ | Should restrict to video/* |
| File size limits | ⬜ | Should limit to <50MB |
| Upload path randomization | ⬜ | UUID-based paths |
| Public bucket read access | ⬜ | Only for profile-images |
| No directory traversal | ⬜ | |

---

## 4. API Route Security

**Rewritten 2026-08-01** — the routes below were removed by the admin scope
reduction and no longer exist: `/api/admin/gestures`, `/api/admin/gestures/upload`,
`/api/admin/replies`, `/api/admin/replies/upload`, `/api/admin/gesture-library/import`.
`/api/admin/active-learning` also existed with `requireAdmin()` protection but
had zero callers anywhere in the app — removed as dead code rather than audited.

| Route | Method | Auth | Admin | Verified |
|-------|--------|------|-------|----------|
| `/api/admin/health` | GET | ✅ `requireAdmin()` | ✅ | Code-reviewed 2026-08-01 |
| `/api/admin/animation-assets` | GET | ✅ `requireAdmin()` | ✅ | Code-reviewed 2026-08-01 |
| `/api/admin/animation-assets/upload` | POST | ✅ `requireAdmin()` | ✅ | MIME allowlist + 100MB cap, code-reviewed |
| `/api/admin/animation-assets/[versionId]/action` | POST | ✅ `requireAdmin()` | ✅ | Code-reviewed 2026-08-01 |
| `/api/assets/dataset` | — | ✅ `requireAdmin()` | ✅ | Code-reviewed 2026-08-01 |
| `/api/ai/replies` | POST | rate-limited, public by design | — | 20 req/min, prompt-injection sanitisation |
| `/api/animations/[gloss]` | GET | public by design | — | Serves published animation JSON only |
| `/api/videos/[label]/[file]` | GET | public by design | — | Serves published reference video only |

Every admin page under `/admin/*` now calls `requireAdmin()` itself (not just
the `src/middleware.ts` role check) — see `docs/admin-dashboard-structure.md`.
`requireAdmin()` itself has unit tests: `src/lib/supabase/__tests__/profiles.test.ts`.
The admin login server action rate-limits to 5 attempts/minute
(`src/lib/supabase/actions.ts`); the legacy cookie-based admin session
(`ADMIN_PASSWORD`, `src/lib/admin-auth.ts`) has been removed.

"Verified" above means code-reviewed against the source in this repo, not a
live run against a deployed environment — the checklists below this section
still need an actual pass against production before every ⬜ can be checked.

---

## 5. Frontend Security

| Check | Status | Notes |
|-------|--------|-------|
| No API keys in client code | ⬜ | Supabase anon key is public by design |
| No secrets in bundle | ⬜ | |
| Input sanitization | ⬜ | Reply text, custom input |
| XSS prevention | ⬜ | React handles by default |
| CSP headers | ⬜ | Should be set in `next.config.js` |

---

## 6. Dependencies

| Check | Status |
|-------|--------|
| `npm audit` passes | ⬜ |
| No known critical vulnerabilities | ⬜ |
| Dependencies are up-to-date | ⬜ |

---

## 7. Environment Variables

| Variable | Required | Exposed to Client | Notes |
|----------|----------|-------------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | Public by design |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ❌ | Server-only |
| `SENTRY_DSN` | Optional | ❌ | If Sentry enabled |
| `SENTRY_AUTH_TOKEN` | Optional | ❌ | Build-time only |

---

## 8. Recommendations

1. **Add CSP headers** in `next.config.js`
2. **Add rate limiting** on API routes (e.g., `@upstash/ratelimit`)
3. **Add upload validation** in the API route (MIME type, file size)
4. **Run `npm audit`** regularly
5. **Review Supabase RLS policies** after any schema changes
6. **Enable Supabase's built-in rate limiting** for auth endpoints
7. **Monitor failed login attempts** with Supabase Auth hooks

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Security reviewer | | |
| Developer | | |
| Thesis advisor | | |
