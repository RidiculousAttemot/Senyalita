---
name: fsl-pipeline
description: Navigate SignLangVisual's dataset/model pipeline safely — which dataset and model are current production, which of the 120+ scripts/ files are canonical vs superseded, and where raw/processed data and trained models live. Use before running any script under scripts/, touching datasets/ or models/, or being asked to retrain/audit/export the FSL recognition model.
---

# FSL dataset & model pipeline

This repo has accumulated **120+ one-off scripts** in `scripts/` across ~45 project
phases (see [AGENTS.md](../../../AGENTS.md) for the full phase history). Many scripts
are versioned duplicates (`-v2`, `-v3`, `-v4`, `-v45`) left in place after later phases
superseded them. Before reusing or modifying a script, confirm it's still the
canonical one — don't assume the newest-looking filename is current; check AGENTS.md's
most recent phases first.

## Current production state (per AGENTS.md, Phase 45 — verify before relying on this)

- **Dataset**: `datasets/processed/fsl_alphabet_kaggle_v2` (14,217 samples, 26 alphabet
  classes + phrase classes, 131 total classes, 7 signers)
- **Model**: `models/fsl_unified/bilstm_v2` (BiLSTM, 35 temporal steps, 48 hidden units,
  94.86% test accuracy)
- **Deployed/served model**: `public/models/fsl_unified/bilstm_tfjs/` (TF.js format —
  `model.json` + `weights.bin` + `labels.json`, loaded client-side)
- Other dirs under `models/fsl_unified/` (`bilstm_v4`, `bilstm_v4_bak`) and
  `datasets/processed/` (`fsl_105`, `fsl_unified_augmented`, `fsl_unified_balanced`,
  `fsl_unified_v4`) are earlier/experimental artifacts, not necessarily deployed —
  check the relevant phase entry in AGENTS.md before assuming one is live.

## Canonical pipeline (blessed npm scripts, per package.json)

```
npm run standardize:fsl-alphabet   # scripts/standardize-fsl-alphabet-dataset.mjs
npm run build:unified-v4           # scripts/build-unified-dataset-v4.mjs
npm run train:unified              # scripts/train-unified-bilstm-v2.mjs
npm run export:unified-tfjs        # scripts/export-unified-bilstm-tfjs.mjs
```

Everything else in `scripts/` (audit-*, evaluate-*, extract-*-landmarks, merge-*,
augment-*, benchmark-*, db-*) is a standalone tool for a specific phase's task, not
part of a required chain. Check the script's own header comment and cross-reference
the phase in AGENTS.md that introduced it before running it as if it were current.

## Data flow (per AGENTS.md "Key Architecture Decisions")

```
raw video (datasets/raw/) 
  → MediaPipe landmark extraction 
  → wrist-centering 
  → max-abs scaling 
  → temporal interpolation 
  → sequence generation 
  → datasets/processed/<dataset_name>/ (train/val/test splits)
  → training script (pure JS, Float32Array math — no Python ML framework)
  → models/fsl_unified/<model_name>/
  → TF.js export → public/models/fsl_unified/bilstm_tfjs/ (what the app actually loads)
```

The recognition app itself is a **hybrid** static+temporal system
(`src/features/recognition/hybrid/`) — motion-aware routing between a lightweight
static classifier and the temporal BiLSTM, fused via `fusionEngine.ts`. Don't confuse
"the BiLSTM" with "the whole recognition model" when discussing accuracy — check
`src/features/recognition/hybrid/` for how they combine.

## Ground rules

- **Never treat a script run as free.** Training/extraction scripts can take minutes
  to hours and touch large datasets under `datasets/` (gitignored raw video is
  committed in this repo per `git status` — be extra careful with anything that
  deletes or overwrites files there).
- **Before retraining or exporting a new model**, check whether the result is meant to
  replace `public/models/fsl_unified/bilstm_tfjs/` — that's what real users load. Treat
  overwriting it as a deploy-affecting action and confirm with the user first, same as
  any other hard-to-reverse change.
  - **After any dataset/model pipeline work**, follow the [[phase-log]] skill's
  convention for recording what happened in AGENTS.md.
