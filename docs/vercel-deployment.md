# Vercel deployment

SignLangVisual is a Next.js 14 (App Router) application. It deploys to
Vercel with zero configuration beyond the environment variables.

## 1. Project setup

1. Fork / push the repository to GitHub.
2. In Vercel, click **Add New… → Project**, pick the repo.
3. Framework preset: **Next.js**.
4. Build command: `next build` (default).
5. Output directory: `.next` (default).
6. Install command: `npm ci` (default).

## 2. Environment variables

Set the following in **Project Settings → Environment Variables**:

| Name                          | Value                                          | Scope           |
| ----------------------------- | ---------------------------------------------- | --------------- |
| `NEXT_PUBLIC_SUPABASE_URL`    | `https://tfhpcbasfugqaimcoios.supabase.co`     | all             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon key from Supabase dashboard>`         | all             |
| `SUPABASE_SERVICE_ROLE_KEY`   | `<service-role key from Supabase dashboard>`   | production, preview |
| `NEXT_PUBLIC_SITE_URL`        | `https://<your-deployment>.vercel.app`         | all             |

**Never** set `SUPABASE_SERVICE_ROLE_KEY` to a value visible to the
client; Vercel scopes env vars per-environment, so even a typo'd
`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` would leak the key. Only the
`server-only` modules in `src/lib/supabase/service.ts` should read it.

## 3. Supabase auth URL configuration

In the Supabase dashboard:

1. **Authentication → URL Configuration**
2. **Site URL:** set to your Vercel production URL.
3. **Additional Redirect URLs:** add the production URL and any
   preview URLs (e.g. `https://*-<team>.vercel.app`).

Without this, the email-confirmation link will redirect back to
`localhost:3000` and the user will be stuck in a loop.

## 4. Database migrations

Apply the migrations from `supabase/migrations/` in numeric order from
the Supabase SQL editor (or `supabase db push` if you're using the CLI
linked to the project). The migrations are idempotent.

## 5. First admin

After at least one user has signed up:

```sql
SELECT promote_user('you@example.com');
```

(replace with the email they signed up with).

## 6. Edge runtime note

Next.js 14 middleware runs on the Edge runtime by default. The
`@supabase/ssr` package has an Edge-compatible build, so this is fine.
However, **`server-only` modules (everything in `src/lib/supabase/queries/`
and `src/lib/supabase/actions.ts`) only run in the Node.js runtime** —
they're invoked from server actions, route handlers, and server
components, never from middleware.

If a future feature needs an Edge runtime route that talks to Supabase
with the service role, import the lightweight
`@supabase/supabase-js` client instead of `@supabase/ssr`.

## 7. Static assets (the BiLSTM model)

`models/fsl_alphabet/bilstm_v2_tfjs/` contains the TensorFlow.js
model.json + shards. These are large (~2 MB binary) and don't change
between deploys.

Vercel serves the `public/` directory at the root. Move the model into
`public/models/bilstm_v2/` before deploying:

```bash
mkdir -p public/models
cp -r models/fsl_alphabet/bilstm_v2_tfjs public/models/bilstm_v2
```

The camera page's recognition hook loads the model from
`/models/bilstm_v2/model.json`.

## 8. Continuous deployment

Every push to the default branch deploys to production. PRs get
preview URLs.

Recommended GitHub branch protections:

- Require 1 review
- Require `npm run lint` and `npm run build` to pass (Vercel runs these
  automatically on the preview build).

## 9. Smoke test after deploy

1. Visit `https://<deployment>/` — should show the landing page.
2. Sign up at `/register`.
3. Visit `/camera` and allow camera + microphone (mic not used, but the
   prompt will appear). Show a hand to the camera; the prediction should
   update within ~1 s.
4. Stop the session; the running transcript should be persisted.
5. Sign in as admin (after promotion) and visit `/admin`.

## 10. Rollback

Vercel keeps the last 50 deployments. To roll back, open **Deployments**,
find a green build, click the ⋮ menu, and **Promote to Production**.
