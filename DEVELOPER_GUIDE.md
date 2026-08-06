# SignLangVisual — Developer Guide

Everything a programmer needs before touching this codebase: what the system actually
does, where the AI is, the algorithms in the hot path, and the traps that will waste
your afternoon.

> **Read this instead of `SYSTEM_FLOW.md`, `SYSTEM_OVERVIEW.md`, and the Phase 1/3
> sections of `README.md`.** Those are the original thesis planning documents from
> the start of the project. They describe a "CNN-LSTM", a placeholder classifier, and
> a "Phase 1: frontend only, no model" state. None of that has been true for a long
> time. They were never updated. See [Documentation drift](#12-documentation-drift-read-this-before-trusting-any-other-doc).

---

## 1. What the system is

A **Filipino Sign Language (FSL) translator that runs in the browser**. Two
independent directions, sharing almost nothing but the landmark representation:

| Direction | Route | Input | Output |
|---|---|---|---|
| **A — Sign → Text** | `/translate`, `/conversation`, `/presentation` | Webcam video | Recognized gloss + English/Tagalog text + TTS |
| **B — Text → Sign** | `/translate`, `/type-to-sign` | Typed text | FSL gloss sequence + animated landmark playback |

The defining architectural property: **recognition is 100% client-side.** The model
weights are a 312 KB static file served from `public/`. No inference server, no GPU
backend, no video ever leaves the device. The Next.js server exists for persistence,
admin tooling, and animation assets — not for the ML hot path.

There is **no end-user authentication.** Public pages need no login (removed in
Phase 27). Supabase auth guards `/admin/*` only.

---

## 2. Stack and hard constraints

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2.5, App Router, TypeScript |
| Hand tracking | `@mediapipe/tasks-vision` — Hand Landmarker (WASM) |
| Inference | TensorFlow.js (`@tensorflow/tfjs`), Layers API |
| Training | **Pure JavaScript.** No Python ML framework. |
| DB / auth | Supabase (Postgres + RLS), 37 migrations |
| Rendering | HTML5 Canvas 2D (no WebGL, no three.js) |
| Tests | Vitest (47 test files), Playwright for e2e |
| Hosting | Vercel |

### Node version is load-bearing — read this before your first `npm install`

Pinned to **Node 22** (`.nvmrc` = 22.23.1, `engines` = `>=22.12.0 <24.0.0`). Both
bounds are real:

- **`>= 22.12.0`** — `puppeteer@25` requires it.
- **`< 24.0.0`** — Next 14.2.5's bundled webpack feeds `undefined` to Node 24's
  hasher. Builds die with `WasmHash` / `ERR_INVALID_ARG_TYPE`.

If a build fails with a hashing error, it is a Node version mismatch. Deleting
`.next` hides the symptom for one build and does not fix it. `next.config.mjs` carries
two Node-24 workarounds (`hashFunction: 'sha256'`, production `cache: false`) that can
be deleted once everyone is on the pin.

**Vercel does not read `.nvmrc`** — set Node 22.x in the project dashboard manually.

---

## 3. Repo map

```
src/
  app/                      Next.js App Router — 39 page routes, 13 API routes
    (routes)/history        public
    translate/              main surface: both directions, tabbed
    type-to-sign/           dedicated text→sign surface
    conversation/           two-way conversation workspace
    learn/  presentation/  evaluation/
    admin/(dashboard)/      29 admin tools (auth-gated)
    api/                    animations, ai/replies, feedback, collection, admin/*

  features/                 the actual system — organized by domain, not by layer
    recognition/            ◄ DIRECTION A core. Buffer, normalize, model, smoothing,
                              motion detection, priority, the useRecognition hook.
    sign-to-text/           Direction A UI + camera + MediaPipe wiring
    translation-pipeline/   ◄ DIRECTION B core. 9-stage orchestrator.
    fsl-translation/        English/Tagalog → FSL gloss engine (grammar, dictionary)
    text-to-sign/           gloss → animation queue, fingerspelling fallback, pauses
    sign-animation/         ◄ playback + rendering. Largest subtree (~50 files).
    type-to-sign/           Direction B UI, progressive loading
    suggestions/            letter/word suggestion engine
    analytics/              admin-side offline analysis (drift, clustering, quality)
    active-learning/        feedback → retraining candidate pipeline
    ai-assist/              admin authoring helpers

  lib/supabase/             client, queries, generated types

scripts/                    128 .mjs files. Dataset building, training, export,
                            auditing. Most are one-off phase artifacts — see §9.
models/fsl_unified/         trained weights (JSON), metrics, confusion matrices
public/models/              ◄ what the browser actually downloads
datasets/processed/         train/val/test splits (NDJSON)
supabase/migrations/        0001 … 0037
```

---

## 4. Direction A — Sign → Text (the recognition algorithm)

This is the part a reviewer will ask about. The full chain, in order:

```
webcam frame (640×480, facingMode:user)
  → MediaPipe Hand Landmarker      → up to 2 hands × 21 landmarks × (x,y,z)
  → normalizeLandmarks()           → 126-float frame vector
  → SequenceBuffer.append()        → rolling 120-frame window
  → adaptiveSample()               → 35 frames at FIXED trained indices → [1,35,126]
  → TF.js BiLSTM .predict()        → softmax over 131 classes
  → translateResult()              → display label ("a" → "A", "IM FINE" → "I'm Fine")
  → PredictionSmoother.smooth()    → majority vote over 5 + hysteresis
  → RecognitionPriorityManager     → motion/phase-aware boost
  → UI + freeze logic
```

### 4.1 Capture and landmark extraction

[`handCaptureProfile.ts`](src/features/sign-to-text/handCaptureProfile.ts) holds all
MediaPipe config. Three user-selectable sensitivity presets:

| Preset | detection / presence / tracking confidence | Trade-off |
|---|---|---|
| Relaxed | 0.4 / 0.4 / 0.4 | Picks up hands in dim light; more jitter |
| **Balanced** (default) | 0.6 / 0.6 / 0.6 | — |
| Strict | 0.8 / 0.8 / 0.75 | Only clean well-lit hands; steadiest |

`numHands: 2`, `runningMode: "VIDEO"`. The `.task` model file is fetched from Google's
CDN by default ([`SignToTextInterface.tsx:36`](src/features/sign-to-text/SignToTextInterface.tsx#L36)),
with a local copy at `models/mediapipe/hand_landmarker.task` (7.6 MB).

### 4.2 Normalization — [`normalize.ts`](src/features/recognition/normalize.ts)

Per hand, per frame:

1. **Wrist-center**: subtract landmark 0 from all 21 points.
2. **Max-abs scale**: divide every component by `max(|x|,|y|,|z|)` across the hand.
3. Missing hand → its 63 slots stay zero.

Result: `Float32Array(126)` = `[left 21×3, right 21×3]`.

This makes the representation translation- and scale-invariant, so distance from
camera and position in frame don't matter. **The training pipeline does the exact same
two steps** — if you change one, you must retrain.

### 4.3 The temporal buffer — [`buffer.ts`](src/features/recognition/buffer.ts)

This is the subtlest part of the system and the source of a previous production bug.

```ts
SEQUENCE_LENGTH  = 120   // rolling window kept in memory (~4s at 30fps)
FEATURE_DIMENSION = 126
TEMPORAL_STEPS   = 35    // what the model actually consumes
MINIMUM_FRAMES   = 5
```

The model does **not** eat 35 evenly-spaced frames from a 35-frame window. Training
pads/truncates each clip to a **120-frame** window, then reads 35 frames at
**fixed hardcoded indices**:

```
0, 4, 7, 11, 14, 18, 21, 25, 28, 32, 35, 39, 42, 46, 49, 53, 56, 60,
63, 67, 70, 74, 77, 81, 84, 88, 91, 95, 98, 102, 105, 109, 112, 116, 119
```

Runtime must mirror this exactly. It does — `sampleAtTrainedIndices()` reads those
indices out of a 120-slot window whose tail stays zero, matching the tail-padding
training applied to short clips.

> **Why this matters:** a previous version used a 45-frame rolling window with
> even sampling, which compressed a ~4-second gesture into ~1.5 seconds of captured
> motion. The model saw a distribution it was never fitted on.
> [`temporalAlignment.test.ts`](src/features/recognition/__tests__/temporalAlignment.test.ts)
> guards this: it asserts the runtime indices equal `bilstm_v4/config.json`'s, that
> `SEQUENCE_LENGTH`/`FEATURE_DIMENSION` match the config, and that the tensor shape
> matches the **served** model's declared `batch_input_shape`. Retraining cannot
> silently desync them. **Do not "simplify" this.**

`adaptiveSample()` returns the same layout regardless; `usedEarly` only reports that
the window isn't full yet, so callers can weight a prediction made on partial evidence.

### 4.4 Inference — [`model/loader.ts`](src/features/recognition/model/loader.ts)

- Fetches `/models/fsl_unified/bilstm_tfjs/{model.json,weights.bin,labels.json}`,
  assembles `tf.io.ModelArtifacts` **manually** and loads via `tf.io.fromMemory`
  (not `tf.loadLayersModel(url)` — the export writes a topology that needs this path).
- Warms up with a `tf.zeros([1, 35, 126])` predict so the first real frame isn't slow.
- `infer()` builds `tf.tensor3d`, takes argmax + top-5, and **disposes both tensors**.
  Any new tensor you create here must be disposed or the tab leaks GPU memory.
- Module-level promise guard means the model loads exactly once per page.

**Deployed model:** Bidirectional LSTM, 48 hidden units per direction (96 combined),
dropout 0.25, dense-softmax over **131 classes** (26 letters + 105 phrase/number/
day/month/color/food glosses). Weights: 312 KB.

### 4.5 Smoothing — [`smoothing.ts`](src/features/recognition/smoothing.ts)

Raw per-inference output flickers. `PredictionSmoother` keeps a 5-entry history and:

- **Majority vote** on label across the window.
- **Hysteresis (0.10)**: to displace the current stable label, a challenger must beat
  it by 0.10, not merely tie. Without this the label oscillates between two
  near-equal classes.
- Confidence reported is the **window average**, not the instantaneous value.
- Top-K is re-ranked by *frequency across the window*, not by raw probability.

### 4.6 Motion detection — [`motionDetection.ts`](src/features/recognition/motionDetection.ts)

A small finite state machine that answers "is the user mid-sign or resting?"

**States:** `idle` ⇄ `gesturing`. **Phases:** `none → start → hold → end`.

Motion metric = mean Euclidean landmark displacement between consecutive frames,
averaged across present hands.

| Constant | Value | Meaning |
|---|---|---|
| `MOTION_THRESHOLD` | 0.015 | above → counts as active |
| `IDLE_THRESHOLD` | 0.005 | *(declared, currently unused)* |
| `START_FRAMES` | 3 | consecutive active frames to enter `gesturing` |
| `IDLE_FRAMES` | 15 | idle frames in `hold` before dropping to `idle` |
| `STABILITY_VARIANCE_THRESHOLD` | 0.003 | velocity variance below this = a held pose |

Phase transitions use **velocity variance** over a rolling window, so a "hold" is
detected by *stillness of motion*, not absence of motion.

### 4.7 Orchestration — [`useRecognition.ts`](src/features/recognition/useRecognition.ts)

The hook that ties it together. Inference runs on a `setInterval`, decoupled from the
camera's `requestAnimationFrame` loop (which only appends frames).

| Constant | Value |
|---|---|
| `INFERENCE_INTERVAL_MS` | 100 |
| `EARLY_INFERENCE_INTERVAL_MS` | 30 |
| `EARLY_CONFIDENCE_THRESHOLD` | 0.85 |
| `FREEZE_HYSTERESIS_FRAMES` | 10 |
| `UI_UPDATE_INTERVAL_MS` | 300 |

Three behaviours worth knowing:

1. **Freeze-on-stable** — when motion is `idle` and smoothed confidence ≥ 0.6 for 10
   consecutive inferences, the prediction is frozen and surfaced as
   `frozenPrediction`. Any `gesturing` transition clears it immediately.
2. **Early prediction** — if the buffer isn't full but confidence ≥ 0.85 on the same
   label 3 times running, the buffer resets so the next sign can start cleanly.
   This is what makes fingerspelling feel responsive.
3. **Render throttling** — state updates are gated on `UI_UPDATE_INTERVAL_MS` and on
   a `label:confidence` key, because naive updates at 30 Hz cause React to drop frames.

> **Effective inference cadence:** `fastMode ? 30ms : 100ms`. The `FAST_INFERENCE_INTERVAL_MS`
> (50) branch at [`useRecognition.ts:99`](src/features/recognition/useRecognition.ts#L99)
> is computed but never reached — see [§12](#12-documentation-drift-read-this-before-trusting-any-other-doc).

---

## 5. Direction B — Text → Sign

Completely separate machinery. Entry point: `globalPipeline` in
[`PipelineOrchestrator.ts`](src/features/translation-pipeline/PipelineOrchestrator.ts).

### 5.1 The 9-stage pipeline

Every stage is an interface with a swappable default (`replaceStage()`), and each run
is timed and recorded into `stageResults` — that's what feeds `/admin/translation-debug`.

| # | Stage | Does |
|---|---|---|
| 1 | `LanguageDetector` | English vs Tagalog, from token overlap |
| 2 | `TextNormalizer` | lowercase, punctuation, contractions → word list |
| 3 | `SentenceSegmenter` | split on sentence boundaries |
| 4 | `FslTranslator` | words → gloss sequence (dictionary + 35+ grammar rules) |
| 5 | `GlossOptimizer` | drop articles/copulas, reorder to FSL topic-comment order |
| 6 | `UnknownGlossHandler` | synonym → morphology strip → fingerspell → placeholder |
| 7 | `AnimationPlanner` | per-gloss durations, total timeline |
| 8 | `CoarticulationBridge` | inter-sign transition blending |
| 9 | `ExpressionController` | non-manual expression tag per gloss (20 profiles) |

FSL grammar is **not** English word order. `GlossOptimizer` is where "I am going to
the store" becomes something closer to `STORE GO ME`. The rules live in
[`fslGrammar.ts`](src/features/fsl-translation/grammar/fslGrammar.ts).

The dictionary ([`gestureDictionary.ts`](src/features/fsl-translation/dictionary/gestureDictionary.ts))
is 49 KB of hand-authored mappings — the single biggest determinant of translation
quality. It is edited **in source**; despite what `AGENTS.md` Phase 43b says, there is
no `/admin/translation` CRUD page in the tree (see [§12](#12-documentation-drift-read-this-before-trusting-any-other-doc)).

**Unknown words never hard-fail.** The fallback ladder in
[`fallback.ts`](src/features/text-to-sign/fallback.ts) tries synonyms, then
`simplifyMorphology()` (strips `-ing`/`-s`/`-ed`/`-ly`/`-tion`), then fingerspells
letter-by-letter, then emits a visible placeholder.

### 5.2 Animation assets

An animation is **not a video**. It's recorded landmark data:

```ts
GestureAnimationAsset {
  label, language, fps, duration, totalFrames,
  frames: [{ timestamp, landmarks[], poseLandmarks?, faceLandmarks? }],
  video?, imageWidth?, imageHeight?, sourceOffsetSeconds?, trim?,
  metadata: { signerId?, source?, featureDimension, sequenceLength, handedness?, version }
}
```

Captured from real signer video via MediaPipe **Holistic** (hands + pose + face) in
[`holisticVideoExtractor.ts`](src/features/sign-animation/extraction/holisticVideoExtractor.ts),
then rendered back onto canvas at playback. This is why the avatar reproduces real
human motion rather than interpolated keyframes.

**Resolution order** — [`api/animations/[gloss]/route.ts`](src/app/api/animations/[gloss]/route.ts):

1. Supabase `getPublishedAnimationAsset(gloss)` — the published/moderated version
2. Local filesystem `datasets/processed/user_holistic_assets/<gloss>/*_asset.json`
3. `404`

Cached `public, max-age=300`. Step 2 means **local dev can serve assets that
production does not have** — if a gloss animates locally but 404s on Vercel, it was
never published to Supabase.

### 5.3 Playback and rendering

[`sign-animation/`](src/features/sign-animation/) is the largest subtree. Key pieces:

- [`AnimationLoader.ts`](src/features/sign-animation/loader/AnimationLoader.ts) — cache +
  in-flight dedupe (two requests for the same gloss share one promise). Exported as a
  cross-component singleton `globalLoader`. Also repairs assets whose `duration` was
  written in seconds instead of ms.
- `PlaybackEngine.ts` / `PlaybackSequencer.ts` — queue, timeline, seek, speed.
- `ExactLandmarkRenderer.ts` (24 KB) and `AdvancedCanvasRenderer.ts` (20 KB) — canvas
  drawing. Four avatar themes (`minimal`, `skeleton`, `flat`, `avatar2d`).
- `oneEuroFilter.ts` — the **1€ filter** for jitter removal: adaptive low-pass that
  cuts noise when still but stays responsive when moving. Standard for landmark
  smoothing; don't replace it with a plain moving average.
- `FingerspellingEngine.ts` (15 KB) — synthesizes letter-by-letter sequences with
  realistic inter-letter timing when no whole-word asset exists.
- `pauseEngine.ts` — punctuation-aware pauses: comma 0.35s, sentence 0.8s, `?`/`!`
  0.5–0.6s.

### 5.4 Progressive loading

[`useProgressiveSignTranslation.ts`](src/features/type-to-sign/useProgressiveSignTranslation.ts)
loads every word's asset **in parallel** but reveals only a *consecutive ready prefix*
([`orderedFlush.ts`](src/features/type-to-sign/orderedFlush.ts), unit-tested). Words
resolve out of order over the network; they must never *appear* out of order. The
player's `isStreaming` prop lets clips be appended to a running sequence without
restarting from clip 0.

---

## 6. Where the AI actually is

Be precise about this — the codebase uses "AI" and "intelligence" loosely in admin
feature names, and most of those are not machine learning.

| # | Component | What it really is | Runs |
|---|---|---|---|
| 1 | **MediaPipe Hand Landmarker** | Google's pretrained CNN. Third-party, not trained here. | Browser (WASM) |
| 2 | **BiLSTM classifier** | **The thesis contribution.** Trained from scratch, this repo. 131 classes. | Browser (TF.js) |
| 3 | **Suggested replies** | LLM — `gpt-4o-mini` over an OpenAI-compatible API | Server, **optional** |
| 4 | Everything in `analytics/`, `active-learning/`, `ai-assist/`, intent detection, reply ranking | Deterministic heuristics + classical stats. K-Means++ is the only clustering. **No neural nets.** | Server / offline |

### The BiLSTM (#2) — this is the model

Bidirectional LSTM. Forward and backward passes over the 35-step sequence are
concatenated (48 + 48 = 96) into a dense-softmax head over 131 classes.

Bidirectional matters for sign language: many signs are only disambiguated by where
the hand *ends up*, so the classifier benefits from reading the sequence backwards too.
A causal/streaming model can't do this — which is why inference runs on a completed
buffer window rather than truly frame-by-frame.

Training hyperparameters (from `models/fsl_unified/*/config.json`):

| | |
|---|---|
| Optimizer | Adam (β₁ 0.9, β₂ 0.999, ε 1e-8) |
| LR | 0.002, cosine decay |
| Epochs | 80, early stopping patience 15 |
| Dropout | 0.25 |
| Gradient clip | ±1 |
| Label smoothing | 0.1 |
| Seed | 2026 |
| Extras | class weighting, curriculum learning |

Reported: **94.86% test accuracy, 91.85% macro F1** (Phase 45).

### The LLM (#3) — [`api/ai/replies/route.ts`](src/app/api/ai/replies/route.ts)

Given a recognized gesture + last few conversation turns, asks for 3–5 natural
replies. Bilingual system prompt (English / Tagalog).

**It is entirely optional and fails soft.** No `OPENAI_API_KEY`/`OPENROUTER_API_KEY`
→ returns a hardcoded rule-based reply dictionary. API error, empty response, or
thrown exception → same fallback. Every path returns HTTP 200. The core translator
works with zero AI keys configured.

`AI_API_BASE_URL` lets you point at any OpenAI-compatible endpoint (OpenRouter, a
local server).

### What is *not* AI

`detectIntent()` is keyword lists and regexes over 6 intents
([`intentDetector.ts`](src/features/fsl-translation/intent/intentDetector.ts)).
`GestureClusteringEngine` is K-Means++. `DriftDetector` is 6 threshold comparisons.
`DatasetQualityInspector` is 6 image heuristics (blur, lighting, framing…). Good,
useful code — just don't describe it as learned.

---

## 7. Data flow and persistence

Local-first. **`localStorage`** is the primary client store — *not* IndexedDB, despite
what `AGENTS.md` Phase 4 says (see [§12](#12-documentation-drift-read-this-before-trusting-any-other-doc)).
Supabase is sync + auth + shared assets.

[`features/logging/storage.ts`](src/features/logging/storage.ts) owns the keys:
`fsl_recognition_logs`, `fsl_recognition_sessions`, `fsl_transcripts`,
`fsl_pending_queue`, `fsl_sync_meta`. Writes that need the server go on the pending
queue instead of blocking the UI; `sync.ts` flushes it opportunistically. All of it is
guarded by an `isLocalStorageAvailable()` probe, so private-mode browsers degrade
rather than throw.

Notable tables (37 migrations under `supabase/migrations/`):
`translation_sessions`, `translation_logs`, `gesture_definitions`, `conversation_sessions`,
`conversation_messages`, `telemetry_events`, `review_queue`, `model_versions`,
`animation_assets`, `gesture_knowledge_base`, `gesture_confusion_pairs`.

Since Phase 27 there are **no user accounts**. Anonymous sessions are keyed by
`session_token` with nullable `user_id`; admin access is enforced by RLS against auth
metadata (`requireAdmin`).

Translation text is computed at the **display layer** (`translation.ts`) and is not
persisted — the DB stores gloss labels. Change the display map freely; you won't
invalidate history.

---

## 8. Running it

```bash
nvm use && npm install && npm run dev
```

| Command | Does |
|---|---|
| `npm run dev` | dev server on :3000 |
| `npm run build` | production build (needs Node 22 — see §2) |
| `npm test` | Vitest, 47 test files |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | next lint |
| `npm run knip` | unused-export detection |

Camera pages need HTTPS or `localhost` (`getUserMedia` requirement).
`.env.example` lists required vars; Supabase URL + anon key are the only ones needed
for a working app.

### 8.1 Deployment topology — the admin is local-only

**The admin does not exist on the deployed site.** `/admin/*` and `/api/admin/*` both
return **404** in production. This is intentional, and the reason it costs nothing is
that the admin is a *content-authoring tool*, not a runtime dependency:

```
  localhost  ──[ upload → extract → publish ]──►  Supabase  ◄──[ read ]──  deployed site
   (admin)                                     (assets + Storage)          (public app)
```

Sign-to-Text and Text-to-Sign read published assets from Supabase at request time. The
data is **shared, not per-environment**, so publishing from localhost is visible on the
deployed site immediately — no deploy, no rebuild. That is the supported authoring
workflow.

**Running admin locally.** Set the flag in `.env.local`:

```bash
ADMIN_ENABLED=true
```

You still need an admin Supabase session (`app_metadata.role === "admin"`); the flag
controls whether the surface *exists*, not who may use it.

**What happens in production.** The flag is unset on Vercel, so:

| | |
|---|---|
| `/admin/*` | `404` — **not** a redirect to `/admin/login` |
| `/api/admin/*` | `404`, on every method |
| `/api/animations`, `/api/animations/<gloss>` | unaffected — these are public and the app depends on them |

A 404 rather than a login redirect is deliberate: a redirect advertises that an admin
panel exists and points at its door.

**How the flag works.** `src/lib/admin/availability.ts` — explicit, and **default off**,
so a missing variable fails closed. Only `true` or `1` enable it; `yes`, `on`, `TRUE`
and anything else are off. It deliberately does **not** read `NODE_ENV`: that reads as
"development mode" rather than "the admin is reachable", and the two come apart the
moment someone runs a production build locally.

Two layers enforce it, deliberately redundant:

1. **`src/middleware.ts`** — gates before the session is touched. Covers both the pages
   and the API routes.
2. **`requireAdmin()`** — throws `NotFoundError` when the flag is off. The middleware
   depends on a matcher regex; one edit to it would re-expose every privileged route
   with nothing to notice, so the gate also travels with the privilege itself.

`e2e/admin-gate.spec.ts` asserts the production 404 **route by route**, enumerating from
disk rather than from a hardcoded list — so a newly added admin route cannot quietly
ship exposed.

---

## 9. The offline training pipeline

Four blessed npm scripts, in order. **Everything else in `scripts/` (128 files) is a
one-off phase artifact.** Many are versioned duplicates (`-v2`, `-v3`, `-v4`, `-v45`)
left in place after later phases superseded them. Check the script header and the
matching `AGENTS.md` phase entry before running anything unlisted.

```bash
npm run standardize:fsl-alphabet   # raw alphabet dataset → normalized form
npm run build:unified-v4           # merge sources → datasets/processed/fsl_unified_v4
npm run train:unified              # train → models/fsl_unified/bilstm_v4
npm run export:unified-tfjs        # → public/models/fsl_unified/bilstm_tfjs  ◄ DEPLOY
```

Verified source→sink chain:

```
fsl_alphabet_kaggle_v2 + fsl_105 + fsl_unified_augmented + hard_cases
  └─ build-unified-dataset-v4.mjs  → datasets/processed/fsl_unified_v4
       └─ train-unified-bilstm-v2.mjs → models/fsl_unified/bilstm_v4     ⚠ see §12
            └─ export-unified-bilstm-tfjs.mjs → public/models/fsl_unified/bilstm_tfjs
```

Current dataset: **14,217 samples, 131 classes, 7 signers** (including a Kaggle-sourced
signer). Splits are stratified NDJSON with a header row carrying `sequenceLength` and
`featureDimension`; the trainer **rejects** a file whose header doesn't match its
constants — that guard is deliberate, don't remove it.

### Training is hand-written JS

[`train-unified-bilstm-v2.mjs`](scripts/train-unified-bilstm-v2.mjs) implements LSTM
cells, backprop-through-time, Adam, gradient clipping and label smoothing directly over
`Float32Array`s. Also included: seeded `mulberry32` PRNG, Box–Muller normal init,
sparse frame encoding (most of a 126-vector is zero when one hand is absent).

Consequences you need to plan for:
- **No CUDA.** Training is CPU-bound and takes a long time.
- **Fully reproducible** — fixed seed 2026, no nondeterministic kernels.
- **Zero Python dependency** at train time. (`requirements.txt` is only for the
  Kaggle download/landmark-extraction side.)

### Before you retrain

`public/models/fsl_unified/bilstm_tfjs/` is **what real users download.** Overwriting
it is a deploy. Treat `export:unified-tfjs` as a production release step, not a build
step. Training/extraction runs take minutes to hours and touch large files under
`datasets/` — nothing in that directory should be assumed disposable.

After any dataset or model work, append a `Phase N — Title` entry to `AGENTS.md`
following the existing convention.

---

## 10. Testing

47 Vitest files colocated in `__tests__/` next to what they cover. Highest-value ones,
because they encode invariants that silently break the model if violated:

- `recognition/__tests__/temporalAlignment.test.ts` — runtime sampling indices ==
  training config == served model's input shape. **The most important test here.**
- `recognition/__tests__/buffer.test.ts`, `normalize.test.ts`, `smoothing.test.ts`
- `sign-to-text/__tests__/handCaptureProfile.test.ts` — MediaPipe option shape
- `type-to-sign/__tests__/orderedFlush.test.ts` — progressive reveal ordering
- `sign-animation/.../landmarkAssetProcessing.test.ts` — asset schema
- `pipelineIntegrity.test.ts`, `exactPlayback.test.ts`, `animationAssetResolver.test.ts`

Playwright e2e in `e2e/`. Camera tests need fake-media browser flags.

---

## 11. Performance notes

- Inference is **decoupled from capture.** rAF appends frames; `setInterval` runs the
  model. Don't merge them.
- ~165 ms end-to-end (~18 ms MediaPipe, ~8–12 ms TF.js, remainder buffering + UI).
- React state updates are throttled to 300 ms; the canvas is not React-rendered.
- `SignToTextInterface` is `next/dynamic`-imported out of `/translate`'s initial
  bundle — the default tab never mounts it.
- [`src/lib/commonAssetsPreload.ts`](src/lib/commonAssetsPreload.ts) warms the alphabet
  + common greetings during idle time.
- **Always `tf.dispose()`** new tensors. TF.js does not GC them.

---

## 12. Documentation drift (read this before trusting any other doc)

The project ran ~48 phases across many sessions. Several docs assert things the code
no longer does. Verified against the code on 2026-07-27:

### Stale documents — two now fixed

`SYSTEM_FLOW.md` and `SYSTEM_OVERVIEW.md` **have been rewritten** (2026-07-27) and are
now accurate. They previously described a CNN-LSTM and a "Phase 1, frontend only"
prototype.

`README.md`'s Phase 1/3 sections are **still stale** — they describe a placeholder
classifier and say "CNN-LSTM is Phase 2". The Node-version section of that file is
current and correct; the phase-status sections are historical.

### Storage is `localStorage`, not IndexedDB

`AGENTS.md` Phase 4 says "Local storage fallback (idb)" and the Key Architecture
Decisions say "IndexedDB as primary store". There is **no IndexedDB anywhere in
`src/`** — [`features/logging/storage.ts`](src/features/logging/storage.ts) uses
`localStorage` exclusively. `idb` is not a dependency.

### `AGENTS.md` claims hybrid recognition is live — it is not

Phase 23 and the "Current Status" section describe a hybrid static+temporal recognizer
("2 models, 240 KB LLC + 475 KB BiLSTM, motion-aware routing, confidence fusion").
**None of it is wired in today:**

- No `src/features/recognition/hybrid/` directory exists.
- `useRecognition.ts` calls only `infer(sample)` — the temporal BiLSTM — and hardcodes
  `recognitionSource: "temporal"` ([line 145](src/features/recognition/useRecognition.ts#L145)).
- `public/models/` contains exactly one model (`bilstm_tfjs`, 312 KB). There is no
  static/LLC model to route to.

The `.claude/skills/fsl-pipeline` skill repeats this claim and is wrong for the same
reason. Accuracy figures quoted as "hybrid" (91.5% alphabet / 92.3% phrase) do not
describe the shipping system; **94.86% test accuracy on the BiLSTM does.**

### Script name vs. output path

`train-unified-bilstm-v2.mjs` writes to `models/fsl_unified/bilstm_v4/`, and
`export-unified-bilstm-tfjs.mjs` reads from `bilstm_v4/`. The "v2" in the filename is
the *script* version, not the model version. `AGENTS.md` Phase 45 describes this run as
producing "bilstm_v2", which reads as a different directory than the one the pipeline
actually uses. **`bilstm_v4/` is the production model directory.** `bilstm_v2/` and
`bilstm_v4_bak/` are earlier artifacts.

Relatedly, [`buffer.ts:8`](src/features/recognition/buffer.ts#L8) cites the `bilstm_v4`
config for `temporalFrameIndices`. That's correct — and it's corroborated by
`temporalAlignment.test.ts`, which reads that same `bilstm_v4/config.json`. (`bilstm_v2`
happens to carry identical indices, so the comment holds either way.)

### Two more small mismatches

- [`buffer.ts:20`](src/features/recognition/buffer.ts#L20) names the guard test
  `temporalFrameIndices.test.ts`. The file is actually
  `__tests__/temporalAlignment.test.ts`. The test exists and does what the comment
  claims — only the filename in the comment is wrong.
- `AGENTS.md` Phase 43b advertises a "full CRUD dictionary manager at
  `/admin/translation`". No such route exists (`/admin/translation-debug` and
  `/admin/translation-evaluation` do). Edit `gestureDictionary.ts` in source.

### Dead code in the hot path

Harmless today, misleading when you're debugging:

- [`useRecognition.ts:67`](src/features/recognition/useRecognition.ts#L67) —
  `lastStaticFrameRef` declared, never read or written. Residue of the hybrid work.
- [`useRecognition.ts:64`](src/features/recognition/useRecognition.ts#L64) —
  `noMotionCounterRef` only ever reset, never incremented or read.
- [`useRecognition.ts:99`](src/features/recognition/useRecognition.ts#L99) — `interval`'s
  `fastMode` branch (50 ms) is unreachable; the effective cadence is 30 ms or 100 ms.
- [`PipelineOrchestrator.ts:100-105`](src/features/translation-pipeline/PipelineOrchestrator.ts#L100) —
  the coarticulation loop assigns `transition` and discards it, and passes the same
  gloss as both `from` and `to`. Stage 8 is currently a no-op.
- [`motionDetection.ts:4`](src/features/recognition/motionDetection.ts#L4) —
  `IDLE_THRESHOLD` declared, never used.

### Counts in `AGENTS.md` are behind

"8 test files with 163 passing tests" — actual: 47 test files, ~790 passing (per the
Phase 47 entry). "133+ model classes" — actual: 131. Phase 46 also records that
`npm run build` fails under Node 24; that's the version pin in §2, not a code bug.

---

## 13. Quick orientation by task

| You want to… | Start at |
|---|---|
| Change how signs are recognized | `src/features/recognition/useRecognition.ts` |
| Fix a wrong/jittery prediction | `smoothing.ts`, then `motionDetection.ts` |
| Add a recognizable sign | Retrain — §9. Not a code change. |
| Change how text becomes gloss | `translation-pipeline/stages/`, `fsl-translation/grammar/` |
| Add a word→gloss mapping | `fsl-translation/dictionary/gestureDictionary.ts` (source edit) |
| Fix animation playback | `sign-animation/player/PlaybackEngine.ts` |
| Change the avatar's look | `sign-animation/renderer/` |
| Add an animation for a gloss | `/admin/animation-studio` → publish to Supabase |
| Debug a translation | `/admin/translation-debug` (per-stage timings + output) |
| Check model health | `/admin/model-health`, `/admin/recognition-analysis` |
| Retrain | §9 — and read the warnings first |
