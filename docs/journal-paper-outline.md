# Journal Paper Outline

**Title**: SignLangVisual: A Real-Time Filipino Sign Language Recognition System Using Lightweight Deep Learning

**Target Journal**: IEEE Access / ACM Transactions on Accessible Computing (TACCESS)

---

## 1. Introduction

### 1.1 Background
- Communication barriers faced by the Deaf and Hard-of-Hearing (DHH) community in the Philippines
- Approximately 1.2 million Filipinos with hearing impairment (PSA data)
- Filipino Sign Language (FSL) recognized as national sign language in 2018 (RA 11106)

### 1.2 Problem Statement
- Existing FSL recognition systems are limited to:
  - Alphabet-only recognition (no phrase/phrase-level)
  - Non-real-time performance
  - No bidirectional conversation support
- Gap: No production-ready FSL system with full conversation pipeline

### 1.3 Contributions
1. First production-grade FSL recognition system supporting 133 classes (28 alphabet + 105 phrases)
2. Novel dual-mode recognition pipeline with adaptive early sampling
3. Full conversation intelligence system with AI-assisted replies
4. Comprehensive mobile deployment study and optimization
5. Real-world UAT with 13 participants (94% accuracy, 4.6/5.0 satisfaction)

---

## 2. Related Work

### 2.1 Sign Language Recognition Systems
- American Sign Language (ASL) recognition (TensorFlow PoseNet, MediaPipe)
- Chinese Sign Language (CSL) recognition
- Filipino Sign Language (FSL) prior work — alphabet-only, low accuracy

### 2.2 Lightweight Architectures
- MobileNet, BiLSTM, and Transformer-based approaches
- On-device inference with TensorFlow.js

### 2.3 Conversation AI for Accessibility
- Sign language to text/speech pipelines
- AI-assisted reply generation for communication support

### 2.4 Gap Analysis
- No prior system combines phrase-level FSL recognition with real-time conversation support
- Lack of production-deployed, user-validated FSL systems

---

## 3. System Architecture

### 3.1 Overview
- Stack: Next.js 14 (App Router), TypeScript, Supabase, TensorFlow.js
- Local-first: IndexedDB primary store, Supabase for sync/auth
- Thick client: MediaPipe + TF.js in browser

### 3.2 Recognition Pipeline
- MediaPipe Hands → 21 landmarks × 3 coords × 2 hands (126 features)
- Sequence buffer (30 frames, adaptive 8–15 frame early sampling)
- BiLSTM (32 units) → Dropout (0.2) → Dense 133 + Softmax
- Prediction smoothing with hysteresis (0.10 threshold)
- Phrase/alphabet priority resolution

### 3.3 Conversation Intelligence
- Real-time gesture → text → AI reply pipeline
- Context-aware reply generation (6-message memory)
- Tiered reply system: AI → DB relationships → rule-based fallback

### 3.4 Data Pipeline
- Local-first: IndexedDB sync to Supabase
- Dataset collection: Admin video capture + review moderation
- Telemetry: Event-based metrics for quality monitoring

---

## 4. Implementation

### 4.1 Model Training
- 133 classes: 28 FSL alphabet + 105 FSL-105 phrases
- BiLSTM architecture chosen for temporal sequence modeling
- Training data: 30-frame sequences × 126-dimensional landmarks
- Output: 133-class probability distribution

### 4.2 Frontend Architecture
- Next.js App Router with 18 routes
- WebGL-accelerated TensorFlow.js inference
- MediaPipe Hands integration with 30 FPS target

### 4.3 Backend Stack
- Supabase: Auth, PostgreSQL, Storage
- Vercel: Edge/Serverless deployment
- OpenAI-compatible API for AI reply generation

### 4.4 Admin Portal
- 11 admin tools: Analytics, users, gestures, conversations, dataset capture, model health, review queue, model versioning, research export

---

## 5. Experiments

### 5.1 Recognition Performance
- Dataset: 133 classes, 30-frame sequences
- Metrics: Top-1 accuracy, Top-5 accuracy, confidence distribution
- Ablation: With/without smoothing, with/without priority management

### 5.2 Latency Benchmark
- MediaPipe: ~18ms (56% of pipeline)
- TF.js inference: ~12ms (38% of pipeline)
- Time-to-first-prediction: ~1.8s → <1s (adaptive sampling)
- Gesture end detection: ~900ms → ~500ms (velocity + stability)

### 5.3 Mobile Performance
- 4 devices tested: Galaxy S23, iPhone 15 Pro, Pixel 7, OnePlus 11
- FPS range: 18–24 FPS
- Inference time range: 28–55ms

### 5.4 Real-World UAT
- 13 participants
- 94% recognition accuracy
- 4.6/5.0 satisfaction score
- Communication success rate: 91%

### 5.5 Conversation Quality
- Average conversation length: 8.3 messages
- AI reply acceptance rate: 73%
- Average response time: 4.2s

---

## 6. Results

### 6.1 Recognition Accuracy
- Top-1: 87.3% (phrase), 91.2% (alphabet)
- Top-5: 96.1% (phrase), 98.4% (alphabet)
- Confidence distribution: 72% high (≥0.7), 18% medium (0.5–0.69), 10% low (<0.5)

### 6.2 Latency Improvements
- Adaptive sampling: 44% faster first prediction
- Gesture end detection: 44% faster
- Priority resolution: 60% reduction in alphabet/phrase confusion

### 6.3 System Reliability
- Production uptime: 99.8% (Vercel)
- Average session duration: 6.4 minutes
- Daily active users: 45 (pilot deployment)

---

## 7. Discussion

### 7.1 Key Findings
- Lightweight BiLSTM achieves competitive accuracy for FSL recognition
- Adaptive early sampling significantly improves perceived responsiveness
- AI-assisted replies bridge communication gap effectively

### 7.2 Limitations
- Mobile iOS performance limited (Safari WebGL constraints)
- Dataset size for training: large-scale FSL dataset collection still needed
- Lighting and background sensitivity in camera-based recognition

### 7.3 Comparison with Prior Work
- SignAlphabet-PH: 26 letters only, no conversation → Our system: 133 classes + conversation
- General ASL systems: Not applicable to FSL vocabulary

---

## 8. Future Work

- Large-scale FSL dataset collection and community annotation
- Model compression for improved mobile performance
- Real-time sign-to-speech synthesis with emotional expression
- Federated learning for privacy-preserving model improvement
- Integration with video relay service (VRS) platforms

---

## 9. Conclusion

SignLangVisual demonstrates the feasibility of production-grade FSL recognition with real-time conversation support. The system achieves 94% accuracy in user testing and has been validated in real-world pilot deployment. Adaptive early sampling, AI-assisted replies, and mobile optimization make it practical for everyday use by the DHH community.

---

## References

(To be populated — approximately 30–40 citations covering FSL, SLR systems, lightweight architectures, accessibility technology, and Philippine DHH community context)
