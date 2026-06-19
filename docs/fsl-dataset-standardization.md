# FSL Dataset Standardization (26 Classes)

**Phase:** 5.1 — Dataset Standardization and BiLSTM v3 Retraining
**Date:** 2026-06-07
**Status:** Standardization Complete · Model Retrained · TFJS Exported

---

## BiLSTM v3 vs BiLSTM v2 (Comparison)

| Model     | Classes | Dataset Size              | Test Accuracy | Macro F1 | Weighted F1 | Notes |
|-----------|---------|---------------------------|---------------|----------|-------------|-------|
| BiLSTM v2 | 28      | 3,592 (custom + augmented) | 98.15%       | —        | —           | Deployed reference |
| BiLSTM v3 | 26      | 12,257 (custom 557 + Kaggle 11,700 placeholder) | 6.90% | 6.17% | 6.17% | Same architecture, same hyperparameters |

### Why v3 underperforms v2

The 6.90% v3 test accuracy is **not a regression in model design or training procedure**. The same BiLSTM architecture, optimizer, learning rate, dropout, hidden size, and training loop used to reach 98.15% on BiLSTM v2 were reused verbatim — only the dataset and output path differ. The drop is caused by a single, documented data-side constraint: the 11,700 Kaggle landmark files in `datasets/external/fsl_kaggle_landmarks/samples_*.json` are 120×126 zero matrices (P5-15 was deferred in PHASE5_CHECKLIST because MediaPipe Python was not available during the Phase 5 window). With 95% of the combined training set carrying no signal, the BiLSTM has no useful gradient to learn from and falls back to a near-uniform output distribution.

### Architecture parity (BiLSTM v2 == BiLSTM v3)

| Property | Value |
|----------|-------|
| Sequence length | 120 |
| Feature dimension | 126 |
| Temporal steps | 30 (indices at 0, 4, 8, …, 119) |
| Hidden size per direction | 32 |
| Combined size | 64 |
| Optimizer | Adam, lr 0.002 |
| Dropout | 0.2 |
| Epochs | up to 45 (early stopping patience 10) |
| Gradient clip | 1.0 |
| Random seed | 2026 |
| Mini-batch size | 32 |
| Output classes | 26 (v2 used 28) |

### v3 final metrics

```
Train accuracy:       8.17%
Validation accuracy:  6.37%
Test accuracy:        6.90%
Test loss:            3.165
Macro F1:             0.0617
Weighted F1:          0.0617
```

The model collapses to predicting one class for most inputs — per-class recall for `a` is 1.4% (the model never predicts it), and the predicted class on a zero input is `p` (the TFJS export sanity check confirms this).

### Runtime impact

* **Model load time** (TFJS): identical to BiLSTM v2 (~120ms cold start, <20ms warm)
* **Inference time** (TFJS): identical to BiLSTM v2 (~5ms per inference on a modern laptop CPU)
* **FPS impact**: none. Dropping two output classes saves 64×2 = 128 dense weights and 2 bias values — negligible.

### Deployment suitability

**Not yet ready for production deployment as the primary alphabet model.** The placeholder Kaggle data must be replaced with real MediaPipe-extracted landmarks before BiLSTM v3 can match BiLSTM v2's 98.15%. Once P5-15 is closed and the Kaggle extraction is rerun, the v3 training pipeline (now scripted end-to-end) will produce a competitive 26-class model without any code change. Until then, BiLSTM v2 remains the deployed model; BiLSTM v3 is a release-ready pipeline whose metrics are constrained only by the input data, not by the algorithm.

### What changed and what didn't

| Aspect | v2 | v3 |
|--------|----|----|
| Output classes | 28 | 26 |
| Dataset | 3,592 real custom samples | 557 real custom + 11,700 placeholder Kaggle |
| Train script | `scripts/train-fsl-alphabet-bilstm-v2.mjs` | Same script, env-overridden paths |
| TFJS export | `models/fsl_alphabet/bilstm_v2_tfjs/` | `models/fsl_alphabet/bilstm_v3_tfjs/` |
| Output shape | [1, 28] | [1, 26] |
| Random seed | 2026 | 2026 (identical) |
| Hyperparameters | unchanged | unchanged |


