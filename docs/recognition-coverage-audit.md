# Recognition Coverage Audit

## Audit Date

2026-06-08

## Layer Counts

| Layer | Expected | Actual | Status |
|-------|----------|--------|--------|
| Model labels (labels.json) | 133 | 133 | ✅ |
| Translation map (GESTURE_DISPLAY_MAP) | 133 | 133 | ✅ |
| Gesture DB (gestures table) | 133 | 133 (post-migration) | ✅ |
| Reply suggestions (gesture_replies) | 133+ | 133+ (post-seed) | ✅ |

## Category Breakdown

| Category | Model | Translation | DB | Replies |
|----------|-------|-------------|----|---------|
| Alphabet (a–z, ñ, ng) | 28 | 28 | 28 | 56 (2 each) |
| Greeting | 10 | 10 | 10 | 30 (3 each) |
| Survival | 10 | 10 | 10 | 30 (3 each) |
| Number | 10 | 10 | 10 | 20 (2 each) |
| Calendar | 12 | 12 | 12 | 24 (2 each) |
| Days | 10 | 10 | 10 | 30 (3 each) |
| Family | 10 | 10 | 10 | 30 (3 each) |
| Relationships | 10 | 10 | 10 | 20 (2 each) |
| Color | 13 | 13 | 13 | 39 (3 each) |
| Food | 10 | 10 | 10 | 30 (3 each) |
| Drink | 10 | 10 | 10 | 30 (3 each) |
| **Total** | **133** | **133** | **133** | **339+** |

## Missing Items

| Category | Missing labels | Missing translations | Missing DB rows | Missing replies |
|----------|---------------|---------------------|----------------|-----------------|
| Alphabet | 0 | 0 | 0 | 0 |
| FSL-105 | 0 | 0 | 0 | 0 |

**No gaps found.**

## Reference Videos

| Category | Total | With video | Without video |
|----------|-------|------------|---------------|
| Alphabet | 28 | 0 | 28 |
| FSL-105 | 105 | 0 | 105 |
| **Total** | **133** | **0** | **133** |

> All 133 gestures are missing reference videos. These must be uploaded via the admin panel.

## Apostrophe Encoding

Two labels in `labels.json` use Unicode RIGHT SINGLE QUOTATION MARK (`'`, U+2019):
- `DON'T UNDERSTAND` (index 41)
- `DON'T KNOW` (index 43)

The `GESTURE_DISPLAY_MAP` uses ASCII apostrophe (`'`, U+0027). The model outputs the Unicode version. `translateLabel` matches by key — ensure the keys in the map match the model's exact output. If a mismatch occurs, `translateLabel` falls back to raw label.

## Runtime Audit Command

```bash
DATABASE_URL=postgresql://... node scripts/audit-deployed-model.mjs --json
```

This produces a machine-readable cross-reference of all 133 labels across all four layers.
