# Dead Code Detection Report

## Categories
- **SAFE TO DELETE** — No runtime references, no documentation value
- **REVIEW REQUIRED** — May have historical/research value, or may be referenced indirectly
- **ACTIVE** — Currently in use by the application

---

## SCRIPTS

### SAFE TO DELETE (27 scripts never referenced in package.json)

| Script | Reason | Size |
|--------|--------|------|
| `api-verify.mjs` | Manual Supabase API verification, used once | 3.2 KB |
| `audit-deployed-model.mjs` | Superseded by `audit-gesture-coverage` | 7.8 KB |
| `audit-kaggle-landmarks.mjs` | Manual audit after Kaggle extraction | 7.0 KB |
| `db-apply.mjs` | Manual migration apply, superseded by `db-migrate` | 1.2 KB |
| `db-audit.mjs` | Manual pre-migration audit | 2.9 KB |
| `db-find-region.mjs` | Brute-force region finder, setup tool | 1.2 KB |
| `db-migrate.mjs` | Core migration tool (manual use only) | 1.6 KB |
| `db-provision.mjs` | One-time provision script | 5.2 KB |
| `db-rerun-rls.mjs` | Ad-hoc RLS re-application | 1.0 KB |
| `db-rollup-metrics.mjs` | Manual metrics rollup | 3.6 KB |
| `db-seed-gestures.mjs` | Manual seed, superseded by `seed-fsl105-gestures` | 3.5 KB |
| `db-test.mjs` | Connectivity test | 1.0 KB |
| `db-verify-shape.mjs` | SQL function shape verification | 1.5 KB |
| `debug-single.mjs` | Developer debug tool | 4.9 KB |
| `evaluate-bilstm-v2-confidence.mjs` | Manual confidence evaluation | 6.6 KB |
| `evaluate-bilstm-v2-runtime.mjs` | Manual runtime evaluation | 3.6 KB |
| `export-unified-bilstm-tfjs.mjs` | Used once, should have npm alias | 4.4 KB |
| `extract-fsl-105-landmarks.mjs` | Manual extraction, used once | 14.0 KB |
| `extract-fsl-kaggle-mediapipe.mjs` | Alternative extraction, superseded | 12.4 KB |
| `extract-fsl-kaggle-resume.mjs` | Ad-hoc re-extraction for Y/Z labels | 9.4 KB |
| `merge-datasets.mjs` | Early merge, superseded by v2/v3 | 1.9 KB |
| `seed-fsl105-gestures.mjs` | Manual seed | 8.7 KB |
| `test-extract-single.mjs` | Developer debug | 4.9 KB |
| `test-server.mjs` | Minimal HTTP server test | 0.9 KB |
| `train-unified-bilstm.mjs` | Training script (historical) | 25.8 KB |
| `validate-kaggle-landmarks.mjs` | Manual validation | 5.6 KB |
| `verify-bilstm-v2-tfjs-predictions.mjs` | Manual verification | 4.3 KB |

**Total: 27 scripts, ~168 KB**

### REVIEW REQUIRED (scripts with npm aliases but possibly unused)

| Script | npm Alias | Notes |
|--------|-----------|-------|
| `download-fsl-dataset.py` | `download:fsl-dataset` | Has npm alias, ad-hoc use |
| `augment-fsl-alphabet.mjs` | `augment:fsl-alphabet` | Data augmentation, used once |
| `standardize-fsl-alphabet-dataset.mjs` | `standardize:fsl-alphabet` | Once-off standardization |
| `validate-dataset.mjs` | `validate:dataset` | General validation, could be useful |
| `seed-fsl105-gestures.mjs` | None | No alias but valuable for DB seeding |

---

## MODELS

### SAFE TO DELETE (orphaned training artifacts)

| Directory | Size | Reason |
|-----------|------|--------|
| `models/fsl_alphabet/baseline/` | 8.5 MB | DNN, replaced by BiLSTM |
| `models/fsl_alphabet/lstm/` | ~400 KB | Never deployed post-refinement |
| `models/fsl_alphabet/bilstm/` | ~850 KB | Superseded by unified |
| `models/fsl_alphabet/bilstm_v2/` | ~850 KB | Superseded by unified |
| `models/fsl_alphabet/bilstm_v3/` | ~850 KB | Superseded by unified |
| `models/fsl_alphabet/cnn_lstm/` | ~500 KB | Never deployed |
| `models/fsl_alphabet/cross_signer_eval/` | ~2 KB | Artifact |
| `models/fsl_105/bilstm/` | ~950 KB | Superseded by unified |
| `public/models/fsl_alphabet/tfjs/` | 89 KB | Legacy export, not loaded |
| `public/models/fsl_alphabet/bilstm_v2_tfjs/` | 170 KB | Legacy export, not loaded |
| `public/models/fsl_105/` | 195 KB | Legacy export, not loaded |

**Total: ~14.3 MB**

---

## PAGES / ROUTES

### SAFE TO DELETE (duplicate/legacy)

| Route | File | Size | Reason |
|-------|------|------|--------|
| `/camera` | `src/app/(routes)/camera/page.tsx` | 39.9 KB | Legacy page, superseded by `/translate` (13.6 KB) |

### REVIEW REQUIRED (possibly redundant)

| Route | File | Reason |
|-------|------|--------|
| `/presentation` | `src/app/presentation/page.tsx` | Specialized use, not a true duplicate |
| `/evaluation` | `src/app/evaluation/page.tsx` | Evaluation tool, not a user-facing page |

---

## COMPONENTS

### SAFE TO DELETE

| Component | Reason |
|-----------|--------|
| `(routes)/camera/page.tsx` | Superseded by `translate/page.tsx` |
| `components/UserPageWrapper.tsx` | Wraps old pages, check if still used |

---

## DUPLICATE IMPLEMENTATIONS

| What | Duplicate Of | Notes |
|------|-------------|-------|
| `(routes)/camera/page.tsx` | `translate/page.tsx` | Both provide camera + recognition |
| `(routes)/` route group | `translate/` route | Legacy vs refactored |
| `models/fsl_alphabet/bilstm_tfjs/` | `public/models/fsl_alphabet/bilstm_v2_tfjs/` | Same weights copied to both locations |
| `datasets/processed/fsl_kaggle_landmarks/` | `datasets/external/fsl_kaggle_landmarks/` | Both contain landmark JSON files |

---

## SUMMARY

| Category | SAFE TO DELETE | REVIEW REQUIRED | ACTIVE |
|----------|---------------|-----------------|--------|
| Scripts | 27 files (~168 KB) | 5 files | 48 files |
| Models | 11 dirs (~14.3 MB) | 0 | 1 deployed model |
| Pages | 1 route | 2 routes | ~30 routes |
| Components | 2 files | 0 | ~50+ components |
| **Total** | **~14.5 MB** | **7 files** | **Active codebase** |