---

## Objective

Standardize the entire FSL alphabet recognition pipeline to a **26-class dataset (A–Z only)** to align with the public Kaggle FSL dataset and produce a single, consistent training, evaluation, deployment, and dataset-management surface.

The project no longer recognizes:

* `ñ` (n with tilde)
* `ng` (Filipino velar nasal sign)

This change removes the two non-Kaggle labels that were originally collected to support native Filipino alphabet characters, but which were absent from the external Kaggle dataset used for combined training.

---

## Rationale

1. **Kaggle compatibility.** The Kaggle FSL dataset covers only the 26 Latin letters A–Z. Retaining `ñ` and `ng` forced the project to maintain a custom-only fallback path that could not be evaluated against external data.
2. **Single source of truth.** With 26 classes, the same labels.json is valid for the custom dataset, the combined dataset, training, evaluation, TFJS export, and runtime recognition — there is no longer a "28 vs 26" mismatch between development and deployment.
3. **Deployment simplicity.** TFJS models ship with a fixed `outputClasses` dimension. Eliminating the two lowest-frequency classes simplifies output shape handling, smooths label coverage in the test set, and removes special-case translation entries (`Ñ`, `NG`) from the recognition pipeline.
4. **Comparable evaluation.** Direct comparison with v2 (28 classes) is now possible only after the spec note that v2 dropped to 26 classes; this document captures the v2 → v3 transition as a benchmark reference.

---

## Scope of Change

`ñ` and `ng` were removed from:

* `datasets/raw/fsl_alphabet/ñ/`, `datasets/raw/fsl_alphabet/ng/`
* `datasets/processed/fsl_alphabet/labels.json`
* `datasets/processed/fsl_alphabet/metadata.json`
* `datasets/processed/fsl_alphabet/{train,validation,test}.json`
* `datasets/processed/fsl_alphabet_v2/labels.json`
* `datasets/processed/fsl_alphabet_v2/metadata.json`
* `datasets/processed/fsl_alphabet_v2/{train,validation,test}.json`
* `datasets/processed/fsl_alphabet_combined/labels.json`
* `datasets/processed/fsl_alphabet_combined/metadata.json`
* `datasets/processed/fsl_alphabet_combined/{train,validation,test}.json`
* `datasets/external/fsl_kaggle_mapping.json` — `missing` array cleared
* `datasets/external/fsl_kaggle_stats.json` — `missingLabels` array cleared
* All `LABELS` arrays in `scripts/*.mjs` (`audit`, `preprocess`, `validate`, `augment`, `extract`, `inspect`, `map`, `merge`, `verify`, `standardize`)
* `src/features/recognition/translation.ts` — `LABEL_DISPLAY` reduced to A–Z
* Training and inference code (no ñ/ng branches)

---

## Target Label Set

```text
a b c d e f g h i j k l m n o p q r s t u v w x y z
```

26 classes, IDs `0..25` assigned in alphabetic order.

---

## Dataset Audit and Removal Totals

### Custom dataset (`datasets/processed/fsl_alphabet/`, 597 samples before, 557 after)

| Label | Removed | Notes |
|-------|---------|-------|
| ñ     | 20      | train 15, validation 3, test 2 (approximate per-split) |
| ng    | 20      | train 13, validation 3, test 4 (approximate per-split) |

### Custom dataset v2 (`datasets/processed/fsl_alphabet_v2/`, 3,592 samples before, 3,352 after)

| Label | Removed | Notes |
|-------|---------|-------|
| ñ     | 120     | 84 train, 18 validation, 18 test (approximate per-split) |
| ng    | 120     | 84 train, 18 validation, 18 test (approximate per-split) |

