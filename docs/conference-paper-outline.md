# Conference Paper Outline

**Title**: Adaptive Early Recognition and AI-Assisted Conversation for Filipino Sign Language

**Target Conference**: CHI 2027 / ASSETS 2027 / ICPR 2026

---

## Abstract (250 words)

Filipino Sign Language (FSL) recognition systems have been limited to alphabet-only recognition with no conversation support. We present SignLangVisual, a production-grade FSL system that recognizes 133 classes (28 alphabet + 105 phrases) in real-time using a lightweight BiLSTM model running in-browser via TensorFlow.js. Our system introduces three novel components: (1) adaptive early sampling that reduces time-to-first-prediction by 44%, (2) dynamic gesture segmentation using velocity and stability tracking, and (3) AI-assisted reply generation with conversation memory. In a user acceptance test with 13 participants, the system achieved 94% accuracy and 4.6/5.0 satisfaction. Our mobile performance study across 4 devices demonstrates practical real-time performance (18–24 FPS). We discuss implications for accessible communication technology in the Philippines and beyond.

---

## 1. Introduction (1 page)

- Communication barriers for DHH community in Philippines
- RA 11106 (2018) recognizes FSL as national sign language
- Gap: no production FSL system with conversation support
- Our approach: browser-based, no specialized hardware
- Contributions listed in 3 bullet points

## 2. Related Work (1 page)

- ASL recognition: MediaPipe-based systems (e.g., SignAll, Google's PoseNet)
- FSL prior work: alphabet-only, low accuracy, no deployment
- AI conversation systems for accessibility
- Position our contributions against prior work table

## 3. System Design (2 pages)

### 3.1 Recognition Pipeline
- MediaPipe → 126 features → BiLSTM → 133 classes
- Adaptive early sampling (8 frames min, 30 max)
- Prediction smoothing with hysteresis
- Phrase/alphabet priority resolution

### 3.2 Conversation Intelligence
- Gesture → text → AI reply pipeline
- 6-message context window
- Tiered reply generation (AI → DB → rule-based)

### 3.3 Architecture Diagram
- Figure: System architecture with data flow arrows

## 4. Implementation (1 page)

- Next.js 14 + TypeScript + Supabase + Vercel
- TF.js WebGL inference
- Admin portal with 11 tools
- Telemetry and monitoring

## 5. Evaluation (2 pages)

### 5.1 Recognition Accuracy
- 133-class model results
- Ablation study on smoothing and priority management

### 5.2 Latency Analysis
- Per-component timing breakdown
- Adaptive sampling improvement

### 5.3 User Study
- 13 participants, 10-scenario test
- Results: 94% accuracy, 4.6/5.0 satisfaction

### 5.4 Mobile Performance
- 4 devices benchmarked
- FPS, inference time, memory usage

## 6. Discussion (1 page)

- Results interpretation
- Limitations: mobile iOS, dataset size, lighting sensitivity
- Comparison with prior FSL systems

## 7. Conclusion and Future Work (0.5 page)

- Summary of contributions
- Future: dataset collection, model compression, VRS integration

## References (20–30 citations)

---

## Format

- 6–8 pages (CHI extended abstracts) or 8–10 pages (ASSETS)
- Double-column, ACM sigconf template
- Keywords: Filipino Sign Language, real-time recognition, conversation AI, accessibility, TensorFlow.js
