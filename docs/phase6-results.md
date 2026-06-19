# Phase 6 — Production platform results

> Author: SignLangVisual team · Date: 2026

## Goal

Transform the research prototype from Phase 5.2 into a production-ready
communication platform with persistent user accounts, a curated gesture
library, cloud-synced history, and an admin dashboard.

## What was built

### Authentication & user accounts

- Email + password sign-up and sign-in (`/register`, `/login`)
- Password reset (forgot-password flow on the same page)
- Profile page (`/profile`) for display name + password change + sign-out
- Server-side session refresh in `src/middleware.ts`
- All routes under `/camera`, `/history`, `/profile`, `/admin` are gated
- 8-character minimum password (validated client + server via Supabase
  Auth)

### Database

- Six tables: `profiles`, `translation_sessions`, `translation_logs`,
  `transcripts`, `gestures`, `gesture_replies`
- One view: `gestures_with_replies` (one RLS check returns both gesture
  and its replies)
- Three SQL functions: `promote_user`, `demote_user`, `get_admin_analytics`
- All tables protected by Row Level Security with `is_admin()`-aware
  policies
- 26 alphabet gestures seeded by `0007_seed.sql`

### Storage

- `gesture-videos` bucket (public read, service-role write)
- 50 MB max upload size, enforced server-side in
  `/api/admin/gestures/upload/route.ts`
- Three accepted MIME types: `video/mp4`, `video/webm`, `video/quicktime`

### Hybrid logging architecture

- **Guest mode:** every prediction is written to `localStorage`. The
  camera page works fully without an account.
- **Authenticated mode:** every prediction is written to BOTH
  `localStorage` (for instant UI) AND queued for Supabase.
- **Offline mode:** if the network is down or the user is offline, the
  queue accumulates in `localStorage` and is flushed on reconnect.
- **Import-on-signin:** the first time an authenticated user opens the
  camera page, any local data from before sign-in is uploaded to
  Supabase in a single batch.
- **Deduplication:** predictions are keyed by
  `(sessionId, predictedLabel, timestamp)`. Re-syncing the same data is
  a no-op.

Tested with 65 vitest cases; 82.8% branch coverage on the logging
modules.

### Camera page

- Self-signed HTTPS via Vite dev server (Phase 5.2 carryover) so
  MediaPipe can access the camera in Chrome
- Real-time hand landmark detection (MediaPipe Hands, 2 hands, 21
  points each)
- BiLSTM v2 inference at ~10 ms/frame on a mid-range laptop
- Confidence-threshold toggle (50% / 70% / 85% / 95%)
- Top-K suggestions from the model
- **Reference video** for the recognized gesture (loaded from the
  library, with description text)
- **Suggested replies** — clickable buttons that append to the running
  transcript
- **TTS** via Web Speech API (new `src/lib/tts.ts` wrapper) — speak the
  current prediction or the entire transcript
- **Sync status badge:** Guest mode / Synced / Syncing… / Queued N /
  Offline / Sync error
- **Transcripts** are debounced (1.5 s) and deduplicated before being
  sent to Supabase

### History page

Hybrid: server-rendered initial fetch, client-side live updates via
Supabase Realtime channel.

- Guest: shows local-only data, with JSON / CSV export and clear-all
- Authenticated: shows cloud data, with per-session detail (transcript
  + prediction log) and a delete button

### Admin dashboard

Five routes under `/admin/*`, all gated by `requireAdmin()`:

| Route              | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `/admin`           | Overview cards + recent sessions + recent users        |
| `/admin/gestures`  | CRUD gestures + upload reference video                 |
| `/admin/replies`   | CRUD suggested replies (filtered by gesture)           |
| `/admin/users`     | List profiles with role pill                           |
| `/admin/analytics` | `get_admin_analytics()` results — totals, top gestures, daily counts |

Three API routes for the admin forms:

- `GET / POST / PATCH / DELETE /api/admin/gestures`
- `POST /api/admin/gestures/upload` (multipart)
- `GET / POST / PATCH / DELETE /api/admin/replies`

All gated by `requireAdmin()` server-side.

### Tests & quality

- **82 vitest tests** across 8 files, all passing
- 80%+ coverage on every utility module in `src/features/**/utils` and
  `src/lib/tts.ts`
- 0 lint errors / warnings
- Production build clean (`npm run build`)

## BiLSTM v2 (deployed model — unchanged from Phase 5.2)

| Metric               | Value     |
| -------------------- | --------- |
| Training samples     | 10,865 real MediaPipe landmarks |
| Test accuracy        | 98.15%    |
| Train accuracy       | 100.0%    |
| Validation accuracy  | 97.97%    |
| Inference time (CPU) | ~8–12 ms / frame |
| Model size           | ~1.9 MB (TensorFlow.js, layers model) |

## How to verify locally

```bash
# 1. Install
npm ci

# 2. Run unit tests
npm run test

# 3. Lint + type-check
npm run lint
npm run typecheck

# 4. Production build
npm run build

# 5. Dev server (HTTPS via Vite, see Phase 5.2 notes)
npm run dev:https
```

For the cloud features, fill in `.env.local` from `.env.example` and
apply the Supabase migrations from `docs/supabase-setup.md`.

## What's next (Phase 7 candidates)

- Mobile responsive UI (the camera page is desktop-first)
- Replace Web Speech API with a server-side TTS provider for consistent
  quality across browsers
- Word-level / sentence-level recognition (the model currently only
  outputs single characters)
- Custom gesture upload for end-users
- Real-time multi-user sessions for two-sided conversations
- Model distillation for faster mobile inference
