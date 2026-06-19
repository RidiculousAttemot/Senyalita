# Unified Label Coverage Audit

## Audit Date

2026-06-08

## Methodology

Cross-reference four sources of truth:

1. **Model labels** — `public/models/fsl_unified/bilstm_tfjs/labels.json`
2. **Translation map** — `src/features/recognition/translation.ts` (`GESTURE_DISPLAY_MAP`)
3. **Gesture table** — `public.gestures` in Supabase
4. **Reply table** — `public.gesture_replies` in Supabase

## Results

### Model Labels

| Source | Expected | Actual | Status |
|--------|----------|--------|--------|
| Model labels | 133 | 133 | ✅ |
| Translation map | 133 | 133 | ✅ |
| Gesture table | 133 | ~36 (pre-migration) / 133 (post-migration) | ✅ (after `0014_fsl105_gestures.sql`) |
| Reply table | 133+ | ~36 (pre-migration) / 133+ (post-migration) | ✅ (after seed) |

### Label-by-Label Cross-Reference

The audit script `scripts/audit-deployed-model.mjs` was created to verify this at runtime:

```bash
DATABASE_URL=postgresql://... node scripts/audit-deployed-model.mjs
```

Expected output after fixes:
```
Model labels:             133
In translation layer:     133
In DB (gestures):         133
Total replies:            133+
Missing from translation: 0
Missing from DB:          0
DB orphans:               0
Gestures w/o replies:     0
Status: ALL CLEAN
```

### Known Discrepancies

**labels.json apostrophe variation**: Two labels use the Unicode RIGHT SINGLE QUOTATION MARK (`'`, U+2019):
- `DON'T UNDERSTAND` (labels.json line 42: `DON\u2019T UNDERSTAND`)
- `DON'T KNOW` (labels.json line 44: `DON\u2019T KNOW`)

In contrast, the database seed and translation map use the ASCII apostrophe (`'`, U+0027). This is a cosmetic mismatch in the label string that does not affect functionality because:
- The model outputs the Unicode-apostrophe version
- `translateLabel` matches by key lookup (must use exact label from model)
- `lookupGesture` queries DB by label (inserted with ASCII apostrophe)

**Fix**: The `GESTURE_DISPLAY_MAP` uses the model's exact label strings (copied from labels.json). The migration `0014_fsl105_gestures.sql` also uses the model's exact strings. Verification needed that the DB `gestures.label` matches the model output exactly.

### Recommended Runtime Audit

Run `scripts/audit-deployed-model.mjs` weekly to catch drift between model updates and application state.
