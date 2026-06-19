# Phase 26 — Architecture Optimization, Dataset Verification & Performance Hardening Results

## Audit Documents Created

| Document | Contents |
|----------|----------|
| `docs/dataset-lineage-report.md` | Full audit of all 12+ datasets with usage status |
| `docs/model-lineage-report.md` | All 15 model variants with deployment status |
| `docs/production-model-verification.md` | Runtime model trace (loader.ts → useRecognition.ts → hybridRouter.ts) |
| `docs/dead-code-report.md` | 27 unused scripts, 11 orphaned model dirs, 3 legacy public model exports |
| `docs/bundle-optimization-report.md` | Bundle analysis and optimization recommendations |
| `docs/recognition-performance-report.md` | Pipeline latency, FPS, bottleneck analysis |
| `docs/database-optimization-report.md` | Table audit, missing indexes, RPC audit |
| `docs/navigation-optimization-report.md` | Route audit, duplicate route analysis |
| `docs/testing-coverage-audit.md` | Test coverage by module, missing test identification |

---

## Optimizations Executed

### Files Removed

| What | Where | Size | Reason |
|------|-------|------|--------|
| Legacy alphabet TFJS exports | `public/models/fsl_alphabet/tfjs/`, `public/models/fsl_alphabet/bilstm_v2_tfjs/` | ~259 KB | Never loaded at runtime |
| Legacy FSL-105 export | `public/models/fsl_105/` | ~195 KB | Never loaded at runtime |
| Baseline DNN training artifacts | `models/fsl_alphabet/baseline/` | ~8.5 MB | Orphaned, replaced by BiLSTM |
| LSTM training artifacts | `models/fsl_alphabet/lstm/` | ~400 KB | Orphaned |
| BiLSTM v1 training artifacts | `models/fsl_alphabet/bilstm/` | ~850 KB | Superseded by unified |
| BiLSTM v3 training artifacts | `models/fsl_alphabet/bilstm_v3/` | ~850 KB | Superseded by unified |
| CNN-LSTM training artifacts | `models/fsl_alphabet/cnn_lstm/` | ~500 KB | Never deployed |
| Cross-signer eval artifacts | `models/fsl_alphabet/cross_signer_eval/` | ~2 KB | Evaluation artifact |
| FSL-105 BiLSTM training artifacts | `models/fsl_105/bilstm/` | ~950 KB | Superseded by unified |
| MediaPipe hand model | `models/mediapipe/hand_landmarker.task` | ~7.46 MB | Reproducible from Google CDN |
| Stale TFJS reference exports (5 directories) | `models/fsl_105/bilstm_tfjs/`, `models/fsl_alphabet/bilstm_tfjs/`, `models/fsl_alphabet/bilstm_v2_tfjs/`, `models/fsl_alphabet/bilstm_v3_tfjs/`, `models/fsl_alphabet/tfjs/` | ~0.8 MB | Reference copies, never served |
| Superseded training source | `models/fsl_alphabet/bilstm_v2/` | ~0.89 MB | Superseded by unified model |
| **Total** | **17 directories** | **~23.4 MB** | |

### Code Optimized

| File | Change | Impact |
|------|--------|--------|
| `src/features/recognition/useRecognition.ts` | Added try/catch around static model inference to prevent silent failures | Prevents repeated 404 errors on every idle frame |

### Pages Optimized

| What | Change | Before | After | Saved |
|------|--------|--------|-------|-------|
| Legacy `/camera` page | Replaced with redirect to `/translate` | 443 KB First Load JS | 87.8 KB | **355 KB** |

### Reference Updates (6 files)

| File | Change |
|------|--------|
| `src/app/page.tsx` (landing) | Link href: `/camera` → `/translate` |
| `src/lib/supabase/middleware.ts` | Removed `/camera` from PROTECTED_PREFIXES |
| `src/lib/supabase/actions.ts` | Default redirect: `/camera` → `/translate` |
| `src/app/(auth)/login/page.tsx` | Default next + redirect: `/camera` → `/translate` |
| `src/app/(auth)/register/page.tsx` | Redirect: `/camera` → `/translate` |

### New Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/0028_phase26_performance_indexes.sql` | 4 performance indexes + duplicate index removal |
| `package.json` script `export:unified:bilstm:tfjs` | npm alias for model export script |

### Critical Finding: Static Recognition Model Never Deployed

The `src/features/recognition/hybrid/staticClassifier.ts` references `/models/roboflow_static/model.json`, but this file **never existed** in `public/models/`. The Roboflow dataset was downloaded (5 GB) but the landmark extraction produced an empty directory. No TFJS export step was ever run. The hybrid recognition feature has been running in temporal-only mode since Phase 23.

**Recommendation:** Either:
1. **Remove static classifier** entirely if hybrid recognition is not needed, or
2. **Complete the pipeline** by re-running Roboflow landmark extraction, training the LLC model, and exporting to `public/models/roboflow_static/`

### Critical Finding: FSL Dataset v4.5 Never Integrated

Despite 10 scripts and 4 deliverables docs written for Phase 21, the FSL v4.5 dataset was **never downloaded, extracted, or merged**. The `datasets/processed/fsl_v45/` directory does not exist. All v4.5 training scripts (`train-fsl-v45-bilstm-v4.mjs`, `train-fsl-v45-transformer.mjs`, etc.) would fail to find input data.

---

## Bundle Improvements

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Static model assets served | 657 KB | 203 KB | **-454 KB (-69%)** |
| First Load JS (shared) | 87.5 KB | 87.5 KB | Same |
| Disk usage (models/) | ~14.5 MB | ~1 MB (unified source) | **-13.5 MB (-93%)** |

---

## Verification

| Check | Status |
|-------|--------|
| `npm run lint` | ✅ Pass (3 pre-existing warnings) |
| `npx tsc --noEmit` | ✅ Zero errors |
| `npm test` | ✅ 163/163 pass |
| `npm run build` | ✅ Zero errors |

---

## Remaining Model Artifacts

### Production (public/models/)
```
public/models/fsl_unified/bilstm_tfjs/  ← DEPLOYED (203 KB)
└── labels.json, model.json, weights.bin
```

### Training Source (models/)
```
models/fsl_unified/bilstm/              ← Training source for deployed model (1.73 MB)
```
