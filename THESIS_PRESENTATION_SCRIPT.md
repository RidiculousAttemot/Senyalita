# Thesis Presentation Script

**Title:** Real-Time Sign Language Recognition and Translation System Using Deep
Learning for Text and Speech Output

**System name:** SignLangVisual

> **Accuracy note.** This script was rewritten on 2026-08-10 against the code, the
> served model, and the git history. Everything stated as a number is verifiable in
> the repository. Items marked **[VERIFY]** depend on data collection or decisions
> outside the codebase and must be filled in before the defense — do not present
> them as written.
>
> The previous version of this file dated from commit `6274294`, "Complete frontend
> camera and **mock** recognition pipeline." It described a CNN-LSTM, a WebSocket
> API, and a two-way reply-clip workflow. None of those exist. If you have quoted
> that version anywhere, correct it.

---

## Opening

Good day panelists, professors, and fellow students.

We are the proponents of the study entitled *"Real-Time Sign Language Recognition
and Translation System Using Deep Learning for Text and Speech Output."*

Our study is a web-based Filipino Sign Language system with two directions:
recognizing signs from a webcam and converting them to text, and converting typed
text back into animated sign playback. Recognition runs entirely in the browser —
no video ever leaves the user's device.

---

## Introduction

Communication is essential in daily life, yet Deaf and hard-of-hearing individuals
face barriers when interacting with people who do not know sign language. We
developed SignLangVisual to reduce that barrier: a system that reads hand landmarks
from a webcam, classifies them with a deep learning model, and produces readable
text — and in the other direction, renders typed text as sign animation.

---

## Objectives of the Study

- Develop a real-time Filipino Sign Language recognition system that runs
  client-side in a web browser.
- Recognize the FSL manual alphabet and numbers, with a word-prediction layer so
  users do not have to fingerspell every letter to completion.
- Render typed text back into sign animation, using recorded landmark data where a
  sign is available and fingerspelling where it is not.
- Evaluate the system using ISO/IEC 25010 software quality characteristics.

---

## Significance of the Study

- **Deaf and hard-of-hearing individuals** — a two-way communication aid.
- **Learners of FSL** — a reference for the alphabet and numbers with playable
  animation.
- **Researchers and developers** — a fully client-side recognition pipeline and a
  reproducible, dependency-free training implementation.

---

## System Scope — What It Does

The system has **two user-facing workflows.** Being precise about this is
deliberate; the scope was narrowed during development and the codebase reflects it.

### 1. Sign-to-Text

```
Webcam frame
  → MediaPipe Hand Landmarker (21 landmarks × x,y,z per tracked hand;
      one hand in Alphabet mode, two in Phrase Signs mode)
  → normalization (wrist-centred, max-abs scaled) → 126-float frame vector
  → rolling 120-frame buffer
  → motion-based span segmentation
  → temporal resampling to the trained scale → 35 frames × 126 features
  → BiLSTM classifier → softmax over 131 classes
  → prediction smoothing (majority vote + hysteresis)
  → committed letter → word suggestion engine
```

The user signs letters. Each recognized letter is appended, and a suggestion engine
continuously predicts the intended word — `H`, `HE`, `HEL` → *HELLO, HELP, HELMET*.
The user accepts a suggestion, keeps signing, or clears.

**Recognition modes.** Two, explicitly selected — there is no automatic switching:

| Mode | Classes | Status |
|---|---|---|
| Alphabet & Numbers | 26 letters + 10 numbers | Production |
| Phrases | 95 phrase signs | **Beta** — accuracy varies |

### 2. Text-to-Sign

```
Typed text → dictionary lookup
  → published animation exists?  → play the recorded landmark animation
  → no animation?                → fingerspell letter-by-letter
```

"HELLO" plays the HELLO animation. "PROGRAMMING" is fingerspelled P-R-O-G-R-A-M-M-I-N-G
using the alphabet animations. Unknown words never hard-fail.

### Supporting pages

`/learn` — an FSL reference for the alphabet, numbers, and tutorial links.
`/evaluation` — the accuracy harness used to produce the figures in this study.

---

## Methodology

### Development model

