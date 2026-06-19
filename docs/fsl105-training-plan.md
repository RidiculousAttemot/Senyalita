# FSL-105 Training Plan

## Status: Already Complete

**The FSL-105 model has already been fully trained and deployed.**

### Completed Pipeline

```
FSL-105 Videos (datasets/raw/fsl_105/clips/*.MOV)
    ↓ (scripts/extract-fsl-105-landmarks.mjs)
MediaPipe Hands → Landmark Sequences (datasets/processed/fsl_105/train.json + test.json)
    ↓ (scripts/train-fsl-105-bilstm.mjs)
BiLSTM Sign Classifier (models/fsl_105/bilstm/)
    ↓ (scripts/export-fsl-105-bilstm-tfjs.mjs)
TensorFlow.js Export (models/fsl_105/bilstm_tfjs/)
    ↓ (scripts/merge-datasets.mjs + scripts/train-unified-bilstm.mjs + scripts/export-unified-bilstm-tfjs.mjs)
Unified Model (public/models/fsl_unified/bilstm_tfjs/) ← Runtime
```

### Model Performance

| Model | Classes | Train Acc | Val Acc | Test Acc | Macro F1 |
|-------|---------|-----------|---------|----------|----------|
| FSL-105 only | 105 | 98.07% | 78.04% | 84.98% | 0.844 |
| Unified (alphabet + FSL-105) | 133 | 97.40% | 87.96% | 88.84% | 0.835 |

## Remaining Implementation Work

The model is deployed. What's missing are the **UI and database layers** to fully surface all 105 signs:

### 1. Database — Add Missing Gestures

```sql
-- 97 new gesture rows for unseen FSL-105 signs
INSERT INTO gestures (label, is_active, status, description, category)
VALUES
  ('UNDERSTAND', true, 'approved', 'FSL-105 sign for UNDERSTAND', 'SURVIVAL'),
  ('DONT UNDERSTAND', true, 'approved', 'FSL-105 sign for DONT UNDERSTAND', 'SURVIVAL'),
  -- ... 95 more rows ...
```

### 2. Database — Add Reply Templates

Create default reply entries for each new gesture using a seed script.

### 3. UI — Translation Layer

Update `translation.ts` to map FSL-105 labels to properly formatted display strings.

### 4. UI — Label Picker

Replace the hardcoded A-Z label picker with a dynamic picker that shows all 133 labels from the model's labels.json.

### 5. Admin — Gesture Library

Use the existing `/admin/gestures` page to upload reference videos for the 97 new gesture rows.

### 6. Confidence Calibration

Test per-class confidence thresholds for all 105 FSL-105 signs. Some signs may need custom thresholds.

## Training New Models (If Needed)

If retraining becomes necessary:

```
npm run train:fsl-105       # FSL-105 only
npm run train:unified       # Unified model (alphabet + FSL-105)
npm run export:unified      # TFJS export → public/models/
```

Training time: ~5 minutes per model (31 epochs, early stopping).
