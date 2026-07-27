# System Flow and User Roles

> Status: reflects the shipping system as of Phase 48. For the architecture and
> algorithm, see [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md). For implementation detail,
> see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).

## User roles

Two roles. End-user accounts were removed in Phase 27.

| Role | Login | Can do |
|---|---|---|
| **Public visitor** | None required | Translate, converse, learn, view local history, play back sign animations |
| **Admin** | Supabase Auth | Everything above, plus dataset management, animation authoring, model monitoring, review queues |

There is no registration, no user profile, and no personal data collection. Visitors
are identified only by an anonymous `session_token`.

## Access flow

1. Visitor opens the app at `/`.
2. Landing page offers **Start Translating** — no login prompt, no gate.
3. Visitor uses any public route immediately.
4. Admins reach `/admin/login` via the footer link and authenticate with Supabase.
5. Admin role is read from Supabase auth metadata (`app_metadata.role = "admin"`) and
   enforced by Row-Level Security on every admin-accessible table.

---

## Main flow A — Sign to Text

Route: `/translate` (default tab), also `/conversation` and `/presentation`.

1. User opens the camera surface.
2. Browser requests webcam permission (`getUserMedia`, 640×480, front camera).
3. The app loads two things in parallel:
   - MediaPipe Hand Landmarker (WASM)
   - the BiLSTM model from `public/models/fsl_unified/bilstm_tfjs/` (312 KB)
4. Each video frame is processed by MediaPipe → up to 2 hands × 21 landmarks.
5. Landmarks are wrist-centered and max-abs scaled into a 126-feature vector and
   appended to a rolling 120-frame buffer.
6. On a timer (100 ms, or 30 ms in fast mode), 35 frames are sampled from the buffer
   at fixed trained indices and passed to the BiLSTM.
7. The model returns a probability over 131 classes; the top label and top-5 are kept.
8. The raw prediction is stabilized: majority vote over the last 5 inferences, plus a
   0.10 hysteresis margin so near-equal classes don't oscillate.
9. A motion state machine decides whether the user is mid-sign or resting. When motion
   is idle and confidence holds ≥ 0.6 for 10 consecutive inferences, the prediction
   **freezes** and is committed to the transcript.
10. The recognized label is mapped to display text and appended to the transcript.
11. User can toggle English/Tagalog output and trigger speech (Web Speech API).

**Nothing in this flow touches the network.** Recognition is entirely client-side.

### Recognition tuning available to the user

- **Sensitivity**: Relaxed / Balanced / Strict — adjusts MediaPipe confidence
  thresholds (0.4 / 0.6 / 0.8).
- **Mode**: Auto / Alphabet Practice / Conversation — biases toward letters or phrases.
  Users never see model internals; the labels are deliberately non-technical.

---

## Main flow B — Text to Sign

Routes: `/translate` (Type-to-Sign tab), `/type-to-sign`.

1. User types English or Tagalog text.
2. The 9-stage translation pipeline runs in the browser:
   language detection → normalization → sentence segmentation → gloss translation →
   FSL grammar reordering → unknown-word handling → animation planning →
   coarticulation → expression tagging.
3. FSL grammar is not English word order — the gloss optimizer drops articles and
   copulas and reorders toward topic-comment structure.
4. For each resulting gloss, the app requests an animation asset from
   `GET /api/animations/<gloss>`.
5. The server resolves it in order: published asset in Supabase → local asset file →
   404.
6. Assets are **recorded landmark data**, not video — captured from real signers via
   MediaPipe Holistic and replayed on canvas.
7. Words load in parallel but are revealed only as a consecutive ready prefix, so
   playback starts on the first word while later words are still downloading, and
   words never appear out of sentence order.
8. If no asset exists for a word, the fallback ladder applies: synonym → strip
   morphology (`-ing`, `-s`, `-ed`, `-ly`, `-tion`) → fingerspell letter by letter →
   visible placeholder. Translation never hard-fails.
9. The animation plays with punctuation-aware pauses (comma 0.35 s, sentence 0.8 s).

---

## Two-way conversation flow

Route: `/conversation` — a three-panel workspace for a signing user and a hearing user
sharing one device.

