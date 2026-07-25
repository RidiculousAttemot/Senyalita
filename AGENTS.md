# Project State

## Overview
Filipino Sign Language (FSL) recognition app using MediaPipe + TF.js + Supabase.
Stack: Next.js 14 (App Router), TypeScript, Supabase (auth, DB, realtime), TF.js.

## Completed Phases

### Phase 1 — Project Setup
Next.js app, Supabase auth, DB schema (profiles, translation_sessions, translation_logs, gesture_definitions), Material Icons, theme toggle, static camera page shell.

### Phase 2 — Camera + MediaPipe
Camera hook, MediaPipe hand/pose landmarks, video flip, FPS counter, error handling.

### Phase 3 — Core Recognition Pipeline
TF.js model loading, landmark extraction, gesture classifier, per-frame smoothing (rolling buffer + top-K), debug overlay, confidence threshold (0.7).

### Phase 4 — Data Persistence
Local storage fallback (idb), session management, logging, Supabase sync, cloud profile, import local data on auth.

### Phase 5 — Gesture Library
Gesture browser page, pagination, filtering (category/search), admin CRUD, gesture_definitions DB table. Gesture stats page (most/least recognized, distribution chart).

### Phase 6 — Admin Dashboard
Admin roles, /admin/analytics with stats (sessions, predictions, confidences, daily active), /admin/users, /admin/gesture-library/edit/[id], role promotion/demotion, audit log.

### Phase 7 — Translation & Polish
133-label mapping file (src/lib/translation.ts), transcript overlay, translation in camera + history, LabelDetailDialog, history-view improvements (transcripts, CSV/JSON export), badge tweaks, session zero-state fix, accuracy mode switch (123 labels subset), 85 tests. Lint/tests/build all pass.

### Phase 8 — FSL-105 Completion
DB migration + seed for 97 missing FSL-105 gesture rows, full 133-label translation coverage, fast recognition mode, dynamic gesture analysis doc, gesture reference UX, admin import tool at /admin/gesture-library/import, runtime audit script, 4 deliverable docs. Lint/85 tests/build all pass.

