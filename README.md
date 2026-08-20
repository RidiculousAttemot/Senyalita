# SignLangVisual

The Development of a Real Time Sign Language Recognition and Translation System Using
Deep Learning for Text and Speech output

An AI-assisted **Filipino Sign Language translation system**. It recognises signs from
a webcam and builds words with a suggestion engine, and it plays typed text back as
sign animations — fingerspelling anything the dictionary does not cover.

Recognition runs **entirely in the browser**. Video never leaves the device.

## Two workflows

Both live on `/translate`, in a tab switcher.

| | Input | Output |
| --- | --- | --- |
| **Sign-to-Text** | webcam | one recognised class at a time, assembled into words with suggestions |
| **Text-to-Sign** | typed text | animated FSL playback, fingerspelled when no sign is published |

Sign-to-Text has two explicitly selected modes — **Alphabet** (26 letters + the
numbers `ONE`–`TEN`) and **Phrase Signs** (95 glosses, beta). There is no automatic
switching, and no `ZERO` class.

Two supporting public routes: **`/learn`** (FSL reference — alphabet, numbers,
tutorials) and **`/evaluation`** (the accuracy harness behind the reported figures).

## The model

| | |
| --- | --- |
| Architecture | Bidirectional LSTM — 35 temporal steps, 48 hidden units per direction |
| Classes | 131 — 26 letters + 10 numbers + 95 phrases |
| Size | 313 KB, served from `public/models/fsl_unified/bilstm_tfjs/` |
| Test accuracy (bilstm_v4, deployed) | 93.99% (macro F1 94.10%) |
| Runtime | TensorFlow.js, client-side |
| Training | Hand-written JavaScript — no Python ML framework, fixed seed, reproducible |

Feature extraction uses MediaPipe Hand Landmarker (a pretrained model from Google),
**self-hosted** rather than fetched from a CDN; the BiLSTM is trained in this
repository.

A marked gesture span is resampled to the model's trained temporal scale before
inference. Without it, a live capture fills the 120-frame window the way *alphabet*
clips do — zero-padded — and a 42-frame gesture is shown at roughly three times its
trained speed. Measured: **THANK YOU 9.0% → 88.3%**, no retraining. The alphabet path
is unchanged when no span is marked.

## Quick start

```bash
nvm use
npm install
npm run hooks:install
npm run dev
```

Then open http://localhost:3000. Camera pages need `localhost` or HTTPS — that is a
`getUserMedia` requirement, not a project one.

`npm run hooks:install` sets `core.hooksPath` to the tracked [`.githooks/`](.githooks)
directory, enabling a pre-push secret scan. **Run it once per clone** — git will not
enable hooks for you, and a hook that is not installed protects nothing. See
[Secret scanning](#secret-scanning).

Copy `.env.example` to `.env.local` and fill in the Supabase values. The Supabase URL
and anon key are the only variables needed for a working local app.

| Command | Does |
| --- | --- |
| `npm run dev` | dev server on :3000 |
| `npm run build` | production build |
| `npm test` | Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run knip` | unused-export detection |
| `npm run audit:secrets` | scan all git history for credentials |
| `npm run hooks:install` | enable the pre-push secret scan (once per clone) |

## Secret scanning

`npm run audit:secrets` scans every blob reachable from every ref — not the working
tree. That distinction is the whole point: a live Supabase `service_role` key sat on
`origin/main` for six weeks while the working tree read clean, because it had been
removed locally and never pushed. Two earlier audits missed it by scanning files
instead of objects. [`ROTATION.md`](ROTATION.md) §0.5 has the post-mortem.

The pre-push hook runs the same scanner against the commit range being pushed and
refuses on a hit, printing path and line but never the value. `git push --no-verify`
bypasses it, deliberately and visibly.

Because it scans objects, a credential that was ever committed is found forever —
revoking it does not remove it from history. [`scripts/secret-allowlist.json`](scripts/secret-allowlist.json)
records values confirmed dead, keyed by SHA-256 so no secret is stored (they are
already public in history; the digest only identifies). Allowlisted values are still
printed on every run with their reason and death date — they stop failing the build,
they do not stop being reported. **Revoke first, then allowlist**: entering a live key
there hides it permanently. Without this the scanner fails on every run, and a check
that is always bypassed is how the six-week blind spot happened in the first place.

It is local-only and cannot protect a push from another clone, so enable GitHub push
protection as the second layer: **Settings → Code security → Secret scanning**.

## Requirements

**Node.js 22 LTS** — pinned in [`.nvmrc`](.nvmrc) (currently `22.23.1`) and enforced by
`engines` in `package.json` (`>=22.12.0 <24.0.0`).

The range is narrow because both ends are load-bearing:

| Bound | Reason |
| --- | --- |
| `>= 22.12.0` | `puppeteer@25` requires it; `knip` and `vitest` agree. Node 20 does **not** qualify. |
| `< 24.0.0` | Next.js 14.2.5's bundled webpack feeds `undefined` to Node 24's hasher, and the build dies with `WasmHash` / `ERR_INVALID_ARG_TYPE`. |

Node 24 is itself an LTS release ("Krypton"), so "just use LTS" is not sufficient
guidance here — the constraint is specifically Next 14.2.5 against Node 24.

Local, CI (`node-version-file: .nvmrc`) and Docker (`node:22-alpine`) all read the
same pin. **Vercel is the exception** — it takes the Node version from project
settings, so set that to 22.x in the dashboard to match.

If a build fails with a hashing error, that is a Node version mismatch. Deleting
`.next` clears the symptom but not the cause.

### Node 24 workarounds in `next.config.mjs`

Two settings exist purely to keep builds working on Node 24. Both are safe to
delete once everyone is on the pinned Node 22:

| Setting | Failure it prevents |
| --- | --- |
| `output.hashFunction = 'sha256'` | `WasmHash._updateWithBuffer` crash — Next's bundled webpack routes hashing through a WASM implementation that breaks on Node 24. |
| `cache = false` (production only) | `Cannot find module './<id>.js'` while collecting page data. The filesystem cache serialises through the same hasher and can emit a manifest referencing chunks it never wrote. Dev keeps its cache; the failure is build-only. |

Disabling the production cache costs full-rebuild time on every build. That is a
deliberate trade for a build that completes.

## Documentation

| Document | Covers |
| --- | --- |
| [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) | What the system is, scope, model, data architecture |
| [SYSTEM_FLOW.md](SYSTEM_FLOW.md) | User roles and the two workflows, step by step |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Algorithms, constants, and the recognition hot path |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) §3 | Directory layout — the single home for structure |
| [AGENTS.md](AGENTS.md) | Phase-by-phase project history |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel topology — **which branch must not be deleted**, rollback pinning, build-time env inlining |
| [ROTATION.md](ROTATION.md) | Credential rotation checklist and the secret-exposure post-mortem |
| [THESIS_PRESENTATION_SCRIPT.md](THESIS_PRESENTATION_SCRIPT.md) | Defense script, results, and anticipated panel questions |

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind v4 · TensorFlow.js ·
MediaPipe Tasks Vision · Supabase (Postgres, Auth, Storage) · Vercel
