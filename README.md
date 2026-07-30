# SignLangVisual

The Development of a Real Time Sign Language Recognition and Translation System Using
Deep Learning for Text and Speech output

An AI-assisted **Filipino Sign Language alphabet translation system**. It recognises
fingerspelled letters from a webcam and builds words with a suggestion engine, and it
plays typed text back as sign animations — fingerspelling anything the dictionary does
not cover.

Recognition runs **entirely in the browser**. Video never leaves the device.

## Two workflows

Both live on `/translate`, in a tab switcher.

| | Input | Output |
| --- | --- | --- |
| **Sign-to-Text** | webcam | one recognised letter at a time, assembled into words with suggestions |
| **Text-to-Sign** | typed text | animated FSL playback, fingerspelled when no sign is published |

## The model

| | |
| --- | --- |
| Architecture | Bidirectional LSTM — 35 temporal steps, 48 hidden units |
| Classes | 131 |
| Size | ~320 KB, served from `public/models/fsl_unified/bilstm_tfjs/` |
| Test accuracy | 94.86% |
| Runtime | TensorFlow.js, client-side |

Feature extraction uses MediaPipe Hand Landmarker (a pretrained model from Google);
the BiLSTM is trained in this repository. The deployed model retains phrase classes,
but the **application scope** is alphabet recognition, so the UI treats predictions as
single characters.

## Quick start

```bash
nvm use
npm install
npm run dev
```

Then open http://localhost:3000. Camera pages need `localhost` or HTTPS — that is a
`getUserMedia` requirement, not a project one.

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
| [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) | Directory layout |
| [AGENTS.md](AGENTS.md) | Phase-by-phase project history |

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind v4 · TensorFlow.js ·
MediaPipe Tasks Vision · Supabase (Postgres, Auth, Storage) · Vercel