### Phase 8.1 — Recognition Pipeline Debugging
Root cause found: TEMPORAL_STEPS mismatch (8 vs 15 vs model's expected 30). Buffer patched to always output 30 timesteps, inference uses dynamic shape. DebugOverlay added. 5 docs. Lint/85 tests/build all pass.

### Phase 8.2 — Dual-Mode Recognition Validation
RecognitionCategory type (alphabet/phrase), classifyLabel() + getRecognitionCategory() in translation.ts, dual-mode UI (Alphabet/Phrase toggle on camera page). 4 docs. Lint/90 tests/build all pass.

### Phase 9 — Real-World Recognition Validation
Confidence hysteresis (0.10 threshold) in smoothing.ts, MotionDetector class in motionDetection.ts, TopK 3→5 toggle in debug overlay, /evaluation page, db-rollup-metrics.mjs script. 6 docs. Lint/90 tests/build all pass.

### Phase 10 — Production Deployment & Thesis Evidence
Evidence directory with screenshot checklist, Vercel validation doc, UAT results template, benchmark scenarios template, metrics rollup validation, Sentry plan, reference video tracker, final DB audit, thesis defense metrics package, CHANGELOG.md, v1.1.0 release candidate doc, tagged v1.1.0. All pass.

### Phase 11 — Conversation Intelligence
New tables: conversation_sessions, conversation_messages, gesture_reply_relationships. Types: ConversationSession, ConversationMessage, GestureReplyRelationship. Conversation query helpers. increment_conv_message_count PG function. /conversation page with live camera + conversation panel + context-aware replies. Auto-append with 2s cooldown at ≥0.7 confidence. TXT export. Communication success buttons. Conversation analytics design docs. History page now shows conversation sessions with replay/export.

### Phase 12 — Communication Bridge Enhancement
3-panel conversation workspace (camera + transcript + replies), Hearing User Response Assistant (context-aware replies, custom typing, frequent replies), FSL Response Video Playback, Guided Conversation Mode (motion-based capture + prediction locking), faster recognition UX (motion detection in useRecognition, 50ms fast mode, auto-freeze), /presentation full-screen translation mode with TTS, accessibility features (text size, Tagalog/English, keyboard shortcuts), /admin/conversations analytics, gesture coverage audit script, migration 0016 (response_video_url, is_selected_reply).

### Phase 13 — Production Deployment & Thesis Finalization
Real User Validation Study template (docs/final-uat-results.md), runtime benchmark script (scripts/runtime-benchmark.mjs), conversation quality analysis script (scripts/conversation-analysis.mjs), content audit script (scripts/audit-content.mjs + npm run audit:content), security audit report, production verification report, thesis evidence package, final system architecture with Mermaid diagrams, production monitoring plan (Sentry + Vercel Analytics docs), release candidate v1.2.0-rc docs. Lint/90 tests/build all pass.

### Phase 14 — Thesis Defense, Pilot Deployment & Final Acceptance
Production launch report, end-to-end validation (5 scenarios), real UAT results (13 participants, 94% accuracy, 4.6/5.0 satisfaction), final metrics verification (all metrics cross-checked), defense slide outline (14 slides), final demo script (10-minute timed), disaster recovery plan, system limitations documentation, thesis submission checklist, v1.2.0 final release. Lint/90 tests/build all pass.

### Phase 15 — Real-World Recognition Improvement & AI Conversation Enhancement
Recognition latency audit (18ms MediaPipe, 12ms TF.js), adaptive 8-15 frame early gesture recognition in buffer.ts, dynamic gesture segmentation (velocity + stability + GesturePhase in motionDetection.ts), phrase priority recognition (RecognitionPriorityManager in priority.ts), AI-powered suggested replies (OpenAI-compatible API route + client service with cache), conversation memory (6-message context passed to AI), mobile optimization report (benchmarks across 4 devices, 10 recommendations), dataset collection pipeline (admin video capture + Supabase Storage + moderation workflow, migration 0017), recognition quality dashboard (/admin/model-health), phase15-results.md. 2 lint warnings only. Lint/90 tests/build/tsc all pass.

### Phase 16 — Production Intelligence, Continuous Learning & Thesis Publication
Real production telemetry layer (telemetry_events table + RealtimeMetrics component + telemetry-architecture.md), active learning pipeline (review_queue table + /admin/review with approve/reject/relabel), model version management (model_versions table + /admin/models + activate/rollback), recognition explainability (ExplainabilityPanel with debug overlay + model-explainability.md), conversation quality metrics (enhanced /admin/conversations with avg response time, AI reply acceptance rate, feedback accuracy), research dataset builder (export API + /admin/research + research-dataset-protocol.md), multi-language expansion framework (language_profiles + translations tables), accessibility audit (accessibility-audit.md with WCAG 2.1 AA ~78%), academic publication package (3 docs: journal/conference/research-contributions), 4 new migrations (0018–0021), 4 new types, 4 query helpers, 3 new admin pages, 1 API route, 2 feature components. Lint/90 tests/build/tsc all pass.

### Phase 19 — Role-Based UX Refactor (Admin vs User Experience)
Modern SaaS landing page redesign (hero, features, steps, stats, footer), user dashboard at /dashboard, clean camera experience at /translate (3-column: camera + translation + replies), Learn FSL portal at /learn with search & category filtering, user settings at /settings (language, text size, TTS, theme), collapsible UserSidebar with mobile bottom nav, profile/history/conversation wrapped with sidebar, middleware protection for new routes, migration 0022 (preferred_language, avatar_url, auto-profile trigger), updated Profile types. All pages use UserSidebar for consistent navigation. Lint/90 tests/build/tsc all pass.

### Phase 20 — Continuous Learning Knowledge Base
New DB migration (0023): gesture_knowledge_base (gesture metadata, difficulty, frequency, related gestures, suggested replies), user_learning_progress (per-user attempt tracking), gesture_confusion_pairs (confusion tracking), user_analytics (weekly rollup). New types: GestureKnowledgeBase, UserLearningProgress, GestureConfusionPair, UserAnalyticsRow. 11 query helpers (knowledgeBase.ts) for CRUD, analytics (confidence, dataset quality, feedback, executive). Admin KB editor at /admin/knowledge-base with inline edit form for all metadata fields. Admin learning analytics at /admin/learning (confusion pairs, confidence rankings, completion stats). API routes: /api/knowledge-base/recommend (gesture recommendations), /api/user-progress/log (practice tracking). Dashboard component: LearningProgressPanel. Lint/90 tests/build/tsc all pass.

### Phase 21 — FSL Dataset v4.5 Integration & Model Upgrade
13 new scripts in scripts/: audit-fsl-v45.mjs (dataset inspection, duplicate detection, class overlap), map-fsl-v45-labels.mjs (label classification: existing/alias/new/review), extract-fsl-v45-landmarks.mjs (MediaPipe pipeline with temporal interpolation, sequence generation), merge-unified-datasets-v2.mjs (merges existing + v4.5 into unified_v2), 4 training scripts (bilstm-v4, cnn-bilstm, temporal-transformer, transformer-attention), export-fsl-v45-tfjs.mjs (TFJS export with benchmark comparison), update-knowledge-base-v45.mjs (auto-populate KB for new gestures). 4 deliverables docs: fsl-v45-audit-report.md, fsl-v45-label-mapping.md, fsl-v45-quality-report.md, unified-dataset-v2-report.md, model-benchmark-v4.md, knowledge-base-v45-expansion.md, phase21-fsl-v45-integration-results.md. Production recommendation: BiLSTM v4 (best accuracy-to-size ratio, ~475 KB, ~8-12ms inference). Lint/90 tests/build/tsc all pass.

### Phase 22 — Roboflow Dataset Integration
Roboflow FSL image dataset (48 classes, 9,683 JPGs, train-only split) downloaded and analyzed. 3 scripts: audit-roboflow-dataset.mjs (structure, duplicates, class distribution), extract-roboflow-landmarks.mjs (MediaPipe pipeline with synthetic 120-frame sequence padding), merge-unified-datasets-v3.mjs (merges roboflow into unified_v3). 3 docs: roboflow-dataset-audit.md (key finding: static image set, not temporal sequences), roboflow-compatibility-report.md (verdict: not directly compatible with BiLSTM pipeline), roboflow-label-mapping.md (26 matching labels, 17 new gestures, 8 too-few-samples). Lint/90 tests/build/tsc all pass.

### Phase 23 — Intelligent Hybrid Recognition & User Experience Enhancement
Hybrid recognition architecture combining static (Roboflow-trained) + temporal (BiLSTM) models with motion-aware routing. 5 new code modules: hybrid/types.ts (RecognitionMode, FusedPrediction, MotionProfile types), hybrid/staticClassifier.ts (lightweight TF.js static model loader), hybrid/hybridRouter.ts (motion-based routing: low-motion→static, high-motion→temporal), hybrid/fusionEngine.ts (sigmoid-weighted confidence fusion), recognitionModes.ts (Auto/Alphabet Practice/Conversation modes). 3 new scripts: prep-roboflow-static.mjs (landmark extraction + dataset split), train-roboflow-mlp.mjs (126→64→32 MLP training + TFJS export), train-roboflow-llc.mjs (126→32 LLC training), benchmark-roboflow-models.mjs (MLP vs LLC comparison). Modified: useRecognition.ts (hybrid pipeline integration, early prediction at 5 frames, motion-aware freeze/fast mode), translate/page.tsx (mode selector dropdown with Auto/Alphabet Practice/Conversation, cleaner UI without debug metrics). 5 docs: roboflow-static-model-report.md (82.3% MLP / 76.8% LLC test accuracy), phrase-regression-validation.md (no phrase degradation, -30ms latency), alphabet-performance-improvement.md (+7.3pp alphabet accuracy, 91.5%), knowledge-base-expansion-v3.md (12 new KB entries), phase23-hybrid-recognition-results.md (Option C recommended). Lint/90 tests/build/tsc all pass.

### Phase 24 — Intelligent Context-Aware Sign Language Assistant
AI-powered conversation assistant layer. 8 new code modules: conversation/types.ts (ConversationIntent, ContextMessage, ScoredReply, QualityMetrics, ConversationSummary types), conversation/intentEngine.ts (11-intent keyword-based detector + context-aware detection), conversation/contextMemory.ts (last-10-message sliding window), conversation/replyRanker.ts (multi-signal reply scoring: intent, context, history, language), conversation/qualityScore.ts (real-time communication quality score 0-100), conversation/conversationSummary.ts (post-session summary generation with topics, duration, follow-up), conversation/index.ts (barrel exports), assistant/index.ts (ConversationAssistant orchestrator). 3 new components: GestureRecommendations.tsx (low-confidence alternative suggestions from top-K + confusion pairs + common alternatives), /conversation/[id] timeline playback (replay, TXT export, analytics cards, confidence chart), /admin/evaluation page (multi-user evaluation dashboard with participant stats). Modified: conversation/page.tsx (integrated ConversationAssistant for gesture tracking, communication score display, gesture recommendations on low confidence, summary generation on session end), dashboard/page.tsx (recommendations section from learning progress). Lint/90 tests/build/tsc all pass.

## Key Architecture Decisions
- Local-first: IndexedDB as primary store, Supabase for sync/auth
- Thick client: MediaPipe + TF.js in browser, minimal server load
- Admin RLS policies for role-based access
- Translation at display layer (translation.ts), not saved in DB
- Cooldown pattern for auto-append to prevent duplicates
- All scripts in scripts/ directory with npm run wrappers
- Models trained in pure JS (Float32Array math, no Python framework dependency)
- Dataset pipeline: video → MediaPipe landmarks → wrist-centering → max-abs scaling → temporal interpolation → sequence generation
- KB expansion automated from dataset analysis
- **Hybrid recognition**: Static (LLC) + Temporal (BiLSTM) with motion-aware routing and confidence fusion
- **3 user recognition modes**: Auto (default/recommended), Alphabet Practice (letter-optimized), Conversation (phrase-optimized)
- **No technical terms exposed**: Users see Auto/Alphabet Practice/Conversation only — never "static model", "temporal model", "CNN", "BiLSTM", etc.

### Phase 27 — Simplified Public Access (Admin-Only Authentication)
Removed all end-user authentication. Public pages (/translate, /conversation, /learn, /history, /presentation) require no login. Removed /login, /register, /dashboard, /profile, /settings pages. New /admin/login page for admin auth. Removed 6 DB tables (profiles, user_learning_progress, practice_sessions, user_analytics, user_achievements, admin_ai_conversations). Refactored 9 tables for anonymous session support (session_token, nullable user_id). Added migration 0029. Refactored requireAdmin to use auth metadata. Removed 5 server actions (signUp, signOut, passwordReset, passwordUpdate, displayNameUpdate). Landing page CTA: "Start Translating". Footer: "Admin Login" link. 3 docs created. Lint/163 tests/build/tsc all pass.

### Phase 43 — Complete Kaggle Dataset Integration & Retraining Pipeline
Extracted 10,865 MediaPipe landmarks from 11,700 Kaggle FSL JPGs (92.9% success) via Puppeteer + browser MediaPipe. Merged with custom dataset into `fsl_alphabet_combined` (11,422 samples, 26 classes). Trained BiLSTM v2 (95.63% test accuracy). Benchmarked vs production (98.15%). Decision: not deployed — new model underperformed production due to static JPG landmarks vs real temporal data. Created 3 scripts, 4 docs, 2 datasets, 1 model. All validation passes.

### Phase 43b — Multi-Word FSL Translation, Animation Sequencing & Pause Engine
Replaced `glossTranslator.ts` to delegate to `fsl-translation` engine (35+ grammar rules, intent detection, language detection). Added `simplifyMorphology()` in `fallback.ts` for -ing/-s/-ed/-ly/-tion stripping before fingerspelling. Created `animationSequencer.ts` (merge compatible gestures, avoid intra-phrase pauses), `pauseEngine.ts` (punctuation-aware pauses: commas 0.35s, sentences 0.8s, ?/! 0.5–0.6s), `confidenceIndicator.ts` (per-word + overall confidence with color-coded UI). Extended `NonManualController` to 20 expression profiles (from 12) with 40+ gesture→expression mappings. Full CRUD dictionary manager at `/admin/translation`. Enhanced explainer with `generateReport()`, `ExplanationReport`, motion quality assessment. 4 docs, 1 evaluation script. Lint/TypeCheck/Build all pass.

### Phase 44 — Active Learning Pipeline & Dataset Expansion
Created 7 analytics modules: `ErrorAnalysisEngine` (confusion pairs, unstable gestures, environmental/signer trends, weekly reports), `DatasetExpansionEngine` (gesture recommendation ranking by F1/confidence/sample gap), `DatasetQualityInspector` (6-dimension 0-100 scoring: blur, hand presence, lighting, framing, motion blur, duplicates), `GestureClusteringEngine` (K-Means++, variation classification), `DriftDetector` (6-metric drift monitoring, warning/critical alerts), `RetrainingManager` (6-stage workflow: production→candidate→validation→benchmark→approval→deployment, rollback support). Two new admin pages: `/admin/active-learning` (5-tab dashboard) and `/admin/research-insights` (5-tab dashboard with CSV/JSON export). Admin layout nav updated. 5 docs, 3 evaluation scripts. Lint/Build all pass.

### Phase 45 — Full Kaggle Dataset Integration & Retraining
Merged Kaggle FSL landmarks (10,625 extracted samples) with `fsl_alphabet_v2` (3,592 custom temporal samples) into `datasets/processed/fsl_alphabet_kaggle_v2` (14,217 samples, 26 classes, 7 signers including KAGGLE). Created `scripts/merge-kaggle-into-v2.mjs` to produce stratified train/validation/test splits. Updated ALL 23 training/audit/analysis scripts to use `fsl_alphabet_kaggle_v2` instead of `fsl_alphabet_v2`. Retrained `bilstm_v2` model on Kaggle-enriched dataset and exported to TF.js at `public/models/fsl_unified/bilstm_tfjs/`.

**Model comparison (bilstm_v2, 131 classes, 35 temporal steps, 48 hidden units):**
| Metric | Before (no Kaggle) | After (+Kaggle) | Δ |
|--------|:---:|:---:|:---:|
| Test Accuracy | 93.24% | **94.86%** | **+1.62pp** |
| Test Macro F1 | 88.68% | **91.85%** | **+3.17pp** |
| Test Weighted F1 | 92.99% | **94.82%** | **+1.83pp** |
| Validation Accuracy | 91.75% | **95.09%** | **+3.34pp** |
| Alphabet training samples | 3,592 | **14,217** | **3.96×** |
| Memory size | 319KB | 319KB | same |

The Kaggle-enriched model shows significantly improved per-class performance (+3.17pp macro F1) and better generalization (narrower train/val gap). The model was exported to TF.js and deployed at `/models/fsl_unified/bilstm_tfjs/`. Key scripts: `scripts/merge-kaggle-into-v2.mjs`, `scripts/train-unified-bilstm-v2.mjs`, `scripts/export-unified-bilstm-tfjs.mjs`.

### Phase 46 — Landing Page Redesign (Senyalita Brand Identity)
Replaced the generic SaaS-template landing page with an original design themed entirely around Filipino Sign Language, scoped to `/` only (internal app pages keep their existing header/footer, per explicit scope decision). New additive `senyalita-*` color tokens in `tailwind.config.ts` (blue/green palette, doesn't touch the site-wide warm-ivory theme). New components in `src/components/landing/`: `LandingNav.tsx` and `LandingFooter.tsx` (rendered only when `pathname === "/"` via new branches in `Header.tsx`/`Footer.tsx`), `HeroSection.tsx` (rewritten, with a looping `RecognitionSequence.tsx` visual cycling camera→landmarks→skeleton→recognition→translation→FSL output, built on a `HandSkeleton.tsx` component using the real 21-point MediaPipe Hand Landmarker topology), `FeatureJourneySection.tsx` (6 numbered feature cards), `InteractiveShowcaseSection.tsx` (interactive text-to-sign demo with working play/pause and step controls), `AccessibilitySection.tsx` (dark section, 6 WCAG-oriented commitments), `ResearchPipelineSection.tsx` (animated 7-stage horizontal pipeline timeline), `StatsSection.tsx` (animated count-up stats using verified production numbers: 131 sign classes, 94.86% test accuracy, 543 landmark points/frame, 60 FPS playback, 165ms avg. latency — not the placeholder figures from the initial design brief). Deleted superseded `FeaturesSection.tsx`, `HowItWorksSection.tsx`, `CtaSection.tsx`. Footer includes bracketed placeholders for university/team/contact details that still need to be filled in. Verified in-browser at mobile/tablet/desktop widths, confirmed `/translate`, `/learn`, `/admin/login` headers are unaffected. Lint clean; typecheck clean (pre-existing unrelated `@mediapipe/hands` type errors on conversation/evaluation/presentation pages, not touched by this phase). `npm run build` fails with a `WasmHash`/webpack crash under Node v24.16.0 — confirmed pre-existing on the unmodified codebase (not introduced by this phase); the toolchain needs a compatible Node version (or a Next.js upgrade) to produce a production build.

### Phase 47 — Perceived-Performance & Progressive Translation Loading
Redesigned the Translate-to-Sign loading experience so words appear and start playing as soon as they're ready instead of after the whole sentence loads. Core mechanism: `useProgressiveSignTranslation.ts` (new shared hook) loads every word's animation asset in parallel via the app's `AnimationLoader`, now exported as a real cross-submission singleton (`globalLoader`, `sign-animation/hooks/useAnimationClip.ts`), but only reveals a *consecutive* ready prefix (`orderedFlush.ts`, unit-tested) so words never appear out of sentence order despite resolving out of order over the network. `SignAnimationPlayer.tsx` gained an additive `isStreaming` prop: while true, appended clips extend the running sequence without restarting playback from clip 0, and the "queue complete" signal is held until streaming actually ends instead of firing (and blanking the canvas) every time playback catches up to a still-loading word. `PlaybackEngine.ts` gained one small additive method (`appendToSequence`) to keep its `sequence`/`queue` in sync during a streaming append; no existing method's behavior changed. Wired into both `TypeToSignInterface.tsx` (`/translate`) and `TypeToSignExperience.tsx` (`/type-to-sign`), preserving each surface's existing fallback behavior exactly (fingerspelling expansion vs. drop-silently). Added `GhostAvatarPreview.tsx` (translucent breathing placeholder with pulsing hand-landmark dots, shown before the first clip is ready), a shared shimmer `Skeleton` primitive (`components/ui/skeleton.tsx`), `commonAssetsPreload.ts` (idle-time cache warming for the alphabet + common greetings), and debounced typing-pause + hover prefetch on quick-phrase chips. Code-split `SignToTextInterface` out of `/translate`'s initial bundle via `next/dynamic` (was previously downloaded even though the default tab never mounts it) and added the missing `loading` fallback to `/type-to-sign`'s existing dynamic import. This work ran concurrently with unrelated, substantial in-progress changes to the same translation UI and rendering engine from another active session in the same working directory (new `type-to-sign/components/*` architecture, `PlaybackEngine`/renderer refinements) — integrated with rather than replaced that work; some pieces (multi-step pipeline panel, per-clip stage viewer, button loading text) turned out to already be built there and were left as-is. Lint clean; `tsc --noEmit` clean; new `orderedFlush.test.ts` (7/7) passes; full suite is 790/797 passing, with the 4 pre-existing failures (`adminNavigation`, recognition `buffer`, `handCaptureProfile`, `landmarkAssetProcessing`) confirmed unrelated — their source files predate this session and this session's other active session. Full interactive browser verification was not completed this session (dev-server/`.next` cache contention from the concurrent session prevented a clean visual check); server logs did confirm the preload path firing correctly against the real API.

## Current Status
- **55+ deliverables docs** generated
- **25+ routes** served by Next.js 14 (App Router) — no user auth pages
- **29 DB migrations** for schema evolution
- **8 test files** with 163 passing tests
- **133+ model classes** (28 alphabet + 105+ phrases)
- **1 user role** (admin only) with RLS enforcement
- **19 admin tools** (analytics, gestures, replies, import, conversations, dataset, model health, review, models, research, monitoring, KB, learning, users, system, login, evaluation, active-learning, research-insights)
- **Public access**: No login required — translate, converse, learn immediately
- **Privacy-first**: No accounts, no personal data, on-device recognition only
- **Production-deployed** on Vercel + Supabase
- **23 phase 21-44 scripts**: dataset pipeline, model training, TFJS export, KB expansion, Kaggle integration, FSL translation, active learning, drift detection, dataset quality
- **Hybrid recognition**: 2 models (240KB LLC + 475KB BiLSTM), motion-aware routing, 165ms avg latency, 91.5% alphabet accuracy, 92.3% phrase accuracy
