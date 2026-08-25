# SignLangVisual System Overview

> Status: reflects the system after the final-architecture cleanup. For the
> user-facing flows see [SYSTEM_FLOW.md](SYSTEM_FLOW.md); for folder layout see
> [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) §3.

## Purpose

An AI-assisted **Filipino Sign Language translation system**. It recognises
signs from a webcam and builds words with a suggestion engine, and it plays
typed text back as sign animations — fingerspelling anything the dictionary
does not cover.

Recognition runs **entirely in the browser**. Video never leaves the device.

## Scope

Sign-to-Text has **two explicitly selected modes** — there is no automatic
switching between them:

| Mode | Classes | Status |
|---|---|---|
| **Alphabet** | 26 letters (`a`–`z`) + 10 numbers (`ONE`–`TEN`) | Production |
| **Phrase Signs** | 95 phrase glosses | **Beta** — accuracy varies |

Also supported:

- Word building with suggestions from a gloss dictionary, driven by
  dynamic-programming segmentation over the letter stream
- Text-to-sign playback of published animations
- Automatic fingerspelling fallback for unknown words

**There is no `ZERO` class.** Numbers run `ONE` through `TEN`. Text-to-Sign can
render a `0` animation because assets cover `0`–`10`, but Sign-to-Text can never
recognise one. Do not write `0–9` anywhere — it advertises a class that cannot
be recognised while omitting one that can.

Not supported: sentence recognition, gloss prediction, continuous sign
recognition, machine translation, grammar conversion, SignWriting,
conversational AI.

## Two directions

They share only the landmark representation.

**A — Sign-to-Text** (`/translate`)

```
webcam frames
  -> MediaPipe Hand Landmarker: 21 landmarks per hand
     (numHands is mode-dependent: 1 for Alphabet, 2 for Phrase Signs —
      a second tracked hand roughly halves throughput)
  -> wrist-centring + max-absolute scaling -> 126-feature vector
  -> rolling 120-frame buffer at ~30 Hz
  -> motion detector marks a gesture span (measured on RAW landmarks)
  -> span resampled to the trained temporal scale -> 35 steps x 126
     (no span marked -> raw window used unchanged, so the alphabet
      path is byte-for-byte what it was)
  -> BiLSTM -> one class
  -> temporal smoothing (majority vote + vote-share hysteresis)
  -> committed to the word buffer; numbers reach the transcript only
  -> suggestion engine ranks candidate words
```

The resampling step is the system's principal technical correction. The two
categories of training clip fill the 120-frame window differently — alphabet
clips are static images replicated across all 120 slots, gesture clips are real
video time-normalised across the window. Zero-padding a live capture reproduces
the alphabet layout, so a 42-frame gesture was shown to the model at roughly
three times its trained speed. Measured: **THANK YOU 9.0% (predicting DARK) ->
88.3%**, with no retraining.

**B — Text-to-Sign** (`/translate`)

```
typed text
  -> dictionary lookup -> animation keys
  -> GET /api/animations/[gloss] -> 307 redirect to a signed Storage URL
  -> browser fetches the landmark JSON straight from Storage's CDN
  -> published sign?  yes -> play it
                      no  -> fingerspell, one published alphabet
                             animation per character
  -> playback engine -> landmark renderer (skeleton; video views retired,
                                            see SYSTEM_DOCUMENTATION.md 1.1)
```

The API **does not proxy the payload.** It resolves a path, signs it, and
redirects, so the bytes never pass through a serverless function. Measured for
one cold letter: 121.7 s -> 33.3 s end-to-end, function bandwidth 3,011,400 B ->
0. The redirect is a 307 with a 60-second cache — a permanent redirect would be
cached against a signature that expires in ten minutes.

## Model

| | |
|---|---|
| Architecture | BiLSTM, 35 temporal steps, 48 hidden units per direction |
| Classes | 131 — 26 letters + 10 numbers + 95 phrases |
| Served from | `public/models/fsl_unified/bilstm_tfjs/` (313 KB) |
| Training dataset | `datasets/processed/fsl_unified_v4` (14,217 samples, 7 signers) |
| Test accuracy (bilstm_v4, deployed) | 93.99% (macro F1 94.10%) |

`fsl_unified_v4` is the merge of `fsl_alphabet_kaggle_v2`, `fsl_105`,
`fsl_unified_augmented` and `hard_cases` — the others are **sources**, not the
set the model was trained on.

The 131 classes partition into exactly three groups, derived at runtime from
`labels.json` by [`labelPartition.ts`](src/features/recognition/labelPartition.ts)
and checked by `assertPartition()`. **Never hardcode these lists** — a hardcoded
digit row once advertised `0`–`9` in the UI, and a hardcoded battery once put 20
test items against a 131-class model.

MediaPipe's hand landmarker and WASM runtime are **self-hosted** under
`public/models/mediapipe/`, not fetched from a third-party CDN.

## Data architecture

**Supabase is the single source of truth for animation assets.**

```
admin uploads video
  -> landmarks extracted in-browser (MediaPipe Holistic)
  -> validated
  -> landmark JSON -> animation-landmarks bucket
  -> source video   -> animation-source-videos bucket
  -> rows in animation_assets / animation_asset_versions
  -> published -> immediately served to Text-to-Sign
```

37 glosses (`a`–`z`, `0`–`10`) are published. `/api/animations/[gloss]` reports
its source in an `X-Animation-Source` header so the two can never be confused
silently. **That header rides the 307 redirect, not the final response** — any
test asserting it must use `redirect: "manual"`.

A local filesystem fallback exists for development only, behind
`ANIMATION_LOCAL_FALLBACK`. Those files are gitignored and never deployed, so
production reads exclusively from Supabase. Run `npm run dev:prod-assets` to
disable it and make dev behave like production; otherwise a failed lookup is
silently masked locally and 404s in production.

### Publishing ceiling

Landmark JSON is sent in the request body and the hosting platform caps requests
at **4.5 MB** — roughly four seconds of video. THANK YOU at 189 frames is
7.55 MB and cannot be published from the deployed app at all. Face-mesh
landmarks are ~90% of payload (6.01 MB → 0.61 MB without them), so that is the
lever. Note that non-manual markers carry grammar in signed languages, so
downsampling the mesh is preferable to dropping it.

### Admin is local-only

`/admin/*` and `/api/admin/*` both return **404** in production, gated at the
middleware and at `requireAdmin()`. Because the database is shared, publishing
from a local machine appears on the deployed site immediately — no redeploy.
Set `ADMIN_ENABLED=true` in `.env.local` to run it. See
[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) §8.1.

## Security

- Admin identity from `app_metadata.role`, never `user_metadata` (which is
  user-editable and unsafe for authorization)
- `public.is_admin()` is `SECURITY DEFINER` with a pinned `search_path`
- RLS on every animation table; anonymous callers get zero rows
- Private storage buckets; server-side access uses the service role
- Admin API routes guarded by `requireAdmin()`, returning typed 401/403 and
  never leaking database error text

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind v4 ·
TensorFlow.js · MediaPipe Tasks Vision · Supabase (Postgres, Auth, Storage)