1. Signing user signs; recognition runs as in Flow A.
2. Recognized signs are appended to a shared transcript with a 2-second cooldown at
   ≥ 0.7 confidence, so one gesture doesn't produce duplicates.
3. The system offers suggested replies for the hearing user, drawn from:
   - the optional language model (`POST /api/ai/replies`) when an API key is set, or
   - a rule-based reply dictionary otherwise.
4. Hearing user picks a suggestion or types a custom reply.
5. The reply is translated through Flow B and played back as FSL animation.
6. The signing user reads the animated reply and continues.
7. On session end the app generates a summary (topics, duration, communication
   quality score) and offers TXT export.

If low-confidence recognition occurs, the system surfaces alternative gesture
suggestions from the top-K and known confusion pairs rather than guessing.

---

## Admin flows

### Animation authoring
1. Admin signs in at `/admin/login`.
2. At `/admin/animation-studio`, uploads a video of a signer performing a gesture.
3. MediaPipe Holistic extracts hands, pose, and face landmarks in the browser.
4. Admin reviews, trims idle lead-in/trail-off, and inspects quality.
5. Publishing writes the asset to Supabase, making it available to all users via
   `/api/animations/<gloss>`.

### Recognition review and active learning
- `/admin/review` — approve, reject, or relabel queued low-confidence predictions.
- `/admin/active-learning` — error analysis, confusion pairs, dataset gap
  recommendations, drift monitoring.
- `/admin/model-health`, `/admin/recognition-analysis` — accuracy and confidence
  monitoring against production telemetry.

### Model management
- `/admin/models` — model version registry, activate and roll back.
- `/admin/model-comparison`, `/admin/experiment-tracking` — benchmark candidates.

Retraining itself runs offline via `scripts/`, not from the dashboard.

### Translation tooling
- `/admin/translation-debug` — per-stage timings and output for any input string.
- `/admin/translation-evaluation` — batch translation quality review.

---

## Data flow and persistence

Local-first. The app works fully offline for recognition.

1. Predictions, transcripts, and sessions are written to **`localStorage`**
   (`fsl_recognition_logs`, `fsl_recognition_sessions`, `fsl_transcripts`).
2. Operations that need to reach the server are placed on a pending queue
   (`fsl_pending_queue`) rather than blocking the UI.
3. A sync process flushes that queue to Supabase when the network allows, recording
   the outcome in `fsl_sync_meta`.
4. `/history` reads from local storage, with export to TXT/CSV/JSON.
5. Telemetry events feed the admin dashboards.

Translated display text is **computed at render time**, not stored. The database holds
gloss labels only, so changing the display mapping never invalidates saved history.

---

## Key screens

| Route | Purpose |
|---|---|
| `/` | Landing page — interactive demo, live translation preview |
| `/translate` | Main surface — Sign-to-Text and Type-to-Sign tabs |
| `/type-to-sign` | Dedicated text → animated FSL |
| `/conversation` | Two-way conversation workspace |
| `/presentation` | Full-screen translation mode for demos |
| `/learn` | FSL reference library with search and category filters |
| `/history` | Saved transcripts and export |
| `/evaluation` | Evaluation/testing surface |
| `/admin/*` | 29 admin tools (auth-gated) |

---

## Backend responsibilities

The backend is serverless — Next.js API Routes on Vercel plus Supabase. There is no
standalone application server and **no inference server**.

It is responsible for:
- Serving animation assets (`/api/animations/<gloss>`)
- Persisting sessions, predictions, transcripts, and telemetry
- Admin authentication and role enforcement
- Animation asset upload, moderation, and publishing
- Optional AI reply generation (proxying an OpenAI-compatible API)
- Dataset and model-registry queries for the admin dashboards

It is **not** responsible for recognition. No video frame, landmark stream, or model
inference ever reaches the server.

---

## Security

- Supabase Auth for admin authentication; role in `app_metadata`, not client state
- Row-Level Security on all admin-accessible tables
- Server-side validation on API routes; service-role key is server-only
- Environment-based secrets; nothing sensitive in `NEXT_PUBLIC_*`
- Anonymous session tokens — no accounts, no personal data
- Camera access requires HTTPS or `localhost`, and video never leaves the device
