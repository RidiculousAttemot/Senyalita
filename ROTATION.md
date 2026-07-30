# Credential rotation checklist

Written 2026-07-28. Database passwords rotated and four files scrubbed
2026-07-30. **Reopened 2026-07-31: a live `service_role` JWT was found on
`origin/main` that this document had declared absent.** See §0.5. No credential
values appear here.

## 0. Status — NOT DONE

The database passwords have been rotated, and the four tracked files that
carried a live value have been scrubbed to the `[PASSWORD]` placeholder style
already used by `scripts/db-provision.mjs:15`. That part stands.

What did not happen: the `service_role` JWT in `scripts/api-verify.mjs` was
never rotated, because §0's "Verified not exposed" list said no such key
existed. It did, and still does, on the published default branch. Read §0.5
before trusting anything else here.

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

### Verified not exposed — TWO OF THESE WERE WRONG

- `.env.example` — placeholder. Still true.
- `scripts/db-provision.mjs:15` — `[PASSWORD]` (unchanged by the scrub, which
  confirms it was already safe). Still true.
- ~~`scripts/db-test.mjs:34` — masked with `***`~~ **WRONG.** True on this
  branch. On `origin/main` the file carries two unmasked 16-character
  passwords.
- ~~No `sb_secret_…` or complete three-segment JWT appears in any tracked
  file.~~ **WRONG.** True of the working tree. `origin/main` serves a complete
  three-segment `service_role` JWT from `scripts/api-verify.mjs`.

`.env.local` is git-ignored and untracked. Confirmed via
`git status --ignored`; it is listed as ignored and appears in no tree.

## 0.5. Reopened 2026-07-31 — what the earlier audit missed

### The exposure

| Where | What | Status |
|---|---|---|
| `scripts/api-verify.mjs` | Complete `service_role` JWT, `iss: supabase`, `exp` 2036-06-06 | **Live unless rotated.** Bypasses RLS entirely |
| `scripts/db-test.mjs` | Two unmasked 16-character DB passwords | Probably dead — the 2026-07-30 password rotation likely covered them |

Published by commit `02b57013` ("cleanaup", 2026-06-19), which **is an ancestor
of `origin/main`**. The repository is public (`"visibility": "public"` from the
unauthenticated GitHub API), so both have been world-readable since 2026-06-19.

The values were removed from this branch on 2026-07-27 (`08a1f549`), but that
commit was never pushed. Local removal and published state are different
things; only the second one matters.

### Scoping error 1 — audited the branch, claimed it about the repository

The "Verified not exposed" list was produced by scanning the local working
tree. The branch had already been cleaned on 2026-07-27, so it read clean —
while `origin/main`, which is what the public actually sees, was serving a live
key the whole time. The audit was accurate about what it looked at and wrong
about what it claimed.

**Rule: a credential audit scans what is PUBLISHED — every ref and all history
— not the working tree.** `git rev-list --objects --all`, not `git grep`. Use
`npm run audit:secrets`, which does exactly this.

### Scoping error 2 — placeholder filter narrower than the claim

A follow-up check classified `postgresql://` passwords as real or placeholder
by testing for `[...]` and `<...>` brackets. It did not test for `${...}`, so
`scripts/db-find-region.mjs` — which contains the template literal
`${process.env.DB_PASSWORD}` — was reported as a live 26-character password on
a public branch. It is not a credential at all. That escalation was wrong and
is withdrawn.

### Both errors have the same shape

A check narrower than the conclusion drawn from it. One produced a false
negative that hid a live `service_role` key for six weeks; the other produced a
false positive that raised a nonexistent one. The fix in both directions is to
state what was scanned alongside what was found — which `scripts/audit-secrets.mjs`
now prints on every run.

### Consequence for history

Once the `service_role` key is rotated, every copy in history becomes inert,
exactly as with the database passwords in §0. **No history rewrite is planned.**
A rewrite changes all 127 commit hashes and forces every clone to be re-cloned,
and after six weeks of public exposure it removes nothing an attacker could not
already have taken. Rotation is the remediation; the history copies are noise
once the key is dead.

### Not yet done

Scrubbing `scripts/api-verify.mjs` and `scripts/db-test.mjs` is deliberately
**deferred until the key is confirmed rotated**. Scrubbing first would make the
files stop looking urgent while the live key remained reachable in history —
the precise failure mode §4 warns about, and the one that produced this
section.

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
