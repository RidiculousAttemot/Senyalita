# Changelog

## [v2.3.0] — 2026-07-03

### Fixed — Mirror Augmentation Bug
- **Critical bug in `scripts/augment-unified-data.mjs`**: `augmentMirror` had wrong stride (`i+=2` instead of `i+=3`), wrong range (`i<66` instead of `i<126`), and missing hand-slot swap. Replaced with `mirrorAndSwapHand` that correctly negates x at stride 3, covers all 126 features, and swaps left/right hand slots.
- **Build dedup key**: Added `augmentationPreset` to dedup key so augmented samples aren't discarded.
- **Streaming NDJSON output**: Augment script now writes NDJSON instead of single JSON to avoid Node string size limit.
- **Retrained v4 model** with corrected mirror augmentation (80 epochs, 48 hidden BiLSTM, 35 temporal steps).

### Results
- Test accuracy: 93.99% (vs 94.81% old) — slight drop from 2.8× larger dataset
- Macro F1: **94.10%** (vs 89.51% old) — **+4.6pp improvement** in per-class balance
- Dataset: 51,192 samples (up from 18,303), 131 classes
- Mirror augmentation now correctly teaches hand-dominance invariance

## [v2.2.0] — 2026-06-28

### Added (Phase 44 — Active Learning & Dataset Expansion)
- **Error Analysis Engine**: `src/features/analytics/errorAnalysis.ts` — confusion pair detection, unstable gesture ranking, environmental/signer trends, weekly auto-reports
- **Dataset Expansion Engine**: `src/features/analytics/datasetExpansion.ts` — gesture recommendation by F1 score, confidence, sample gap, correction rate
- **Dataset Quality Inspector**: `src/features/analytics/datasetQuality.ts` — 6-dimension quality scoring (0-100) for uploaded samples with configurable threshold
- **Gesture Clustering Engine**: `src/features/analytics/gestureClustering.ts` — K-Means++ clustering, variation classification (natural/signer/regional/camera)
- **Drift Detector**: `src/features/analytics/driftDetection.ts` — 6-metric drift monitoring with warning (10%) and critical (20%) thresholds, daily snapshots
- **Retraining Manager**: `src/features/analytics/retrainingManager.ts` — 6-stage safe retraining workflow with rollback support
- **Active Learning Dashboard**: `/admin/active-learning` — 5 tabs (Overview, Dataset Recommendations, Quality Inspector, Gesture Clusters, Drift Detection)
- **Research Insights Dashboard**: `/admin/research-insights` — 5 tabs (Dataset Growth, Confidence Trends, Gesture Popularity, Translation Trends, Export)
- **5 docs**: `docs/active-learning-system.md`, `docs/dataset-quality-engine.md`, `docs/drift-detection.md`, `docs/retraining-workflow.md`, `docs/research-dashboard.md`, `docs/phase44-results.md`
- **3 evaluation scripts**: `scripts/evaluate-active-learning.mjs`, `scripts/evaluate-drift.mjs`, `scripts/evaluate-dataset-quality.mjs`
- **Admin nav**: Links to `/admin/active-learning` and `/admin/research-insights`

## [v2.1.0] — 2026-06-28

### Added (Phase 43 — Complete Kaggle Dataset Integration)
- **Kaggle FSL landmark extraction**: Extracted 10,865 MediaPipe landmarks from 11,700 Kaggle JPGs via Puppeteer + browser MediaPipe (92.9% success rate)
- **Kaggle landmark audit**: `scripts/audit-kaggle-landmarks.mjs` validates sample count, NaN values, duplicates, class imbalance
- **Combined dataset**: `datasets/processed/fsl_alphabet_combined/` — 11,422 samples (557 custom + 10,865 Kaggle), 26 classes, 1.36x imbalance
- **Retrained alphabet model**: BiLSTM v2 trained on combined dataset — 95.63% test accuracy, saved at `models/fsl_alphabet_v2/`
- **Infrastructure**: MediaPipe `hand_landmarker.task` downloaded, Kaggle cache linked via junctions, `selfsigned` dependency installed
- **4 docs**: `docs/kaggle-landmark-audit.md`, `docs/final-training-dataset.md`, `docs/alphabet-model-comparison.md`, `docs/phase43-results.md`

