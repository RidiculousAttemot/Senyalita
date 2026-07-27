# SignLangVisual System Overview

> Status: reflects the shipping system as of Phase 48. For implementation-level
> detail — exact constants, algorithms, and known documentation drift — see
> [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).

## Purpose

Real-time Filipino Sign Language (FSL) translation on a single device. The system
captures hand gestures through a webcam, recognizes the sign with a neural network
running **in the browser**, and outputs readable text and spoken audio in English or
Tagalog. It also works in reverse: typed text is translated into FSL gloss and played
back as animated hand motion.

## Two directions

The system does two independent things that share only the landmark representation.

**A — Sign to Text** (`/translate`, `/conversation`, `/presentation`)

```
User signs
  → Webcam captures frames
  → MediaPipe Hand Landmarker extracts 21 landmarks per hand
  → Wrist-centering + max-absolute scaling → 126-feature vector
  → 35-frame sequence sampled from a 120-frame window
  → BiLSTM classifies into one of 131 FSL classes
  → Temporal smoothing (majority vote + hysteresis)
  → Text output + speech (Web Speech API, English or Tagalog)
```

**B — Text to Sign** (`/translate`, `/type-to-sign`)

```
User types text
  → 9-stage translation pipeline (normalize → detect language → gloss →
     FSL grammar reordering → unknown-word fallback → animation plan)
  → Animation assets fetched per gloss (recorded landmark data, not video)
  → Canvas playback of the signing avatar
```

## The algorithm

**A two-stage, landmark-based approach.**

1. **Feature extraction** — MediaPipe Hand Landmarker, a pretrained CNN from Google,
   converts each camera frame into 21 3D landmarks per hand.
2. **Sequence classification** — a **Bidirectional Long Short-Term Memory (BiLSTM)**
   network, trained in this project, classifies a 35-frame landmark sequence.

### Why two stages

Separating detection from recognition means the recognition model never sees pixels —
only a compact, normalized 126-number description of hand shape. This makes the model
small enough to ship to the browser, invariant to lighting and background, and
independent of where the signer stands in frame.

### Why bidirectional

Many signs are only distinguishable by where the hand *ends up*. A forward-only
network reaching the middle of a gesture has not yet seen the ending. The backward
pass has, so early frames are interpreted with knowledge of how the gesture resolves.
The cost is that classification runs on a completed window rather than truly
frame-by-frame — an accepted trade, since the window is ~4 seconds and inference runs
every 100 ms.

> **Note:** earlier drafts of this document described a "CNN-LSTM". That is incorrect.
> The trained model contains **no convolutional layers** — the only CNN in the system
> is MediaPipe's, which was not trained here.

## The model

| | |
|---|---|
| Architecture | `Bidirectional(LSTM 48) → Dropout(0.25) → Dense(131, softmax)` |
| Parameters | 79,907 |
| Size | 312 KB (float32) |
| Input | 35 timesteps × 126 features |
| Output | 131 classes — 26 letters + 105 phrases, numbers, days, months, colors, food |
| Training set | 14,217 samples, 7 signers |
| Test accuracy | **94.86%** |
| Macro F1 | **91.85%** |
| Inference | ~8–12 ms, in-browser (TensorFlow.js) |

Served from `public/models/fsl_unified/bilstm_tfjs/`. Trained artifacts and metrics
live in `models/fsl_unified/bilstm_v4/`.

## Where the AI is

Two neural networks are involved in translation. Only one was built here.

| Component | Origin | Role |
|---|---|---|
| MediaPipe Hand Landmarker | Google, pretrained | Finds hands, outputs landmarks |
| **BiLSTM classifier** | **This project** | Recognizes which sign is being made |
| `gpt-4o-mini` (optional) | External API | Suggests conversational replies *after* recognition |

The language model is **not part of the translation path**. Without an API key the
system falls back to a rule-based reply dictionary and translation is unaffected.

Modules named `analytics/`, `active-learning/`, and `ai-assist/` are deterministic
heuristics and classical statistics — keyword matching, threshold comparison, K-Means.
They are not neural networks.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript |
| Hand tracking | `@mediapipe/tasks-vision` — Hand Landmarker (WASM) |
| Inference | TensorFlow.js |
| Training | Pure JavaScript — no Python ML framework, no GPU |
| Backend | Next.js API Routes (serverless on Vercel) |
| Database / auth | Supabase (PostgreSQL + Auth + Storage) |
| Speech | Web Speech API (browser built-in) |
| Rendering | HTML5 Canvas 2D |
| Hosting | Vercel |

**Node 22 is required** (`>=22.12.0 <24.0.0`). Node 24 breaks the Next 14.2.5 build.
See [README.md](README.md).

## Why this architecture

- **Runs in the browser with no inference server** — the model is 312 KB, so it ships
  as a static asset instead of requiring a hosted GPU.
- **No video ever leaves the device.** Recognition is entirely client-side. This is a
  privacy property that falls out of the architecture rather than being added on.
- **Low latency** — ~165 ms end to end, with no network round trip in the loop.
- **Free-tier deployable** — Vercel and Supabase free tiers are sufficient.

## Communication model

The system is designed for two-way conversation between a signing user and a hearing
user on one shared device:

- The signing user signs; the system displays and speaks the translation.
- The hearing user replies by typing or picking a suggested phrase; the system
  renders that reply back as animated FSL.

Suggested replies come from the optional language model when configured, and from a
rule-based dictionary otherwise.

## Codebase structure

```
src/app/          Next.js routes (39 pages) and API routes (13)
src/components/   shared UI, landing page, admin components
src/features/     the system, organized by domain:
                    recognition/          sign→text core
                    sign-to-text/         camera + MediaPipe wiring
                    translation-pipeline/ text→sign, 9 stages
                    fsl-translation/      gloss engine, grammar, dictionary
                    sign-animation/       playback and canvas rendering
                    type-to-sign/         text→sign UI
                    analytics/            admin-side offline analysis
src/lib/          Supabase client, queries, TTS, utilities
scripts/          dataset building, training, export (128 files)
models/           trained weights and metrics
public/models/    what the browser downloads
supabase/         37 migrations
```

## Access model

No end-user accounts. `/translate`, `/conversation`, `/learn`, `/history`,
`/presentation`, `/type-to-sign` and `/evaluation` are public and require no login.
Supabase Auth guards `/admin/*` only, enforced by Row-Level Security.

## Security

- Supabase Auth for admin authentication; role stored in auth metadata
- Row-Level Security policies on all admin-accessible tables
- Server-side validation on API routes
- Secrets via environment variables — service-role key is server-only
- No personal data collected; sessions are anonymous tokens