Agile iterative development across roughly 48 recorded phases, documented in
`AGENTS.md`. Iteration suited this project because the recognition model was
retrained and re-evaluated repeatedly as the dataset grew.

### Dataset

| | |
|---|---|
| Samples | 14,217 |
| Classes | 131 |
| Signers | 7 (including one Kaggle-sourced signer) |
| Representation | MediaPipe landmark sequences, not raw video |
| Splits | Stratified train / validation / test, NDJSON |

Landmarks rather than pixels means the model is invariant to background, clothing,
and lighting to a degree a pixel model would not be, and the stored dataset is
small enough to version.

### Model architecture

**Bidirectional LSTM.** 48 hidden units per direction (96 concatenated), dropout
0.25, dense-softmax head over 131 classes. Deployed weights: **313 KB**.

Bidirectionality matters for sign language: many signs are disambiguated only by
where the hand *ends up*, so reading the sequence backwards as well as forwards
carries real information. This is also why inference runs on a completed buffer
window rather than truly frame-by-frame.

**Training hyperparameters:** Adam (β₁ 0.9, β₂ 0.999, ε 1e-8), learning rate 0.002
with cosine decay, 80 epochs with early-stopping patience 15, gradient clipping ±1,
label smoothing 0.1, class weighting, curriculum learning, fixed seed 2026.

The training implementation is **hand-written JavaScript** — LSTM cells,
backpropagation through time, Adam, and gradient clipping implemented directly over
`Float32Array`s. No Python ML framework. Consequences: training is CPU-bound and
slow, but the run is fully reproducible and the project has zero Python dependency
at train time.

### Research instrument

A Likert-scale questionnaire aligned with ISO/IEC 25010, covering functional
suitability, usability, reliability, and performance efficiency.

**[VERIFY]** Number of expert validators, pilot participants, and final respondents.

### Statistical tools

Frequency, percentage, and weighted mean.

---

## Results

### Model performance

| Metric | Value |
|---|---|
| Test accuracy (bilstm_v4) | **93.99%** |
| Macro F1 (bilstm_v4) | **94.10%** |

**[VERIFY]** Per-mode accuracy from `/evaluation` on the current deployed model —
report alphabet, numbers, and phrases separately. A single blended figure hides that
the three go through different code paths.

### The principal technical contribution — temporal scale alignment

This is the finding to lead with, because it is genuinely ours and it is measurable.

The two categories of training clip fill the model's 120-frame input differently:

- **Alphabet clips** are static images replicated across all 120 slots, so a letter
  is invariant to how long it is held.
- **Gesture clips** are real video, time-normalized so the movement spans the whole
  window.

The live capture path filled the buffer at a true 30fps and zero-padded the tail —
which reproduces the *alphabet* layout, not the gesture one. A 42-frame THANK YOU
occupied slots 0–41 and left 78 empty, so the model saw the movement at roughly
**three times its trained speed.**

Measured against the served model:

| | Before | After |
|---|---|---|
| THANK YOU | **9.0%** (predicted DARK) | **88.3%** |

The fix marks a gesture span from motion-detector transitions and resamples it
across the trained window, mirroring the interpolation training applied. Two
boundary details carried real accuracy: motion must be measured on *raw* landmarks,
because the normalized feature space is wrist-centred and a hand travelling across
the body registers no movement in it; and trailing idle frames are trimmed only
while the remainder stays above the 5th-percentile training duration, because a
held letter and a finished gesture are both movement-then-stillness, and trimming a
letter's hold destroys the letter.

If the panel asks what is novel here, this is the answer: **a train/serve temporal
distribution mismatch, identified by measurement and corrected at inference without
retraining.**

### Word suggestion

Fingerspelling every character is slow, so the letter stream feeds a suggestion
engine using **dynamic-programming word segmentation** — a minimum-cost cover over
the unspaced character stream — with ranking across exact, phrase, prefix and fuzzy
matches, weighted by usage frequency.

---

## Technical Requirements

### Hardware
- Laptop or desktop, 8 GB RAM minimum, dual-core processor
- HD webcam
- Speakers or headphones for speech output
- Internet connection for animation assets (recognition itself works offline once
  the page has loaded)

