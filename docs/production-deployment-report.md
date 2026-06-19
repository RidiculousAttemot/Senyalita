# Production Deployment Report

**Target platform:** Vercel (Next.js 14, App Router)
**Database:** Supabase (PostgreSQL 17.6, region `aws-1-ap-northeast-2`)
**Storage:** Supabase Storage (bucket `gesture-videos`)
**Date:** 2026-06-07
**Phase:** 7.6

## 1. Pre-deploy checklist

- [x] All migrations applied to the live database
      (0001 → 0013, see `supabase/migrations/`).
- [x] `npm run lint` — 0 warnings, 0 errors.
- [x] `npm run test -- --run` — 82/82 passing.
- [x] `npm run build` — 19 routes, no type errors.
- [x] `.env.local` populated with the live credentials.
- [x] `.env.local` is in `.gitignore` (not committed).
- [x] Model assets placed under `public/models/bilstm_v2/`.
- [x] `promote_user(email)` used to bootstrap the first admin.

## 2. Environment variables

Set the following in **Vercel → Project → Settings → Environment
Variables** (Production + Preview + Development as needed).

| Variable | Scope | Example | Source |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | `https://tfhpcbasfugqaimcoios.supabase.co` | Supabase dashboard → Project → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…` (anon JWT) | Same as above |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | `sb_publishable_…` (new format) | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | `eyJ…` (service_role JWT) | Supabase dashboard |
| `SUPABASE_SECRET_KEY` | Server only | `sb_secret_…` (new format) | Supabase dashboard |
| `NEXT_PUBLIC_SITE_URL` | Public | `https://signlangvisual.vercel.app` | Vercel project URL |
| `DATABASE_URL` | Server only | `postgresql://postgres.<ref>:<pwd>@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres` | Supabase dashboard → Database → Connection string (Transaction pooler) |

**Do NOT** commit any of these values to the repository. The
`.env.local` file is for local development only.

### 2.1 Auth URL configuration

In the Supabase dashboard, add the production URL to **Authentication →
URL Configuration → Site URL** and to **Redirect URLs**:

```
https://signlangvisual.vercel.app
https://signlangvisual.vercel.app/auth/callback
https://signlangvisual.vercel.app/**
```

This is required for the OAuth flow + email confirmation links to work.

## 3. Build settings

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Build command | `npm run build` (default) |
| Output directory | `.next` (default) |
| Install command | `npm install` (default) |
| Node.js version | 20.x |
| Region | `icn1` (Seoul) — matches the Supabase region for the lowest auth latency |

## 4. Edge runtime notes

The `useRecognition` hook dynamically imports MediaPipe Hands and
TensorFlow.js. Both libraries assume a browser environment, so all
client components that touch them must use the default Node.js runtime,
not the Edge runtime. The project already pins `runtime = "nodejs"` on
the server-only API routes and on the admin server components.

## 5. Model asset placement

The BiLSTM v2 model is served as static files from `public/`:

```
public/
└── models/
    └── bilstm_v2/
        ├── model.json         # topology + weights manifest
        ├── group1-shard1of1.bin
        └── labels.json        # class index → label
```

The app fetches the model with:

```ts
const model = await tf.loadLayersModel("/models/bilstm_v2/model.json");
```

`public/` is served from the same Vercel edge as the rest of the
bundle, so the first-load latency is just a CDN hop.

## 6. Production smoke test (Vercel preview URL)

After the first deploy, walk through the following checklist against the
preview URL. Each step has an "expected" line — anything other than the
expected is a bug.

| # | Action | Expected |
| --- | --- | --- |
| 1 | Open `/` | 200, marketing content renders |
| 2 | Open `/login` | 200, login form visible |
| 3 | Sign in with the bootstrapped admin | redirect to `/` or `/admin` |
| 4 | Open `/admin/analytics` | renders (empty state if no logs yet) |
| 5 | Open `/admin/gestures` | 36 rows (26 alphabet + 10 phrases) |
| 6 | Open `/admin/monitoring` | renders (no daily rollup yet → "No daily rollups yet" note) |
| 7 | Open `/admin/dataset` | admin-only dataset capture works |
| 8 | Open `/camera` | asks for camera permission, then shows live feed |
| 9 | Sign a single letter, observe transcript | letter appended to running transcript within 1 s |
| 10 | Click **Correct** in the feedback widget | "Thanks — your feedback is recorded" message |
| 11 | Open `/history` | new session appears, drill-down shows the log line |
| 12 | Open `/admin/gestures`, click **Approve** on a draft | status pill changes to Approved |
| 13 | `curl` the `/api/feedback` endpoint with no auth | 401 |

## 7. Observability

Phase 7 does not yet ship a production observability stack. The current
state:

| Concern | Tool | Notes |
| --- | --- | --- |
| Error tracking | none | recommend Vercel Analytics + Sentry in a follow-up |
| Performance | Vercel Web Vitals | automatic |
| Server logs | Vercel function logs | automatic |
| DB query metrics | Supabase dashboard | automatic, free tier is enough for the test window |
| Daily rollups | `scripts/db-rollup-metrics.mjs` (Phase 7.5) | not yet written — see § 8 |

## 8. Remaining work (Phase 7.6 follow-up)

The following items are **not** blockers for thesis defence but are
required before declaring the deployment "production grade":

1. **Daily metrics rollup script** (`scripts/db-rollup-metrics.mjs`).
   Should connect to the pooler, group `translation_logs` by day for the
   last 30 days, and call `upsert_model_metrics_daily(...)` for each
   day. Wire it to a Vercel cron or an external scheduler.
2. **Sentry / error reporting.** Add `@sentry/nextjs` and a DSN env var
   so unhandled errors are captured.
3. **Vercel Analytics** for the camera page to track real-user FPS and
   inference latency.
4. **Storage CORS** — confirm `gesture-videos` returns the right
   `Access-Control-Allow-Origin` header for the production domain.
5. **Rate limiting** on `/api/feedback` and the admin upload routes.
6. **Custom domain** with HTTPS (Vercel handles automatically once
   attached).

## 9. Rollback plan

If a deploy goes wrong:

1. Vercel → Deployments → click the previous successful deploy →
   **Promote to Production**.
2. No database migrations are reversible from the Vercel side; if a
   migration must be reverted, run a `down` migration manually via the
   Supabase SQL editor.
3. The application has no stateful local cache, so a code rollback
   takes effect immediately.

## 10. Sign-off

| Role | Name | Date |
| --- | --- | --- |
| Deployer | | |
| Reviewer | | |
| Thesis adviser | | |