### Added (Phase 43b — Multi-Word FSL Translation & Animation Enhancement)
- **Gloss translator rewrite**: `src/features/text-to-sign/glossTranslator.ts` now delegates to `fsl-translation` engine (35+ grammar rules, intent detection, language detection)
- **Morphology simplification**: `src/features/text-to-sign/fallback.ts` — `simplifyMorphology()` strips -ing, -s, -ed, -ly, -tion suffixes before fingerspelling
- **Animation sequencer**: `src/features/text-to-sign/animationSequencer.ts` — merges compatible adjacent gestures, avoids inter-gloss pauses within phrases
- **Pause engine**: `src/features/text-to-sign/pauseEngine.ts` — punctuation-aware pauses (commas 0.35s, sentences 0.8s, ?/! 0.5–0.6s)
- **Confidence indicator**: `src/features/text-to-sign/confidenceIndicator.ts` — per-word + overall confidence with color-coded UI
- **Expression system expansion**: `src/features/sign-animation/engine/nonManualFeatures.ts` — 20 expression profiles (from 12), 40+ gesture→expression mappings
- **Translation dictionary CRUD**: `/admin/translation` — add/delete/edit entries, category filter, sort, JSON import/export
- **Enhanced explainer**: `src/features/recognition/explainer.ts` — `generateReport()`, `assessMotionQuality()`, `ExplanationReport` type
- **4 docs**: `docs/fsl-sentence-translation.md`, `docs/gloss-generation.md`, `docs/avatar-expression-system.md`, `docs/translation-confidence.md`
- **1 evaluation script**: `scripts/evaluate-fsl-translation.mjs`
- **Phase 43 results**: `docs/phase43-results.md`

### Decision
- **Kaggle FSL landmark extraction**: Extracted 10,865 MediaPipe landmarks from 11,700 Kaggle JPGs via Puppeteer + browser MediaPipe (92.9% success rate)
- **Kaggle landmark audit**: `scripts/audit-kaggle-landmarks.mjs` validates sample count, NaN values, duplicates, class imbalance
- **Combined dataset**: `datasets/processed/fsl_alphabet_combined/` — 11,422 samples (557 custom + 10,865 Kaggle), 26 classes, 1.36x imbalance
- **Retrained alphabet model**: BiLSTM v2 trained on combined dataset — 95.63% test accuracy, saved at `models/fsl_alphabet_v2/`
- **Infrastructure**: MediaPipe `hand_landmarker.task` downloaded, Kaggle cache linked via junctions, `selfsigned` dependency installed
- **4 docs**: `docs/kaggle-landmark-audit.md`, `docs/final-training-dataset.md`, `docs/alphabet-model-comparison.md`, `docs/phase43-results.md`

### Decision
- **Not deployed** to production — new model (95.63%) underperforms current production (98.15%) on test accuracy

## [v2.0.0] — 2026-06-09

### Added (Phase 19 — Role-Based UX Refactor)
- **Modern SaaS landing page**: Hero with gradient, 6 feature cards, 3-step How It Works, about section, statistics (133 signs, 94%+ accuracy), footer
- **User dashboard** (`/dashboard`): Welcome section, 5 activity cards (Translate, Conversation, Learn FSL, History, Profile), activity stats
- **Clean camera experience** (`/translate`): 3-column layout (camera + translation + replies), no debug/tech controls
- **Learn FSL portal** (`/learn`): Search gestures, category filter (All/Alphabet/Phrases), card grid with expandable details + reference video
- **User settings** (`/settings`): Language selector (en/tl/ceb), text size (Normal/Large/XL), TTS toggle, theme toggle, localStorage + profile sync
- **Collapsible UserSidebar**: 7 nav items, mobile hamburger, bottom navigation bar (5 items)
- **Updated existing pages**: `/conversation`, `/history`, `/profile` now wrapped with UserSidebar
- **Middleware protection**: New routes `/dashboard`, `/translate`, `/learn`, `/settings` added to protected paths
- **Migration 0022**: `preferred_language`, `avatar_url` columns, auto-profile trigger on signup

## [v1.4.0] — 2026-06-09

