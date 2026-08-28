# Senyalita — Developer Guide

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
| **A — Sign → Text** | `/translate` | Webcam video | Recognized gloss + display text + TTS |
| **B — Text → Sign** | `/translate` | Typed text | Gloss sequence + animated landmark playback |

Both directions live on `/translate`, tabbed. There are **four public routes** total:
`/`, `/translate`, `/learn` (FSL reference), `/evaluation` (accuracy harness).
`/conversation`, `/presentation`, `/type-to-sign`, and `/history` were removed in the
final-architecture cleanup and redirect rather than 404.

The defining architectural property: **recognition is 100% client-side.** The model
weights are a 313 KB static file served from `public/`. No inference server, no GPU
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
| DB / auth | Supabase (Postgres + RLS), 41 migrations |
| Rendering | HTML5 Canvas 2D (no WebGL, no three.js) |
| Tests | Vitest + Playwright, 69 test files total |
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

THE SINGLE HOME FOR STRUCTURE. FOLDER_STRUCTURE.md and MODULES_OVERVIEW.md were
deleted into this section, and SYSTEM_DOCUMENTATION.md §14 now points here.

Four documents described the layout and all four were wrong, in different ways.
Three repeated the same `active-learning/` error, which is how you can tell they
were copied from one another rather than read off the tree. Every one of them
omitted `accessibility/`. This section was the worst of the four: it claimed
`ai-assist/`, `gesture-mapping/` and `profiles/` had been deleted when all three
exist and are imported, and it listed a `text-to-sign/` feature that does not
exist. Verified against the tree on 2026-08-21, not against the other documents.

```
src/
  app/                      Next.js App Router
    page.tsx                landing
    translate/              main surface: both directions, tabbed
    learn/                  FSL reference — alphabet, numbers, tutorials
    evaluation/             accuracy harness (thesis figures)
    admin/                  local-only — see §8.1
    api/                    animations, admin/*, ai/replies, assets, videos

  features/                 13 directories, organised by domain, not by layer
    recognition/            ◄ DIRECTION A core. Buffer, normalize, model, smoothing,
                              motion detection, hand slots, label partition,
                              priority, the useRecognition hook.
    sign-to-text/           Direction A UI + camera + MediaPipe wiring
    translation-pipeline/   ◄ DIRECTION B core. 9-stage orchestrator.
    fsl-translation/        text → FSL gloss engine (grammar, dictionary)
    sign-animation/         ◄ playback + rendering. Largest subtree.
    type-to-sign/           Direction B composer and stage viewer, used by
                              app/translate. NOT a route of its own.
    suggestions/            letter/word suggestion engine (DP segmentation)
    accessibility/          contrast + text-size provider and menu, mounted in
                              the root layout so every route inherits it
    gesture-mapping/        gloss dictionary; used by lib/learn/vocabulary
    ai-assist/              quality analysis and publish verdicts; reached only
                              from the admin AnimationStudio, which is local-only
    profiles/               capture profile, used by SignToTextInterface
    learn/                  the /learn sign player
    animation/              ORPHANED. index.ts + types.ts, imported by nothing.

  lib/supabase/             client, queries, generated types
  lib/admin/availability.ts admin on/off flag — see §8.1

scripts/                    dataset building, training, export, auditing. Most are
                            one-off phase artifacts — see §9.
models/fsl_unified/         trained weights (JSON), metrics, confusion matrices
public/models/              ◄ what the browser downloads: bilstm_tfjs + mediapipe
datasets/processed/         train/val/test splits (NDJSON)
supabase/migrations/        0001 … 0042
```

**Genuinely removed** (recoverable via `git show pre-cleanup:<path>`):
`analytics/`, `active-learning/`, `conversation/`, `adaptive-*`,
`knowledge-expansion/`, and most of the admin pages. Do not reintroduce them by
copying from history without checking why they went. `ai-assist/`,
`gesture-mapping/` and `profiles/` were previously listed here in error — they
survive and are imported.

