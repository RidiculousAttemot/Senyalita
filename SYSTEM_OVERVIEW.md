# SignLangVisual System Overview

> Status: reflects the system after the final-architecture cleanup. For the
> user-facing flows see [SYSTEM_FLOW.md](SYSTEM_FLOW.md); for folder layout see
> [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md).

## Purpose

An AI-assisted **Filipino Sign Language alphabet translation system**. It
recognises fingerspelled letters from a webcam and builds words with a
suggestion engine, and it plays typed text back as sign animations —
fingerspelling anything the dictionary does not cover.

Recognition runs **entirely in the browser**. Video never leaves the device.

## Scope

Supported:

- Alphabet recognition (A–Z, 0–9), one character at a time
- Word building with smart suggestions from a gloss dictionary
- Text-to-sign playback of published animations
- Automatic fingerspelling fallback for unknown words

Not supported: sentence or phrase recognition, gloss prediction, continuous
sign recognition, machine translation, grammar conversion, SignWriting,
conversational AI.

## Two directions

They share only the landmark representation.

**A — Sign-to-Text** (`/translate`)

```
webcam frames
  -> MediaPipe Hand Landmarker: 21 landmarks per hand, up to 2 hands
  -> wrist-centring + max-absolute scaling -> 126-feature vector
  -> buffered at a fixed ~30 Hz (matching training-clip extraction)
  -> BiLSTM -> a single character
  -> temporal smoothing (majority vote + hysteresis)
  -> character appended to the word buffer
  -> suggestion engine ranks candidate words
```

**B — Text-to-Sign** (`/translate`)

```
typed text
  -> dictionary lookup -> animation keys
  -> GET /api/animations/[gloss] -> Supabase Storage (landmark JSON)
  -> published sign?  yes -> play it
                      no  -> fingerspell, one published alphabet
                             animation per character
  -> playback engine -> landmark renderer (skeleton / human / split / overlay)
```

## Model

| | |
|---|---|
| Architecture | BiLSTM, 35 temporal steps, 48 hidden units |
| Classes | 131 (26 single characters + phrase classes) |
| Served from | `public/models/fsl_unified/bilstm_tfjs/` (~320 KB) |
| Training dataset | `datasets/processed/fsl_alphabet_kaggle_v2` (14,217 samples, 7 signers) |
| Test accuracy | 94.86% |

The deployed model retains its phrase classes; the **application scope** is
alphabet recognition, so the UI treats predictions as single characters.

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

37 glosses (A–Z, 0–10) are published. `/api/animations/[gloss]` reports its
source in an `X-Animation-Source` header (`published` or `local-development`)
so the two can never be confused silently.

A local filesystem fallback exists for development only, behind
`ANIMATION_LOCAL_FALLBACK`. Those files are gitignored and never deployed, so
production reads exclusively from Supabase.

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