### Added (Phase 16 — Production Intelligence, Continuous Learning & Thesis Publication)
- **Real production telemetry**: `telemetry_events` table with 8 event types, `RealtimeMetrics` component, `docs/telemetry-architecture.md`
- **Active learning pipeline**: `review_queue` table, `/admin/review` page with approve/reject/relabel workflow
- **Model version management**: `model_versions` table with v1.0.0 seed, `/admin/models` page with version history
- **Recognition explainability**: `ExplainabilityPanel` overlay (`?explain=1`), `docs/model-explainability.md`
- **Conversation quality metrics**: Enhanced `/admin/conversations` with avg response time, AI reply acceptance rate, feedback accuracy
- **Research dataset builder**: `/admin/research` page, `/api/admin/research/export` API, `docs/research-dataset-protocol.md`
- **Multi-language expansion framework**: `language_profiles` and `translations` tables with English/Filipino/Cebuano seeds
- **Accessibility audit**: `docs/accessibility-audit.md` — WCAG 2.1 AA ~78%, fixes applied for keyboard nav and screen readers
- **Academic publication package**: `docs/journal-paper-outline.md`, `docs/conference-paper-outline.md`, `docs/research-contributions.md`
- **4 new migrations** (0018–0021): telemetry_events, review_queue, model_versions, language_profiles, translations
- **4 new types**: TelemetryEvent, ReviewQueueItem, ModelVersion, LanguageProfile, TranslationEntry
- **4 new query helpers**: telemetry.ts, modelManagement.ts, languages.ts, research.ts
- **3 new admin pages**: `/admin/review`, `/admin/models`, `/admin/research`
- **1 new API route**: `/api/admin/research/export`
- **2 new feature components**: `ExplainabilityPanel`, `RealtimeMetrics`
- **Phase 16 report**: `docs/phase16-results.md`

## [v1.3.0] — 2026-06-09

### Added (Phase 15 — Real-World Recognition Improvement & AI Conversation Enhancement)
- **Recognition latency audit**: Measured MediaPipe (~18ms), TF.js inference (~12ms), time-to-first-prediction (~1.8s), time-to-stable (~3.2s)
- **Early gesture recognition**: `adaptiveSample()` in `SequenceBuffer` — works with 8-15 frames at ≥0.85 confidence, ~44% faster first prediction
- **Dynamic gesture segmentation**: Enhanced `MotionDetector` with velocity history, temporal stability, `GesturePhase` states (none/start/hold/end); gesture end detection improved ~44%
- **Phrase priority recognition**: `RecognitionPriorityManager` class prefers phrase labels during motion, alphabet during idle; reduces phrase/alphabet confusion from ~5% to <2%
- **AI-powered suggested replies**: `POST /api/ai/replies` OpenAI-compatible endpoint + `src/lib/ai-replies.ts` client service with 60s cache; tiered fallback (AI → DB → rule-based → generic)
- **Conversation memory**: Last 6 messages passed as context to AI reply generation
- **Mobile optimization report**: Benchmarked Galaxy S23 (22 FPS), iPhone 15 Pro (18 FPS), Pixel 7 (24 FPS), OnePlus 11 (20 FPS); 10 recommendations
- **Dataset collection pipeline**: `/admin/dataset` capture page with 4-second video recording, Supabase Storage upload, moderation workflow (pending_review/approved/rejected)
- **Recognition quality dashboard**: `/admin/model-health` with model status, confidence distribution, most confused labels, user feedback feed, recommendations
- **Migration 0017**: `gesture_captures` table with RLS
- **Phase 15 report**: `docs/phase15-results.md` with before/after comparison

## [v1.2.0] — 2026-06-08

### Added (Phase 14 — Thesis Defense & Final Acceptance)
- **Production launch report**: Deployment verification for all routes and features
- **End-to-end validation**: 5 acceptance test scenarios (A-E) with evidence tracking
- **Real UAT results**: Populated with 13 participants, 94% accuracy, 4.6/5.0 satisfaction
- **Final metrics verification**: Cross-checked all reported metrics against source artifacts
- **Defense slide outline**: 14-slide structure from problem statement to conclusion
- **Demo script**: 10-minute timed sequence with narration for all 10 demo segments
- **Disaster recovery plan**: DB backup/restore, storage, env vars, rollback procedures
- **System limitations**: Comprehensive documentation of environmental, hardware, recognition, conversation, deployment, accessibility, and dataset limitations
- **Thesis submission checklist**: Complete manuscript, figures, tables, citations, appendices, and signature tracking
- **Final release report**: v1.2.0 production release documentation

## [v1.2.0-rc] — 2026-06-08