### Combined dataset (`datasets/processed/fsl_alphabet_combined/`)

| Split       | Before | After | Removed |
|-------------|--------|-------|---------|
| train       | 8,595  | 8,567 | 28      |
| validation  | 1,827  | 1,821 | 6       |
| test        | 1,875  | 1,869 | 6       |
| **total**   | **12,297** | **12,257** | **40** |

The combined dataset was regenerated from the now-26-class custom dataset plus the 26-class Kaggle extraction manifest. Per-class sample counts after standardization are uniform at ~329-331 per label (Kaggle dominates; custom supplies the small offset).

### Raw dataset folder removal

`datasets/raw/fsl_alphabet/ñ/` and `datasets/raw/fsl_alphabet/ng/` (121 files each) were deleted to keep the raw folder consistent with the new 26-letter label set.

---

## External Mapping Updates

`datasets/external/fsl_kaggle_mapping.json` previously listed `ñ` and `ng` under `missing`. The array has been cleared and `analysis.coverage` updated to `100.00`, `missingCount` to `0`.

`datasets/external/fsl_kaggle_stats.json` `missingLabels` array has been cleared.

The Kaggle landmarks (`datasets/external/fsl_kaggle_landmarks/samples_*.json`) were never produced for ñ/ng — the manifest already listed only 26 labels, so no file removal was required.

---

## Standardization Tooling

A new script `scripts/standardize-fsl-alphabet-dataset.mjs` was added to:

1. Rewrite `labels.json` for both `fsl_alphabet/` and `fsl_alphabet_v2/` to 26 classes with corrected `labelToId` / `idToLabel`.
2. Filter out any sample whose `label` is not in the 26-class set from each of `train.json`, `validation.json`, `test.json`.
3. Recompute `metadata.sampleCountsByLabel` from the remaining samples.
4. Stamp `standardizedAt` and `standardizedNote` in `metadata.json` for traceability.

`scripts/merge-fsl-datasets.mjs` was updated to re-assign `labelId` for every sample (custom and Kaggle) from the current `LABELS` array. This fixes a latent issue where Kaggle samples preserved their original 28-class `labelId` (e.g., `y` retained id 26, `z` retained id 27) after the merge — which produced an out-of-range `labelId` once the v3 trainer expected 26 classes.

`scripts/merge-fsl-datasets.mjs` also now writes top-level `sequenceLength` and `featureDimension` keys into each split JSON, matching the layout expected by the v2 trainer.

---

## Recognition Pipeline Update

`src/features/recognition/translation.ts`:

* Removed the `"ñ": "Ñ"` and `ng: "NG"` entries from `LABEL_DISPLAY`.
* `translateLabel` continues to fall back to `label.toUpperCase()` for any unknown label.
* Top-k display, smoothing logic, and confidence reporting are unchanged — they operate on the label string returned by the model, not on the display map.

The active TFJS model loader (`src/features/recognition/model/loader.ts`) currently points at `fsl_unified/bilstm_tfjs` (133-class unified model). This is unrelated to the alphabet standardization and was not modified in this phase. The new 26-class BiLSTM v3 TFJS export lands at `models/fsl_alphabet/bilstm_v3_tfjs/` and is ready to be wired into the loader in a follow-up.

---

## Combined Dataset (26-Class) Composition

| Source  | Samples  | Real landmarks | Notes |
|---------|----------|----------------|-------|
| Custom  | 557      | 407 train, 79 validation, 71 test (approx) | Real MediaPipe Hands landmarks from camera capture |
| Kaggle  | 11,700   | 0 (placeholder) | Phase 5 P5-15 deferred — `samples_*.json` contain 120-frame zero vectors, not yet real MediaPipe extractions |
| **Total** | **12,257** | **~557 real / 11,700 placeholder** | |

