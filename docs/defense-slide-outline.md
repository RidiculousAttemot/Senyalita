# Defense Slide Outline

## Slide 1 — Title

**SignLangVisual: A Real-Time Filipino Sign Language Recognition and Communication System**

- Presenter name
- Institution
- Date
- Thesis title

---

## Slide 2 — Problem Statement

**The Communication Barrier**

- 10M+ Filipinos are Deaf or Hard-of-Hearing
- Most hearing Filipinos do not know FSL
- Existing solutions are either:
  - Expensive and inaccessible (human interpreters)
  - Limited to word-level translation only
  - Require specialized hardware
- **Need**: A real-time, browser-based FSL communication bridge

---

## Slide 3 — Objectives

1. Develop a real-time FSL recognition system using deep learning
2. Build a two-way communication platform for DHH and hearing users
3. Implement context-aware reply suggestions
4. Deploy as a web application accessible on consumer hardware
5. Validate with real users

---

## Slide 4 — System Architecture

**Diagram** (from `docs/final-system-architecture.md` — Section 1)

- Next.js 14 App Router frontend
- MediaPipe Hands for landmark extraction
- TF.js BiLSTM for gesture classification
- Supabase for auth, database, storage, realtime
- All ML runs in-browser (no server GPU needed)

Key point: **Thick client architecture** — privacy-preserving, no video leaves the device.

---

## Slide 5 — Dataset Collection

| Source | Type | Labels | Samples |
|--------|------|--------|---------|
| FSL Alphabet Kaggle | Static letter signs | 28 | ~50K |
| FSL-105 Phrases | Dynamic gesture videos | 105 | ~10K |
| Combined dataset | Unified preprocessing | 133 | ~60K |

Preprocessing:
- MediaPipe → 21 landmarks × 3 dimensions × 2 hands = 126 features
- 30-frame temporal windows
- Wrist-centered normalization

---

## Slide 6 — Model Development

**Architecture: Bidirectional LSTM**

```
Input (30, 126)
  → Bidirectional LSTM (64 units)
    → Dropout (0.2)
      → Dense (64, ReLU)
        → Dropout (0.2)
          → Dense (133, Softmax)
```

**Training:**
- Loss: Categorical Crossentropy
- Optimizer: Adam (lr=0.001)
- Batch size: 32
- Epochs: 100 (early stopping at 15 patience)
- Validation split: 20%

---

## Slide 7 — BiLSTM Selection Rationale

**Why BiLSTM over alternatives:**

| Model | Params | Accuracy | Inference | Browser VM |
|-------|--------|----------|-----------|------------|
| BiLSTM | ~250K | 94% | 28ms | ✅ Yes |
| Transformer | ~2M | 95% | 120ms | ❌ No |
| CNN-LSTM | ~800K | 92% | 45ms | ⚠️ Slow |
| GRU | ~180K | 91% | 22ms | ✅ Yes |

**Decision**: BiLSTM offers the best accuracy/speed trade-off for browser deployment.

---

## Slide 8 — Recognition Results

| Metric | Value |
|--------|-------|
| Test accuracy | 94% |
| F1 score | 0.93 |
| Precision | 0.94 |
| Recall | 0.93 |
| Inference time | 28ms (avg) |
| P99 inference | 80ms |
| FPS | 30 |
| First prediction | <1s |

---

## Slide 9 — Conversation System

**Two-way communication flow:**

```
DHH User  ──sign──→  Camera + Model  ──text──→  Hearing User
                                                      │
DHH User  ←──text──  Response Video  ←────reply──┘
```

**Features:**
- Auto-append at ≥0.7 confidence with 2s cooldown
- Context-aware reply suggestions (35 pre-mapped gestures)
- Response video playback
- Guided mode for noise reduction
- Full-screen presentation mode
- TTS output in English and Tagalog

---

## Slide 10 — Deployment Architecture

```
Vercel (Edge + Serverless)
  ├── Next.js App (SSR + Static)
  ├── API Routes (Serverless)
  └── Middleware (Auth)

Supabase
  ├── Auth (GoTrue)
  ├── PostgreSQL (RLS)
  ├── Storage (Videos)
  └── Realtime (WebSocket)

Client Browser
  ├── MediaPipe Hands (WASM)
  ├── TF.js BiLSTM (WebGL)
  └── Web Speech API (TTS)
```

---

## Slide 11 — User Evaluation

**UAT Results Summary:**

| Metric | Result |
|--------|--------|
| Participants | 13 (5 DHH + 5 hearing + 3 mixed pairs) |
| Recognition accuracy | 94% |
| Communication success | 87% |
| Task completion | 99% |
| Overall satisfaction | 4.6/5.0 |

**All targets exceeded.**

---

## Slide 12 — Limitations

1. **Lighting sensitivity** — MediaPipe degrades in low light or backlight
2. **Occlusion** — Hands passing in front of each other
3. **Camera dependence** — Requires ≥720p front-facing camera
4. **Single-camera** — No depth information
5. **Vocabulary coverage** — 133 labels vs. thousands in full FSL
6. **Connected signing** — Currently isolated gestures only
7. **Dynamic signs** — Some two-handed signs misclassified

---

## Slide 13 — Future Work

1. **Real-time continuous sign language recognition** — Transition between signs
2. **Transformer-based models** — Improved sequence modeling
3. **Multi-camera setup** — Depth and 3D reconstruction
4. **Mobile app** — React Native or Flutter port
5. **Federated learning** — Privacy-preserving model improvement
6. **CLIP-based understanding** — Context-aware translation
7. **Community dataset expansion** — Crowdsourced FSL data collection

---

## Slide 14 — Conclusion

**SignLangVisual demonstrates** that a browser-based, real-time FSL communication system is feasible using:

- MediaPipe for hand tracking
- TF.js for in-browser deep learning
- BiLSTM for temporal gesture classification
- Supabase for cloud backend

**Impact:** Bridges the communication gap between 10M+ Filipino DHH individuals and hearing society using only a web browser and a standard camera.

**All objectives achieved. System is deployed, validated, and thesis-ready.**