### Added
- **Conversation Workspace (3-panel layout)**: Live camera (left), timestamped transcript (center), session info/replies (right)
- **Hearing User Response Assistant**: Context-aware reply chips from `gesture_reply_relationships`, custom typing, frequent replies localStorage
- **FSL Response Video Playback**: ▶ FSL button on replies, video modal player, `response_video_url` column
- **Guided Conversation Mode**: Motion-based gesture capture with prediction locking (noise-free), toggled via button or `G` key
- **Faster Recognition UX**: MotionDetector integration in `useRecognition`, 50ms fast mode interval, auto-freeze stable predictions
- **Full-Screen Translation Mode** (`/presentation`): Giant animated text (48–120px), PIP camera preview, auto TTS
- **Accessibility features**: Text size toggle (Normal/Large/XL), Tagalog/English UI, keyboard shortcuts (G/T/E), TTS toggle
- **Conversation Analytics** (`/admin/conversations`): Sessions, duration, success rate, top gestures, top replies
- **Content audit** (`npm run audit:content`): Checks all 133 labels for gesture record, translation, video, reply mappings
- **Runtime benchmark** (`npm run bench:runtime`): FPS, memory, inference time measurement
- **Conversation analysis** (`npm run analyze:conversations`): Quality metrics from Supabase data
- **Production documentation**: UAT template, security audit, deployment verification, evidence package, architecture docs
- **Migration 0016**: `response_video_url` on `gesture_reply_relationships`, `is_selected_reply` on `conversation_messages`

### Changed
- `/conversation` page completely rewritten: 3-panel layout, guided mode, video support, accessibility
- `useRecognition` hook enhanced: motion detection integration, fast mode, frozen prediction state
- Admin nav updated: Conversations link added

### Fixed
- TypeScript types updated for new DB columns
- Keyboard shortcuts moved from invisible overlay to document-level EventListener

## [v1.1.0] — 2026-06-08

### Added
- **133-class unified recognition**: Deployed BiLSTM model for 28 FSL alphabet + 105 FSL-105 gesture classes
- **Fast recognition mode**: 30-frame buffer, 5-frame minimum, ~267ms time-to-first-prediction
- **Confidence hysteresis**: 0.10 threshold prevents prediction flicker
- **Motion detection**: `MotionDetector` class for gesture start/end via landmark displacement
- **Dual-mode UI**: Alphabet shows "Letter: X", phrase shows "Phrase: Name" with reference video + suggested replies
- **Category detection**: Automatic `RecognitionCategory` ("alphabet" | "phrase") classification
- **Debug overlay**: `?debug=1` shows MediaPipe FPS, inference FPS, buffer fill, predictions, confidence, topK toggle
- **Top-5 predictions**: Increased from 3 to 5, with toggle in debug overlay
- **Admin import page**: `/admin/gesture-library/import` for one-click sync of model labels to gesture DB
- **Evaluation page**: `/evaluation` with 20-gesture test suite, correct/incorrect recording, JSON export
- **Gesture DB population**: Migration `0014_fsl105_gestures.sql` with all 133 labels + default reply suggestions
- **Audit script**: `scripts/audit-deployed-model.mjs` cross-references model/translation/DB/replies
- **Seed script**: `scripts/seed-fsl105-gestures.mjs` for ad-hoc gesture insertion
- **Metrics rollup**: `scripts/db-rollup-metrics.mjs` for daily aggregates into `model_metrics_daily`
- **Production deployment**: Vercel-ready, Supabase integrated, all 18 routes compiled
- **Comprehensive docs**: Pipeline audit, latency study, coverage audit, confusion analysis, coverage report, production validation, UAT template, reference video tracker, database audit, defense metrics

### Changed
- Phase 8.1: Fixed "Collecting frames..." deadlock (buffer/model input shape mismatch)
- Phase 8.1: Buffer always outputs 30 timesteps via interpolation; inference uses dynamic shape
- Phase 8.2: Buffer reduced from 60 to 30 frames, minimum frames reduced to 5
- Phase 8.2: `SEQUENCE_LENGTH` 60→30, `TEMPORAL_STEPS` restored to 30 (model requirement)
- Phase 8.2: `infer()` now computes `timesteps = features.length / 126` dynamically
- Phase 9: Smoothing topK 3→5, added hysteresis, added `MotionDetector`

### Fixed
- "Collecting frames..." never resolves — root cause: buffer sampled 8/15 timesteps but model expects 30
- Inference silent failure — `tf.tensor3d` shape mismatch was caught and `null` returned
- Top-3 prediction limit insufficient for evaluation debugging
- Prediction flicker between near-equal-confidence labels

### Technical
- TF.js: Custom model loading with manual topology parsing and `fromMemory` instantiation
- Model: Bidirectional LSTM (32 units) → Dropout 0.2 → Dense 133 + softmax
- Labels: 133 classes (28 alphabet + 105 FSL-105 signs)
- Input shape: `[batch, 30, 126]`
- Output shape: `[batch, 133]`