### Software stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2.5, App Router, TypeScript |
| Hand tracking | `@mediapipe/tasks-vision` — Hand Landmarker (WASM), self-hosted |
| Inference | TensorFlow.js, Layers API — **in the browser** |
| Training | Hand-written JavaScript, no ML framework |
| Database / auth | Supabase (PostgreSQL + RLS), 41 migrations |
| Rendering | HTML5 Canvas 2D |
| Hosting | Vercel |
| Testing | Vitest + Playwright, 69 test files |

**There is no WebSocket API and no remote inference server.** All communication is
REST over 10 API routes, and the recognition model runs client-side.

---

## System Architecture

```
                     ┌──────────────────────────────┐
   Webcam ─────────► │  Browser                     │
                     │   MediaPipe → BiLSTM (TF.js) │──► Text + Speech
                     │   all inference local        │
                     └──────────────┬───────────────┘
                                    │ REST (assets only)
                     ┌──────────────▼───────────────┐
   Typed text ─────► │  Next.js API → Supabase      │──► Landmark animation
                     │  Storage (signed URL)        │
                     └──────────────────────────────┘
```

**Defining property: recognition is 100% client-side.** No video leaves the device.
The server exists for animation assets and persistence, not for the ML hot path.
This is a privacy property worth stating explicitly to a panel.

### Authoring workflow

New signs are added by uploading signer video through an admin tool that extracts
landmarks and publishes them to Supabase. **The admin is local-only** — it returns
404 on the deployed site, at both the page and API layers. Because the database is
shared, publishing from a local machine appears on the live site immediately with no
redeploy. This was a deliberate decision to remove the largest attack surface from
the public deployment.

---

## Limitations — state these before the panel finds them

1. **Vocabulary size.** 131 classes: 26 letters, 10 numbers, 95 phrase signs.
2. **Phrase recognition is beta.** It works — 88.3% on THANK YOU against recorded
   landmarks — but it is not as reliable live as the alphabet path, and the
   interface labels it as such rather than overstating it.
3. **No ZERO class.** Numbers are ONE through TEN. Text-to-Sign can *render* a zero
   animation, but Sign-to-Text cannot recognize one.
4. **Publishing ceiling.** Landmark JSON is sent in the request body, and the
   hosting platform caps requests at 4.5 MB — roughly four seconds of video. Longer
   signs cannot currently be published from the deployed app. The dominant cost is
   face-mesh landmarks, which measured at about 90% of payload.
5. **Lighting and framing sensitivity.** Landmark extraction degrades in poor light
   or when hands leave frame. Three user-selectable sensitivity presets mitigate
   but do not remove this.
6. **Single-camera, single-signer.** No multi-person or multi-angle handling.
7. **Not a general FSL translator.** Text-to-Sign is dictionary lookup with
   fingerspelling fallback, not machine translation of grammar.

---

## Conclusion

The study delivered a working, deployed Filipino Sign Language system with two
directions: browser-local recognition of the FSL alphabet and numbers with word
prediction, and text-to-sign playback from recorded landmark animation with
fingerspelling fallback. The recognition model reaches 93.99% test accuracy (bilstm_v4) across
131 classes, and a temporal alignment correction raised gesture-sign recognition
from 9.0% to 88.3% without retraining.

Thank you, and we are ready for your questions.

---

## Anticipated Panel Questions

**1. Why does the system only recognize letters and numbers by default, when Deaf
signers use signs rather than fingerspelling?**

This is the question most likely to be asked, and it deserves a direct answer.

The model recognizes 131 classes including 95 phrase signs, and we report their
accuracy. We made the alphabet-and-numbers path the default because it is the more
reliable one live, and because pairing it with word prediction gives unlimited
vocabulary coverage — any word can be spelled, and the suggestion engine reduces the
keystrokes needed. Phrase recognition is available as a selectable mode and marked
beta. We chose reliability plus unlimited coverage over a fixed 95-sign vocabulary
that is less dependable in real conditions. **[VERIFY: have the per-mode accuracy
figures ready to support this.]**

