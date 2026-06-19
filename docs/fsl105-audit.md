# FSL-105 Audit Report

## 1. Was FSL-105 Actually Used?

**YES.** The FSL-105 dataset was fully processed and used for training.

Evidence:

### Dataset Extraction
- **Path**: `datasets/raw/fsl_105/`
  - `labels.csv` — 105 labels with categories
  - `train.csv` — 1703 video clip references
  - `test.csv` — 426 video clip references
  - `clips/` — 105 subdirectories with ~20 .MOV video files each

### Landmark Extraction
- **Path**: `datasets/processed/fsl_105/`
  - `train.json` — 340 MB, 1703 samples with 120-frame 126-feature sequences
  - `test.json` — 85 MB, 426 samples with 120-frame 126-feature sequences
  - `labels.json` — 105 label mappings with idToLabel/labelToId
  - `metadata.json` — 2129 total samples, 105 signers

### Training Scripts
- `scripts/extract-fsl-105-landmarks.mjs` — MediaPipe hand landmark extraction via Puppeteer
- `scripts/train-fsl-105-bilstm.mjs` — FSL-105-only training
- `scripts/export-fsl-105-bilstm-tfjs.mjs` — TFJS export
- `scripts/merge-datasets.mjs` — Merges alphabet + FSL-105 into unified
- `scripts/train-unified-bilstm.mjs` — Unified model training
- `scripts/export-unified-bilstm-tfjs.mjs` — Unified TFJS export

## 2. Which Model Is Currently Deployed?

**Runtime model**: `public/models/fsl_unified/bilstm_tfjs/model.json`
- Loaded by: `src/features/recognition/model/loader.ts` at path `/models/fsl_unified/bilstm_tfjs/model.json`
- Type: BiLSTM (Bidirectional LSTM)
- Input: [30, 126] (30 temporal steps × 126 landmarks)
- Output: 133 classes (softmax)

## 3. Number of Classes Currently Deployed

**133 classes**: 28 alphabet (a-z, ñ, ng) + 105 FSL-105 signs.

The final dense layer has `"units": 133` (confirmed in model.json topology).

## 4. Number of Classes Available in FSL-105

**105 classes** across 12 categories:
- GREETING (10), SURVIVAL (10), NUMBER (10), CALENDAR (12), DAYS (10)
- FAMILY (10), RELATIONSHIPS (10), COLOR (13), FOOD (10), DRINK (10)

## 5. Why Phrase/Sign Recognition Is Not Working

**The runtime model DOES include all 105 FSL-105 signs.** The likely reasons for poor recognition in practice:

1. **Dynamic vs static mismatch**: FSL-105 signs are 4-second video clips with motion. Alphabet letters are static poses. The current pipeline treats both identically — collecting frames and running inference every 200ms. A user holding a static "THANK YOU" won't produce the temporal motion pattern the model was trained on.

2. **Label picker is A-Z only**: The camera page (`page.tsx:967`) shows a label picker with only 26 alphabet letters. Users cannot correct FSL-105 predictions.

3. **translation.ts is A-Z only**: `LABEL_DISPLAY` only maps lowercase letters to uppercase. FSL-105 labels pass through unchanged but receive no friendly display mapping.

4. **Gesture library sparse**: Only 36 `gestures` table rows exist. 96 of 105 FSL-105 signs have no DB entry, so `lookupGesture()` returns null for them.

5. **Confidence threshold unknown**: The FSL-105 model had 84.98% test accuracy; the unified model 88.84%. Per-class accuracy varies. Some signs may fall below the default confidence threshold.

## 6. What Code Paths Are Preventing It

| File | Issue |
|------|-------|
| `src/features/recognition/translation.ts:3-30` | `LABEL_DISPLAY` only covers a-z |
| `src/app/(routes)/camera/page.tsx:967` | Label picker hardcoded to 26 letters |
| `src/features/recognition/model/loader.ts:4-5` | Correct model loaded, no issue here |
| `src/features/gestures/queries.ts` | `lookupGesture()` only finds 36 of 133 labels |

## 7. Estimated Effort to Migrate to a 105-Class Sign Recognizer

**Already done.** The model already supports 105 classes. Estimated effort to fix the UI/DB gaps:

| Task | Effort | Description |
|------|--------|-------------|
| Fix `translation.ts` | 1 hour | Add display mapping for all 133 labels |
| Fix label picker | 2 hours | Dynamic label picker from model labels |
| Add 97 gesture DB rows | 2 hours | SQL insert for missing FSL-105 gestures |
| Add replies for new gestures | 4 hours | Create reply templates per new gesture |
| Tune thresholds per-class | 4 hours | Set per-label confidence thresholds |
| **Total** | **~13 hours** | |

## 8. Recommended Next Implementation Step

1. **Add missing `gestures` rows** (97 inserts) so all 105 FSL-105 signs have DB entries and `lookupGesture()` works.
2. **Replace static label picker** with a dynamic picker generated from `cache.labels` in the model loader.
3. **Update `translation.ts`** to include all FSL-105 display labels.
4. **Test FSL-105 predictions** by performing the dynamic gestures from the dataset and verifying they show in the transcript.