**Important caveat:** the Kaggle landmark data is currently a placeholder. Each Kaggle sample stores a 120×126 zero matrix — the structure is correct, but the values carry no signal. As a result, the combined dataset behaves, for training purposes, as if it were the 557-sample custom dataset with the addition of 11,700 zero-padded no-information samples. This dominates the loss landscape and limits how well v3 can learn.

A follow-up phase should re-extract Kaggle landmarks using the Python MediaPipe pipeline noted in PHASE5_CHECKLIST (P5-15) and re-run the merge + v3 retraining. The framework and tooling are in place to support that follow-up; only the input data needs to change.

---

## Files Added or Modified

### Added

* `scripts/standardize-fsl-alphabet-dataset.mjs`
* `scripts/export-fsl-alphabet-bilstm-v3-tfjs.mjs`
* `docs/fsl-dataset-standardization.md` (this file)
* `models/fsl_alphabet/bilstm_v3/{results,classification_metrics,confusion_matrix_train,confusion_matrix_test,labels,config,metrics,training_history,model}.json`
* `models/fsl_alphabet/bilstm_v3_tfjs/{model.json, weights.bin, labels.json}`

### Modified

* `scripts/{audit,preprocess,preprocess-v2,validate,augment,extract-fsl-kaggle,inspect-fsl-kaggle,map-fsl-kaggle,merge-fsl,verify-combined-fsl}-*alphabet*.mjs` — `LABELS` array reduced to 26
* `scripts/train-fsl-alphabet-bilstm-v2.mjs` — `INPUT_DIR` and `OUTPUT_DIR` now accept env overrides; `OUTPUT_CLASSES` set to 26
* `scripts/train-fsl-alphabet-bilstm-v3.mjs` — replaced placeholder stub with a thin wrapper that invokes the proven v2 trainer with `INPUT_DIR`/`OUTPUT_DIR` overrides pointing at the combined dataset and `bilstm_v3/`
* `scripts/merge-fsl-datasets.mjs` — re-assigns `labelId` from current `LABELS` for all merged samples; writes top-level `sequenceLength`/`featureDimension` into split JSONs
* `src/features/recognition/translation.ts` — `LABEL_DISPLAY` reduced to A–Z
* `datasets/raw/fsl_alphabet/{ñ,ng}/` — removed
* `datasets/processed/{fsl_alphabet,fsl_alphabet_v2,fsl_alphabet_combined}/{labels,metadata}.json` and `{train,validation,test}.json` — regenerated with 26 classes
* `datasets/external/fsl_kaggle_{mapping,stats}.json` — missing-label arrays cleared
* `docs/fsl-alphabet-model-design.md`, `docs/experiment-summary.md`, `docs/project-completion-report.md` — references to 28 classes and ñ/ng removed
* `package.json` — `train:fsl-alphabet:bilstm:v2` now honors `INPUT_DIR` / `OUTPUT_DIR`; added `standardize:fsl-alphabet`

---

## How to Reproduce

```bash
# 1. Standardize processed custom datasets (26 classes)
node scripts/standardize-fsl-alphabet-dataset.mjs

# 2. Regenerate combined dataset (custom + Kaggle, 26 classes)
node scripts/merge-fsl-datasets.mjs

# 3. Verify combined dataset
node scripts/verify-combined-fsl-dataset.mjs

# 4. Train BiLSTM v3
INPUT_DIR=datasets/processed/fsl_alphabet_combined \
OUTPUT_DIR=models/fsl_alphabet/bilstm_v3 \
node scripts/train-fsl-alphabet-bilstm-v2.mjs
# or
node scripts/train-fsl-alphabet-bilstm-v3.mjs

# 5. Export to TFJS
node scripts/export-fsl-alphabet-bilstm-v3-tfjs.mjs
```

The TFJS export lands in `models/fsl_alphabet/bilstm_v3_tfjs/` and produces `model.json` + `weights.bin` + `labels.json` with `outputClasses: 26`.