**2. Why a BiLSTM rather than a CNN or a Transformer?**

The input is already a compact landmark sequence, not pixels, so a CNN's spatial
feature extraction is redundant — MediaPipe has done it. The task is sequence
classification over 35 timesteps, which is small; a BiLSTM fits it with 313 KB of
weights, which is what makes browser-local inference practical. Bidirectionality
matters because many signs are disambiguated by their end position.

**3. Why run inference in the browser instead of on a server?**

Privacy and latency. Video never leaves the device, and there is no network
round-trip in the recognition loop. It also means the system has no per-user
inference cost, which matters for an accessibility tool.

**4. How did you validate that the model is actually working, rather than the
pipeline appearing to work?**

We hit exactly that failure. The system reported confident predictions while
misclassifying every gesture sign, because the live capture filled the model's input
window differently from training. It was found by measuring against recorded dataset
landmarks rather than by observation, and it is now guarded by a test that asserts
the runtime sampling indices equal the training configuration and the served model's
declared input shape. That test is the answer to this question: alignment cannot
silently drift again.

**5. What is your dataset's limitation?**

14,217 samples across 7 signers is small for deep learning, and signer diversity is
the binding constraint rather than sample count. The system supports retraining and
dataset expansion, and the capture-to-publish pipeline is part of the deliverable.

**6. Why MediaPipe rather than training your own detector?**

MediaPipe provides reliable real-time landmark extraction without needing to train a
hand detector, letting us spend the dataset on classification rather than detection.
We cite it as third-party; our contribution is the classifier and the temporal
alignment, not the landmark extractor.

**7. Is the system production-ready?**

It is deployed and functional. It is a research prototype in scope — 131 classes,
one signer at a time — but it is not a mock-up: it runs on a public URL, the model
is real, and the accuracy figures come from a held-out test set.

**8. How do you handle incorrect predictions?**

Three layers: confidence thresholds, temporal smoothing with hysteresis across a
five-frame window, and the word-suggestion layer, which lets a user recover from a
mis-recognized letter by selecting the intended word rather than re-signing.

**9. Why is the admin not on the deployed site?**

Because it does not need to be. The database is shared, so publishing from a local
machine reaches the live site immediately. Removing it from the public surface
eliminates the largest attack surface without any loss of function. **[If asked
whether this was for security after an incident, answer honestly — a credential was
exposed during development and rotated. Owning that is stronger than deflecting.]**

**10. How was the system evaluated?**

Two ways. Model performance on a held-out stratified test set — 93.99% accuracy,
94.10% macro F1, on the deployed bilstm_v4 — and user evaluation against ISO/IEC 25010 using a validated Likert
instrument analysed by weighted mean. **[VERIFY: respondent count and results.]**

---

## Known Weaknesses and Honest Defenses

| Weakness | Defense |
|---|---|
| Small dataset, 7 signers | Landmark representation reduces the data requirement relative to pixel models; the retraining pipeline is part of the deliverable and is fully reproducible from a fixed seed. |
| Phrase recognition less reliable than the alphabet | We measured it, labelled it beta in the interface rather than overstating it, and made the reliable path the default. |
| Fingerspelling is slower than signing | Mitigated by the word-prediction layer; the tradeoff is unlimited vocabulary against a fixed sign set. |
| Lighting sensitivity | Landmark normalization removes translation and scale dependence; extraction confidence presets let users adapt. Some sensitivity remains. |
| Publishing size ceiling (~4s of video) | Identified and quantified; the dominant cost is face-mesh data at ~90% of payload, and reducing it is documented as the next step. |
| Not a grammar-level translator | Deliberate scope. Text-to-Sign is dictionary lookup with fingerspelling fallback; we do not claim FSL grammar transformation. |

---

## Closing Statement

Our study delivers a deployed, browser-local Filipino Sign Language recognition and
translation system. Its central technical result is that a train/serve temporal
distribution mismatch — invisible to accuracy on recorded data — was identified by
measurement and corrected at inference, raising gesture recognition from 9.0% to
88.3% without retraining the model. The system meets its objectives within a defined
scope, and its limitations are measured and documented rather than estimated.
