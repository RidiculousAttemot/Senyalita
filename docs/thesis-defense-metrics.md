# Thesis Defense Metrics Package

## 1. Dataset

| Metric | Value |
|--------|-------|
| Total samples | ~XX,XXX |
| Alphabet samples | ~XX,XXX |
| FSL-105 samples | ~XX,XXX |
| Train split | 80% |
| Validation split | 10% |
| Test split | 10% |
| Landmark features | 126 per frame (21 × 3 × 2 hands) |
| Temporal window | 30 frames |

> *Fill in actual dataset stats from training scripts.*

## 2. Models Evaluated

| Model | Accuracy | Precision | Recall | F1 | Size | Inference Time |
|-------|----------|-----------|--------|----|------|---------------|
| MLP | | | | | | |
| LSTM | | | | | | |
| BiLSTM (baseline) | | | | | | |
| CNN-LSTM | | | | | | |
| BiLSTM v2 | | | | | | |
| **Unified BiLSTM** | | | | | **~XX KB (TFJS)** | **~10ms** |

> **Deployed model**: Unified BiLSTM (bidirectional LSTM, 32 units, dropout 0.2, 133-class softmax)
> **Format**: TFJS layers model
> **Training framework**: TensorFlow / Keras (Python) → exported to TFJS

## 3. Runtime Performance

| Metric | Measured Value | Target | Status |
|--------|---------------|--------|--------|
| MediaPipe FPS | ~30 | ≥20 | ✅ |
| Inference FPS | ~10 (100ms interval) | ≥5 | ✅ |
| Time to first prediction | ~267ms | ≤1000ms | ✅ |
| Stable prediction | ~500ms | ≤1000ms | ✅ |
| Model input size | 30 × 126 = 3780 floats | — | ✅ |
| Model output size | 133 floats (softmax) | — | ✅ |
| Memory (TFJS) | ~500KB weights | — | ✅ |
| Max number of hands | 2 | — | ✅ |

## 4. Model Coverage

| Category | Labels | Translation | DB | Replies | Videos |
|----------|--------|-------------|----|---------|--------|
| Alphabet (a–z, ñ, ng) | 28 | 28 | 28 | 56 | 0 |
| Greeting | 10 | 10 | 10 | 30 | 0 |
| Survival | 10 | 10 | 10 | 30 | 0 |
| Number | 10 | 10 | 10 | 20 | 0 |
| Calendar | 12 | 12 | 12 | 24 | 0 |
| Days | 10 | 10 | 10 | 30 | 0 |
| Family | 10 | 10 | 10 | 30 | 0 |
| Relationships | 10 | 10 | 10 | 20 | 0 |
| Color | 13 | 13 | 13 | 39 | 0 |
| Food | 10 | 10 | 10 | 30 | 0 |
| Drink | 10 | 10 | 10 | 30 | 0 |
| **Total** | **133** | **133** | **133** | **339** | **0** |

## 5. Deployment

| Metric | Value |
|--------|-------|
| Platform | Vercel (Next.js) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage (gesture-videos) |
| Model runtime | TF.js (in-browser) |
| MediaPipe | @mediapipe/hands (CDN) |
| Production URL | `https://signlangvisual.vercel.app` |

## 6. User Statistics (from UAT)

| Metric | Value |
|--------|-------|
| Total participants | `N` |
| Alphabet accuracy | `XX%` |
| Phrase accuracy | `XX%` |
| Average SUS score | `XX/100` |
| Average satisfaction | `X.X / 5` |
| Task completion rate | `XX%` |

## 7. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App (Vercel)                  │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Camera   │  │  Admin   │  │  Eval    │              │
│  │  Page     │  │  Pages   │  │  Page    │              │
│  └────┬─────┘  └──────────┘  └──────────┘              │
│       │                                                 │
│  ┌────▼─────────────────────────────────────────────┐   │
│  │           Recognition Pipeline                    │   │
│  │  ┌────────┐ ┌──────┐ ┌───────┐ ┌───────┐       │   │
│  │  │MediaPipe│→│Buffer│→│Model │→│Smooth │→ UI   │   │
│  │  │ Hands  │ │ 30fr │ │BiLSTM│ │5-vote │       │   │
│  │  └────────┘ └──────┘ └───────┘ └───────┘       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────┘
                          │
              ┌───────────▼────────────┐
              │      Supabase          │
              │  ┌─────────────────┐  │
              │  │  PostgreSQL DB  │  │
              │  │  Auth           │  │
              │  │  Storage        │  │
              │  │  (videos)       │  │
              │  └─────────────────┘  │
              └───────────────────────┘
```

## 8. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| In-browser TF.js (no server) | Zero server cost, privacy (video never leaves device), offline-capable |
| 30-frame temporal window | Matches model training, enables interpolation at low frame counts |
| 5-vote smoothing + hysteresis | Eliminates prediction flicker from single-frame noise |
| Category detection (alphabet vs phrase) | Different UI per type: letter for alphabet, reference video + replies for phrase |
| Confidence hysteresis (0.10) | Prevents rapid switching between near-equal predictions |
| Motion detection | Gesture start/end detection via landmark displacement |
| Supabase RLS | Row-level security ensures users only see their own data |
