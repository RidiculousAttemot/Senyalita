# Credential rotation checklist

Written 2026-07-28. **Rotation completed and the exposed files scrubbed
2026-07-30.** No credential values appear here.

## 0. Status — DONE, with a caveat that still matters

The database passwords have been rotated, and the four tracked files that
carried a live value have been scrubbed to the `[PASSWORD]` placeholder style
already used by `scripts/db-provision.mjs:15`.

| File | Line | Was | Now |
|---|---|---|---|
| `docs/database-audit.md` | 204 | Pooler conn string incl. password | `[PASSWORD]` |
| `docs/database-verification-report.md` | 193 | Pooler conn string incl. password | `[PASSWORD]` |
| `docs/runtime-audit-report.md` | 17 | Conn string incl. password | `[PASSWORD]` |
| `scripts/db-find-region.mjs` | 13 | Hardcoded password | Reads `PGPASSWORD`/`DATABASE_URL` |

Host and username are deliberately preserved so the documented commands stay
useful; only the secret is gone.

### Correction to the original audit

`docs/production-deployment-report.md:29` was listed here as "a Supabase JWT
key". **That was wrong.** The token on that line is truncated to 37 characters
— a single 36-character segment followed by an ellipsis. That segment is
`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`, the base64 of
`{"alg":"HS256","typ":"JWT"}`, which every HS256 token begins with. The payload
and signature — the parts that are secret — were never in the file. The row is
also labelled `NEXT_PUBLIC_SUPABASE_ANON_KEY` / "Public", and the anon key is
publishable by design. Nothing was exposed there and nothing needed changing.

Line 34 of the same file was flagged by a later, broader scan and is also
clean: its password is the angle-bracket placeholder `<pwd>`.

So the real exposure was **four** files, not five.

### HISTORY STILL CARRIES THE OLD VALUES

Scrubbing changes the current files only. Every pre-scrub commit still contains
the original passwords, and `git log -p` or `git show <old-sha>:<path>` will
return them. This is acceptable **only because the credentials have been
rotated** — the values in history are now useless.

If they had not been rotated, this scrub would have made things worse rather
than better: an obvious secret gets fixed, while a secret that merely looks
absent gets forgotten.

Cleaning history itself remains a separate, unmade decision, with the same cost
as the `tmp/` cleanup: a full rewrite, every commit hash changed, every clone
re-cloned.

### Verified not exposed

- `.env.example` — placeholder
- `scripts/db-provision.mjs:15` — `[PASSWORD]` (unchanged by the scrub, which
  confirms it was already safe)
- `scripts/db-test.mjs:34` — masked with `***`
- No `sb_secret_…` or complete three-segment JWT appears in any tracked file.

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
