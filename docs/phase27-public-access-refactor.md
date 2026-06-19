# Phase 27 — Simplified Public Access Architecture (Admin-Only Authentication)

## Architecture

```
PUBLIC USERS
↓
No Login Required
↓
Translate / Converse / Learn

ADMINS
↓
Authenticated via /admin/login
↓
Manage System
```

## Changes Summary

### User-Facing Changes

| Before | After |
|--------|-------|
| Landing page: "Get Started" → /register | Landing page: "Start Translating" → /translate |
| Landing page: "Login" button | Landing page: "Learn FSL" button |
| Footer: Login + Contact links | Footer: Translate + Admin Login links |
| Users required to sign up | No account needed |
| Login/register required for translate | Open camera immediately |
| Profile page for account management | No profile |
| Dashboard for learning progress | Sidebar navigation only |
| Settings page for preferences | App-level defaults |
| Auth check on /conversation | Fully open access |

### Admin Changes

| Before | After |
|--------|-------|
| `/login` (public + admin) | `/admin/login` (admin only) |
| Admin uses `profiles` table for role | Admin uses `auth.users.app_metadata` for role |
| Users page shows all profiles | Users page shows auth users (Supabase admin API) |
| Admin overview shows user count | Admin overview shows session metrics only |

### Privacy Impact

- **No user data stored** — All personal data collection removed
- **Recognition stays on-device** — Camera data never leaves the browser
- **Session data is local** — IndexedDB for history, no cloud sync
- **No email collection** — No registration means no email addresses
- **No profiles** — No display names, avatars, or preferences stored

## Deliverables

| Document | Description |
|----------|-------------|
| `docs/auth-removal-audit.md` | Database table classification (KEEP/REFACTOR/REMOVE) |
| `docs/privacy-first-architecture.md` | Privacy design principles and data flow |
| `docs/public-access-refactor-results.md` | Removed code, routes, tables inventory |
| `supabase/migrations/0029_phase27_public_access.sql` | Schema migration |

## Verification

| Check | Status |
|-------|--------|
| `npm run lint` | ✅ Pass (pre-existing warnings only) |
| `npm test` | ✅ 163/163 pass |
| `npm run build` | ✅ Zero errors |
| `npx tsc --noEmit` | ✅ Zero errors |