**Reachable but unused.** Verified by import count, excluding barrels and tests:
`BodyMotionEngine`, `MotionCurveEngine` and `AnimationRecommendationEngine` under
`sign-animation/player/` have no importers at all. `PhraseDetector`,
`SentenceChunker`, `PlaybackSequencer` and `NaturalTimingEngine` have exactly one
each, so they are wired but worth checking before being cited as working
features. Note `sign-animation/player/PipelineOrchestrator` is distinct from the
live `translation-pipeline/PipelineOrchestrator`.

### 3.1 Casing conventions

Folded in from MODULES_OVERVIEW.md. Every example below was resolved against the
tree, not carried over on trust.

| Item | Style | Examples |
|---|---|---|
| Variables, functions | camelCase | `motionDetection`, `coverageKey`, `formatAdminPercent` |
| Exported constants | UPPER_SNAKE_CASE | `MAX_GESTURE_CHARS`, `ADMIN_SESSION_COOKIE`, `GLOSS_SYNONYM_NORMALIZATION`, `RATE_LIMIT` |
| React components | PascalCase `.tsx` | `DebugOverlay.tsx`, `SignComposer.tsx`, `SuggestionPanel.tsx` |
| Engine/class files | PascalCase `.ts` | `PlaybackEngine.ts`, `PipelineOrchestrator.ts`, `FslTranslator.ts`, `LanguageDetector.ts` |
| Hooks | `use` + PascalCase | `useRecognition.ts`, `useFslTranslation.ts`, `useProgressiveSignTranslation.ts` |
| Types/interfaces | PascalCase | `GrammarRule`, `AnimationPlanItem`, `ProgressiveTranslationState` |
| Test files | `name.test.ts(x)` | `buffer.test.ts`, `glossDictionary.test.ts` |
| Next.js routes/dirs | kebab-case | `src/app/api`, `type-to-sign/`, `src/middleware.ts` |
| Data/JSON | kebab or camel | `motionSigns.json`, `fslGrammar.ts` |

---


## 4. Direction A — Sign → Text (the recognition algorithm)

This is the part a reviewer will ask about. The full chain, in order:

