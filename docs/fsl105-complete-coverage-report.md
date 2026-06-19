# FSL-105 Complete Coverage Report

## Overview

Verifying all 105 FSL-105 gesture classes exist in every required layer.

## Coverage Matrix

### Model Labels

| # | Label | In labels.json |
|---|-------|----------------|
| 1–10 | GOOD MORNING – SEE YOU TOMORROW | ✅ |
| 11–20 | UNDERSTAND – FAST | ✅ |
| 21–30 | ONE – TEN | ✅ |
| 31–42 | JANUARY – DECEMBER | ✅ |
| 43–52 | MONDAY – YESTERDAY | ✅ |
| 53–62 | FATHER – PARENTS | ✅ |
| 63–72 | BOY – MARRIED | ✅ |
| 73–85 | BLUE – DARK | ✅ |
| 86–95 | BREAD – CRAB | ✅ |
| 96–105 | HOT – NO SUGAR | ✅ |

**Model total**: 105 ✅

### Translation Map

FSL-105 labels in `GESTURE_DISPLAY_MAP` (translation.ts lines 32–136): **105 entries** ✅

All labels map to title-case display form, e.g.:
- `"GOOD MORNING"` → `"Good Morning"`
- `"HARD OF HEARING"` → `"Hard of Hearing"`
- `"DEAF BLIND"` → `"Deaf-Blind"`
- `"NO SUGAR"` → `"No Sugar"`

### Gesture Database

Migration `0014_fsl105_gestures.sql` inserts all 105 FSL-105 labels into `public.gestures`.

All have:
- `description`: descriptive text
- `is_active`: true
- `status`: "approved"

### Reference Videos

| Category | Total | With video | Missing |
|----------|-------|------------|---------|
| Greeting | 10 | 0 | 10 |
| Survival | 10 | 0 | 10 |
| Number | 10 | 0 | 10 |
| Calendar | 12 | 0 | 12 |
| Days | 10 | 0 | 10 |
| Family | 10 | 0 | 10 |
| Relationships | 10 | 0 | 10 |
| Color | 13 | 0 | 13 |
| Food | 10 | 0 | 10 |
| Drink | 10 | 0 | 10 |
| **Total** | **105** | **0** | **105** |

**All 105 reference videos need to be uploaded** via the admin panel at `/admin/gestures`.

### Reply Mappings

Migration creates default reply suggestions for all 105 FSL-105 gestures.

| Category | Replies per gesture | Total |
|----------|-------------------|-------|
| Greeting | 3 | 30 |
| Survival | 3 | 30 |
| Number | 2 | 20 |
| Calendar | 2 | 24 |
| Days | 3 | 30 |
| Family | 3 | 30 |
| Relationships | 2 | 20 |
| Color | 3 | 39 |
| Food | 3 | 30 |
| Drink | 3 | 30 |
| **Total** | | **283** |

## Gaps Summary

| Layer | Expected | Actual | Missing |
|-------|----------|--------|---------|
| Model labels | 105 | 105 | 0 |
| Translation map | 105 | 105 | 0 |
| Gestures DB | 105 | 105 | 0 |
| Reply suggestions | 105 | 105 | 0 |
| Reference videos | 105 | 0 | **105** |

## Action Items

1. **Upload reference videos** for all 105 FSL-105 gestures via `/admin/gestures`
2. **Customize reply suggestions** via `/admin/replies` (current ones are generic templates)
3. **Verify apostrophe encoding**: `DON'T UNDERSTAND` and `DON'T KNOW` use Unicode RIGHT SINGLE QUOTATION MARK in model output; ensure DB has same encoding
