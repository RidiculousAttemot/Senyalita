# Credential rotation checklist

Written 2026-07-28. Nothing in this document has been rotated — it is a
checklist for you to execute. No credential values appear here.

## 0. Why this is not optional

Five **tracked** files in this repository contain what appear to be live
credentials. They are in git history, so they are in every clone, and
rotation — not deletion — is what actually protects the project. Deleting the
lines is housekeeping; changing the secrets is the fix.

| File | Line | What it holds |
|---|---|---|
| `docs/production-deployment-report.md` | 29 | A Supabase JWT key |
| `docs/database-audit.md` | 204 | Pooler connection string incl. password |
| `docs/database-verification-report.md` | 193 | Pooler connection string incl. password |
| `docs/runtime-audit-report.md` | 17 | Connection string incl. password |
| `scripts/db-find-region.mjs` | 13 | Pooler connection string incl. password |

Verified **not** exposed (they use placeholders):

- `.env.example` — placeholder
- `scripts/db-provision.mjs:15` — `[PASSWORD]`
- `scripts/db-test.mjs:34` — masked with `***`

`.env.local` is git-ignored and untracked. Confirmed via
`git status --ignored`; it is listed as ignored and appears in no tree.

## 1. What each credential is, and what actually consumes it

| Credential | Set in | Consumed by | In the deployed app? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env, `.env.local` | `lib/supabase/client.ts:8`, `server.ts:10`, `middleware.ts:23`, `app/admin/logout/route.ts:11`, `api/admin/health/route.ts:112` | **Yes — every request** |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env, `.env.local` | `lib/supabase/service.ts:10`, `api/admin/health/route.ts:93` | **Yes — admin writes** |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env, `.env.local` | same modules as above | Yes (not a secret) |
| `SUPABASE_SECRET_KEY` | `.env.local` | nothing under `src/` | **No** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` | nothing under `src/` | **No** |
| `DATABASE_URL` (3 passwords) | `.env.local`, Supabase dashboard | `scripts/db-*.mjs` only | **No** |

Two consequences worth reading twice:

1. **The database passwords are not used by the running site.** Every
   consumer is a script you run locally. Rotating them causes zero user-facing
   downtime — only your local scripts stop working until `.env.local` is
   updated. Do these first; they are the cheap ones.

2. **`NEXT_PUBLIC_*` values are inlined into the client bundle at build
   time.** Changing them in the Vercel dashboard does nothing on its own.
   The old key stays live in the deployed JavaScript until you rebuild. A
   redeploy is mandatory, not optional cleanup.

## 2. Order of operations

### Phase A — database passwords (no downtime)

1. Supabase Dashboard → Project Settings → Database → **Reset database
   password**. Do this for each of the three exposed passwords.
2. Update `DATABASE_URL` in `.env.local`.
3. Verify: `node scripts/db-test.mjs`
4. Nothing else to do. The deployed site never reads these.

### Phase B — API keys (this one has a downtime window)

The anon key is used by middleware, so it is on the path of every single
request. Between rotating it and finishing a redeploy, the deployed site is
broken. Plan for that window rather than discovering it.

5. Decide which key scheme you are on:
   - **Legacy JWT keys** (`anon` / `service_role`, JWT-shaped): rotating the
     JWT secret invalidates **both at once**. Atomic, no overlap period.
   - **New API keys** (`sb_publishable_…` / `sb_secret_…`): these can be
     created and revoked individually, so you can run old and new
     concurrently and avoid any window. If you are on this scheme, prefer it.
6. Rotate in Supabase Dashboard → Project Settings → API.
7. **Immediately** update in Vercel → Project → Settings → Environment
   Variables, for every environment you deploy (Production, Preview,
   Development):
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
8. **Redeploy.** Not "Restart" — a full rebuild, because of the
   `NEXT_PUBLIC_` inlining above. Trigger it from the Vercel dashboard or by
   pushing a commit.
9. Update the same two values in `.env.local` for local development.

### Phase C — verification

10. Load the deployed `/` and `/translate` — these exercise the anon key
    through middleware on every request.
11. Log into `/admin` — exercises the auth cookie path and `requireAdmin`.
12. Hit `/api/admin/health` while authenticated — it reads **both**
    `SUPABASE_SERVICE_ROLE_KEY` (line 93) and the anon key (line 112), so it
    is the single best smoke test that both rotated keys took effect.
13. Publish or re-publish one animation in `/admin/animation-studio` —
    exercises the service-role write path.

## 3. What breaks between rotation and redeploy

| Window | Symptom |
|---|---|
| DB password rotated, `.env.local` not yet updated | Local `scripts/db-*.mjs` fail to connect. Site unaffected. |
| API keys rotated, Vercel env not yet updated | Deployed site fails on every request — middleware cannot construct a Supabase client. `/` and `/translate` included. |
| Vercel env updated, not yet redeployed | Server-side code picks up the new `SUPABASE_SERVICE_ROLE_KEY`, but the browser bundle still ships the **old** anon key. Expect a confusing half-broken state: admin server actions work, client-side auth does not. |
| After redeploy | Any still-open browser session holding a token signed by the old JWT secret is invalid; users re-authenticate. |

## 4. After rotating — scrub the files

Rotation makes the leaked values useless, which is the point. Once that is
done, remove them from the five files listed in §0 so they are not
re-copied into a future document.

Note the same caveat that applies to `tmp/`: deleting the lines does not
remove them from git history. The old values remain reachable at older
commits. That is acceptable *because* they will have been rotated — which is
exactly why rotation comes first and scrubbing second.

If you ever need history itself cleaned, that is a separate decision with the
same cost as the `tmp/` cleanup: a full history rewrite, every commit hash
changed, every clone re-cloned.

## 5. Prevention

- `.env.local` is ignored and must stay that way.
- The audit reports in `docs/` were generated by pasting real connection
  strings into prose. Future reports should redact to the `[PASSWORD]` form
  that `scripts/db-provision.mjs:15` already uses.