```
webcam frame (640×480, facingMode:user)
  → MediaPipe Hand Landmarker      → 21 landmarks × (x,y,z) per tracked hand
                                     (numHands: 1 Alphabet / 2 Phrase Signs)
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

`runningMode: "VIDEO"`. **`numHands` is mode-dependent and defaults to 1** —
[`handCaptureProfile.ts:48`](src/features/sign-to-text/handCaptureProfile.ts#L48).
Tracking a second hand roughly halves throughput (measured at 480px input:
2 hands → 631 ms/detection ≈ 1 FPS; 1 hand → 342 ms ≈ 3 FPS), so Alphabet mode
runs with one and Phrase Signs mode rebuilds the graph with two.

`numHands` is **compiled into the MediaPipe graph** when the detector is
created, so changing it rebuilds the graph — the `MediaStream` is unaffected and
the camera keeps running. The feature vector stays 126 (two hands × 21 × 3)
either way; the absent hand is zero-filled, exactly as it already is whenever
only one hand is in frame.

The `.task` model and the WASM runtime are
**self-hosted**, not fetched from a third-party CDN — see
[`handLandmarkerConfig.ts`](src/features/sign-to-text/handLandmarkerConfig.ts). The
task file ships at `public/models/mediapipe/hand_landmarker.task`; a copy also lives
at `models/mediapipe/`. Same reasoning as self-hosting Inter in `0c2ad36b`: a cold
third-party fetch on the critical path is both a load cost and a build-time network
dependency, and a demo on venue wifi is exactly when it bites.

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

#### Gesture spans are resampled — the alphabet path is not (`550a0563`)

**This is the single most important thing in the recognition pipeline.** The two
categories of training clip fill the 120-frame window differently:

- **Alphabet clips** are a static image replicated across all 120 slots, so a letter
  is invariant to how long it is held.
- **Gesture clips** are real video, time-normalized so the movement spans the whole
  window.

Tail-zero padding reproduces the *alphabet* layout. Applied to a gesture it is
wrong: a 42-frame THANK YOU occupied slots 0–41 and left 78 empty, so the model saw
the movement at roughly **three times its trained speed**. Measured against the
served model: **THANK YOU 88.3% → 9.0%, predicting DARK.**

So a marked gesture span is now stretched across the trained window, mirroring
training's interpolation. **With no gesture marked the raw window is used unchanged,
so the alphabet path is byte-for-byte what it was.**

Two boundary details that cost real accuracy, and that you will be tempted to
"simplify":

- **Spans are marked by `useRecognition` from `MotionDetector` transitions, on raw
  landmarks.** Motion cannot be measured in the normalized space — that space is
  wrist-centred and max-abs scaled, so a hand travelling across the body registers
  no movement at all.
- **Onset is rewound by `START_FRAMES`**, because the detector needs that much
  movement before it will call a gesture and the start is already behind.
- **Trailing idle is trimmed, but only while the remainder stays above
  `MIN_GESTURE_FRAMES`** (31, the 5th percentile of training durations). A held
  letter and a finished gesture are both movement-then-stillness, and motion alone
  cannot separate them — trimming a letter's hold removes the letter. Measured: a
  5-frame reach into a 15-frame hold read `t` at 12% once trimmed, against `b` at
  74% intact. Untrimmed, GOOD MORNING read GIRL at 30% against 86% trimmed.

Guarded by `__tests__/motionSignRecognition.test.ts` against the served model with
real dataset landmarks: the gesture path, the held-letter regression, and
reach-into-letter spans.

### 4.4 Inference — [`model/loader.ts`](src/features/recognition/model/loader.ts)

- Fetches `/models/fsl_unified/bilstm_tfjs/{model.json,weights.bin,labels.json}`,
  assembles `tf.io.ModelArtifacts` **manually** and loads via `tf.io.fromMemory`
  (not `tf.loadLayersModel(url)` — the export writes a topology that needs this path).
- Warms up with a `tf.zeros([1, 35, 126])` predict so the first real frame isn't slow.
- `infer()` builds `tf.tensor3d`, takes argmax + top-5, and **disposes both tensors**.
  Any new tensor you create here must be disposed or the tab leaks GPU memory.
- Module-level promise guard means the model loads exactly once per page.

**Deployed model:** Bidirectional LSTM, 48 hidden units per direction (96 combined),
dropout 0.25, dense-softmax over **131 classes**. Weights: 313 KB.

The 131 partition into three groups, and the UI depends on this being exact:

| Group | Count | Form |
|---|---|---|
| Letters | 26 | single lowercase char, `a`–`z` |
| Numbers | 10 | word labels `ONE`…`TEN` — **there is no `ZERO`** |
| Phrases | 95 | multi-character glosses |

[`labelPartition.ts`](src/features/recognition/labelPartition.ts) derives these from
`labels.json` and `assertPartition()` checks the three cover the label set exactly.
**Do not hardcode these lists.** A hardcoded digit row once advertised `0`–`9` in the
UI — a class that cannot be recognized, while omitting `TEN`, which can. The same
drift put a 20-item battery in `/evaluation` against a 131-class model.

Note the asymmetry: Text-to-Sign can *render* a `0` animation (assets cover `0`–`10`),
but Sign-to-Text can never *recognize* one.

### 4.5 Smoothing — [`smoothing.ts`](src/features/recognition/smoothing.ts)

Raw per-inference output flickers. `PredictionSmoother` keeps a 5-entry history and:

- **Majority vote** on label across the window.
- **Hysteresis (0.10)**: to displace the current stable label, a challenger's *vote
  share* must exceed the incumbent's *vote share* by 0.10. Without this the label
  oscillates between two near-equal classes.
- Confidence reported is the **window average**, not the instantaneous value.
- Top-K is re-ranked by *frequency across the window*, not by raw probability.

> **Both sides of the hysteresis comparison must be vote shares.** An earlier version
> compared a vote ratio (0–1) against `lastStableConfidence`, which held a model
> probability. Different units: with an incumbent at 0.95 the challenger needed a
> vote share above 1.05, which cannot exist. The label locked until something reset
> the smoother, which presented as "sign A, then sign B, and nothing happens for
> several seconds." Fixed — leading 4-1 in a 5-frame window is a 0.6 margin, well
> clear of 0.10. If you touch this, keep the units identical on both sides.

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
4. **Commit clears the sequence.** `commitPrediction` in
   [`SignToTextInterface.tsx`](src/features/sign-to-text/SignToTextInterface.tsx)
   calls `clearSequence()` after appending. It did not, and the next sign then
   competed against a 120-frame buffer still full of the previous one — up to four
   seconds at 30fps. Together with the hysteresis unit bug above, that made the
   stall unrecoverable rather than merely slow. Keep the reset.
5. **Numbers reach the transcript but not the spelling buffer.** The suggestion
   engine matches a run of characters against a word dictionary, so a digit mid-word
   can never match and would suppress suggestions until cleared. `appendLabel` would
   also mangle `"10"` — it slices the first character of anything outside
   `MULTI_CHARACTER_LABELS`, so TEN became `1`.

> **Effective inference cadence:** `fastMode ? 30ms : 100ms`. The `FAST_INFERENCE_INTERVAL_MS`
> (50) branch at [`useRecognition.ts:99`](src/features/recognition/useRecognition.ts#L99)
> is computed but never reached — see [§12](#12-documentation-drift-read-this-before-trusting-any-other-doc).

---

## 5. Direction B — Text → Sign

Completely separate machinery. Entry point: `globalPipeline` in
[`PipelineOrchestrator.ts`](src/features/translation-pipeline/PipelineOrchestrator.ts).

### 5.1 The 9-stage pipeline

Every stage is an interface with a swappable default (`replaceStage()`), and each run
is timed and recorded into `stageResults`. That used to feed `/admin/translation-debug`,
which no longer exists — the timings are still collected, but nothing renders them.

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

1. Supabase published asset → **307 redirect to a short-lived signed Storage URL**
2. Local filesystem `datasets/processed/user_holistic_assets/<gloss>/*_asset.json`
   — only when `ANIMATION_LOCAL_FALLBACK` is on; **off in production**
3. `404`

The route **no longer proxies the bytes.** It resolves a path, signs it, and
redirects; the payload goes straight from Storage's CDN to the browser. Before this,
each request pulled ~3 MB through the function and spent ~50 ms parsing plus ~40 ms
re-serializing it on a single event loop. Measured end-to-end for one cold letter:
121.7 s → 33.3 s, with function bandwidth going from 3,011,400 B to 0.

Three details that will bite you:

- **307, not 308.** A permanent redirect would be cached by the browser against a URL
  that expires in ten minutes and then replayed forever after it died. The redirect
  itself caches for 60 s — long enough to absorb a burst on one gloss, short enough
  never to hand out a near-expired signature.
- **`X-Animation-Source` rides the redirect, not the final response.** Anything
  asserting it must use `redirect: "manual"`. That header is the only thing
  distinguishing a published asset from the dev fallback, and its absence hid a
  six-week bug.
- **Step 2 means local dev can serve assets production does not have.** If a gloss
  animates locally but 404s on the deployed site, it was never published to Supabase.
  Run with the fallback disabled (`npm run dev:prod-assets`) when you want dev to
  behave like production.

**Publishing ceiling.** Landmark JSON goes in the request body and the platform caps
requests at 4.5 MB — roughly four seconds of video. THANK YOU at 189 frames is
7.55 MB and cannot be published from the deployed app at all. Face-mesh landmarks
measured at ~90% of payload (6.01 MB → 0.61 MB without them), so that is the lever;
note that non-manual markers carry grammar in signed languages, so downsampling beats
dropping.

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
| 3 | **Suggested replies** | LLM — `gpt-4o-mini` over an OpenAI-compatible API. **Unwired:** `/api/ai/replies` exists and `lib/ai-replies.ts` is the client half, but nothing in the app calls it. | Server, **optional** |
| 4 | Intent detection, reply ranking | Deterministic heuristics + classical stats. **No neural nets.** | Server / offline |

`analytics/`, `active-learning/` and `ai-assist/` were removed in the cleanup. If a
doc or a phase entry refers to drift detection, gesture clustering or dataset quality
inspection, that code is in history, not in the tree.

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

Reported, for the DEPLOYED model: **bilstm_v4 — 93.99% test accuracy, 94.10%
macro F1** (`models/fsl_unified/bilstm_v4/metrics.json`).

The figures here were 94.86% / 91.85%, which are **bilstm_v2**'s. v2 has higher
accuracy and materially lower macro F1, so quoting it was not merely stale — it
overstated accuracy and understated balance at the same time. The served
`labels.json` hashes identically to v4's and differently from v2's, so v4 is what
is deployed. Always state the model version beside an accuracy figure; a number
without its model is exactly how this survived across five documents.

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
([`intentDetector.ts`](src/features/fsl-translation/intent/intentDetector.ts)). The
word suggestion engine is dynamic-programming segmentation plus banded ranking
([`matching.ts`](src/features/suggestions/matching.ts)) — a real algorithm, but not a
learned one. Everything with "Engine" in its name under `sign-animation/player/` is a
heuristic. Good, useful code — just don't describe any of it as learned.

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

Notable tables (41 migrations under `supabase/migrations/`):
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
| `npm test` | Vitest unit suite |
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

Four blessed npm scripts, in order. **Everything else in `scripts/` (124 files) is a
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
no longer does. Verified against the code on **2026-08-10**:

### The recurring failure — a check narrower than the claim drawn from it

This has now happened five times, each time producing a confidently wrong statement,
and each time invisible to typecheck, lint, tests, and build. Recognise the shape:

| What was checked | What was claimed | The gap |
|---|---|---|
| The local branch | "no credential in any tracked file" | A live `service_role` key sat on `origin/main` for six weeks |
| Placeholders `[...]`, `<...>` | "this password is exposed" | `${process.env.DB_PASSWORD}` is a template literal |
| Import graph, extensionless specifiers | "8 files are unreachable" | `import("../src/.../index.ts")` resolved to nothing |
| A populated `node_modules` | "the build passes" | Three MediaPipe packages were absent from `package.json` |
| A green Vercel build | "the site is deployed" | A rollback had pinned the domain to a build from weeks earlier |

Two structural guards exist because of this and should not be removed:
`ignoredSource.test.ts` asserts nothing under `src/` is git-ignored (an unanchored
`models/` rule once hid two admin pages from the repository entirely, so they were
never deployed while passing every local check), and the pre-push secret scan runs
against the **outgoing commit range**, which by definition cannot be narrower than
what is published.

### The second failure — a check that was correct, in the wrong frame

The family above is *the check was narrower than the claim*. This one is different
and harder to catch, because nothing about the check looks wrong: the measurement
is rigorous, the reasoning follows, and the frame around it goes unexamined.

Five instances, all from a single investigation in August 2026 — chasing 16
navigation timeouts in a 278-video extraction run. The underlying fault was one
misread line (`waitUntil: "networkidle0"`, where the page fetches hundreds of
frames and the network never goes idle inside the 60s budget). Four separate
reasoning failures accumulated around finding it.

| The check | Why it was sound | Why it misled |
|---|---|---|
| Failures per 50-video window, across the whole run | A real correlation: 0 failures in videos 1–50, 8 in 201–250 | **Position was a proxy for video length.** Long videos cluster later alphabetically (JANUARY, MARCH, MAY, SEPTEMBER). The ramp was real and meant nothing about accumulation |
| "The run took 85 minutes" | Measured, reproducible | **The number was good because of a failure.** 16 videos aborted at 60s before doing any work. Fixing them made the run slower and more correct |
| Reading a log that showed steady progress | The log was accurate up to the last line it wrote | **A dead process and a slow one look identical** in a log that only prints on completion. 46 minutes of "progress" from a run that had crashed with EADDRINUSE |
| A patch script printing "patched" | It ran without error | **It reported success for having run, not for having changed anything.** A no-op replacement matched nothing, twice. Only caught because the result happened to be syntactically broken |
| `{ timeout: 90_000 }` on every wait in a spec | Explicit, deliberate, and documented in the file's header as "waits on conditions, not timers" | **A framework default silently overrode it.** Playwright caps each test at 30s; the inner timeouts were dead letters. The spec passed or failed by fixture size, for a reason nothing in the test body expressed |

What these share: **the analysis could only see the hypothesis already formed.**
Testing "does the failure rate climb with N" and getting yes never asks what else
changes with N. The window breakdown was more rigorous than the conclusion it
supported — which is precisely why it was persuasive.

Practical guards, all cheap:

  - Before concluding from a correlation, name the other variables that move with
    the axis you measured. Position, time and index are proxies far more often
    than they are causes.
  - Treat any patch or codegen tool as reporting nothing unless it **asserts a
    match count**. "Ran successfully" is not "changed something".
  - Give long-running jobs a **timestamped heartbeat**. Liveness must be readable
    from the artefact, not reconstructed by investigation.
  - When an explicit value seems ignored, look for an **enclosing default** before
    doubting the value. Frameworks cap, wrap and override.
  - A performance figure that improves after a fix is expected; one that *worsens*
    is worth understanding before it is optimised away.

Corollary worth internalising: **`.vercelignore` takes precedence over `.gitignore`.**
Anything reading from `process.cwd()` at request time may not exist in production.
That is why `/api/videos` USED TO return blank — it read `datasets/raw/user_videos`, which
is excluded from the upload.

**Corrected 2026-08-18:** `/api/videos` is no longer filesystem-backed. It resolves
from `source_video_path` and 307s to a signed Storage URL, so it works in
production. The stale claim outlived the fix here, in SYSTEM_DOCUMENTATION.md, and
in the route's own header comment — and two readers took the comment as current,
one of them building a redundant route on the strength of it. A fixed route with
an unfixed comment is worse than an unfixed route.

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
- `public/models/` contains exactly one *classifier* (`bilstm_tfjs`, 313 KB) plus the
  self-hosted MediaPipe hand landmarker. There is no static/LLC model to route to.

The `.claude/skills/fsl-pipeline` skill repeats this claim and is wrong for the same
reason. Accuracy figures quoted as "hybrid" (91.5% alphabet / 92.3% phrase) do not
describe the shipping system; **93.99% test accuracy on bilstm_v4 does.**

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
  `/admin/translation`". No such route exists, and neither do
  `/admin/translation-debug` or `/admin/translation-evaluation` any more — both were
  removed in the cleanup. Edit `gestureDictionary.ts` in source.

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
  gloss as both `from` and `to`. Stage 8 IS reached -- PipelineOrchestrator.ts:26,39 imports and wires
  `defaultCoarticulationBridge`. Whether it changes anything once reached is a
  separate question nobody has answered; "unreachable" and "reached but inert"
  need different fixes, and the note here previously asserted the first.

  Its number list at CoarticulationBridge.ts:166 still includes `ZERO`, which is
  not a model class. Left in place deliberately: it is live code, and removing it
  on the strength of an unverified reachability claim is the mistake section 12
  exists to prevent.
- [`motionDetection.ts:4`](src/features/recognition/motionDetection.ts#L4) —
  `IDLE_THRESHOLD` declared, never used.

### Counts in `AGENTS.md` are behind

"8 test files with 163 passing tests" — actual: 69 test files (unit + e2e).
"133+ model classes" — actual: 131. Phase 46 also records that `npm run build` fails
under Node 24; that's the version pin in §2, not a code bug. Test *counts* moved a
lot during the cleanup as suites were removed and repointed, so treat any absolute
number in an older phase entry as historical — run the suite instead.

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
| Add an animation for a gloss | `/admin/animation-studio` → publish to Supabase (local only) |
| Inspect a published animation | `/admin/animation-inspector` (local only) |
| Measure model accuracy | `/evaluation` — public route, drives the real pipeline |
| Retrain | §9 — and read the warnings first |

The seven surviving admin pages are `login`, the dashboard root, `animation-studio`,
`animation-dataset`, `animation-library`, `animation-inspector`, and `system`.
`translation-debug`, `model-health`, `recognition-analysis`, `models`, `training`,
`analytics`, `audits` and the rest were removed — 23 of 30.
