# Deployment

Hosted on Vercel, project `signlangvisual`.

## Production branch

**Vercel builds Production from `main`** (as of 2026-07-31). Pushes to any other
branch produce **Preview** deployments, which cannot take the domain no matter
how green they are.

This is a **dashboard setting** (Settings → Git → Production Branch). Nothing in
the repository records it and no local git command can read it, so **this file
can go stale without anything failing.** It already did once: it was written
naming `cleanup/final-architecture`, and the setting was changed to `main` within
the hour. If a push to `main` lands as Preview, the setting moved again — believe
the dashboard, not this line, and correct it here.

**Before deleting any branch, confirm the deploy topology.** Content checks are
not sufficient: on 2026-07-31 `main` and `cleanup/final-architecture` had
byte-identical trees, every file verified present on both — and at that moment
deleting `cleanup/final-architecture` would have taken production down, because
it was then the production branch.

## Changing the production branch

Switching Settings → Git → Production Branch **does not trigger a build**. The
setting changes where the *next* Production deploy comes from; nothing deploys
until something pushes.

To get the first Production deploy from a newly-selected branch:

```bash
git commit --allow-empty -m "chore: first production build from main" && git push origin main
```

**Do not instead promote an existing Preview deployment.** Preview builds are
compiled with *Preview* environment variables, and every `NEXT_PUBLIC_*` value is
inlined into the client bundle at build time — promoting one ships Preview config
to production, and it will not be visible in the dashboard. Always rebuild.

## Rollbacks pin the domain

A rollback does two things, and the second is the one that surprises people:

1. Points the domain at an older deployment.
2. **Disables automatic domain assignment.**

While that is active, new deployments build and go green while the domain keeps
serving the old build. "Deployed" and "live" come apart, and the dashboard shows
success. Clearing the rollback and re-enabling automatic assignment is a manual
step in the dashboard.

**Verify the domain, never the build status.** Fetch the deployed URL and assert
on something only the new code has — a route that did not exist before, or an
asset added since:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<domain>/models/fsl_unified/bilstm_tfjs/labels.json
```

## Node version

Vercel does **not** read `.nvmrc`. It takes the Node version from project
settings, which must be set to **22.x** — `engines` requires `>=22.12.0 <24.0.0`,
and `puppeteer@25` requires 22.12+. A Node 20 setting fails every build; Node 24
breaks Next 14.2.5's bundled webpack hasher. See README → Requirements.

## Environment variables

`NEXT_PUBLIC_*` values are inlined into the client bundle at build time. Changing
one in the dashboard does nothing to the deployed site until a **rebuild** — not
a restart, not a redeploy of an existing build. See [ROTATION.md](ROTATION.md) §1.
