# Model Label Audit

## Currently Deployed Runtime Model

**Path**: `public/models/fsl_unified/bilstm_tfjs/model.json`
**Classes**: 133 (28 alphabet + 105 FSL-105 signs)
**Accuracy**: 88.84% test accuracy

### Labels (133 total)

Indices 0-27: Alphabet (28)
```
a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z, ñ, ng
```

Indices 28-132: FSL-105 signs (105)
```
GOOD MORNING, GOOD AFTERNOON, GOOD EVENING, HELLO, HOW ARE YOU, IM FINE,
NICE TO MEET YOU, THANK YOU, YOURE WELCOME, SEE YOU TOMORROW, UNDERSTAND,
DONT UNDERSTAND, KNOW, DONT KNOW, NO, YES, WRONG, CORRECT, SLOW, FAST,
ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE, TEN,
JANUARY, FEBRUARY, MARCH, APRIL, MAY, JUNE, JULY, AUGUST, SEPTEMBER, OCTOBER, NOVEMBER, DECEMBER,
MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY, TODAY, TOMORROW, YESTERDAY,
FATHER, MOTHER, SON, DAUGHTER, GRANDFATHER, GRANDMOTHER, UNCLE, AUNTIE, COUSIN, PARENTS,
BOY, GIRL, MAN, WOMAN, DEAF, HARD OF HEARING, WEELCHAIR PERSON, BLIND, DEAF BLIND, MARRIED,
BLUE, GREEN, RED, BROWN, BLACK, WHITE, YELLOW, ORANGE, GRAY, PINK, VIOLET, LIGHT, DARK,
BREAD, EGG, FISH, MEAT, CHICKEN, SPAGHETTI, RICE, LONGANISA, SHRIMP, CRAB,
HOT, COLD, JUICE, MILK, COFFEE, TEA, BEER, WINE, SUGAR, NO SUGAR
```

---

## All Models in Repository

### Alphabet Models (26-28 classes)

| Model | Path | Classes | Labels |
|-------|------|---------|--------|
| bilstm_v2 | `models/fsl_alphabet/bilstm_v2/` | 28 | a-z + ñ + ng |
| bilstm_v2_tfjs | `models/fsl_alphabet/bilstm_v2_tfjs/` | 28 | a-z + ñ + ng |
| bilstm_v3 | `models/fsl_alphabet/bilstm_v3/` | 26 | a-z |
| bilstm_v3_tfjs | `models/fsl_alphabet/bilstm_v3_tfjs/` | 26 | a-z |
| baseline | `models/fsl_alphabet/baseline/` | 26 | a-z |
| bilstm | `models/fsl_alphabet/bilstm/` | 26 | a-z |
| cnn_lstm | `models/fsl_alphabet/cnn_lstm/` | 26 | a-z |
| lstm | `models/fsl_alphabet/lstm/` | 26 | a-z |
| tfjs | `public/models/fsl_alphabet/tfjs/` | 26 | a-z |

**Public serving path**: `public/models/fsl_alphabet/bilstm_v2_tfjs/` (28 classes: a-z + ñ + ng)

### FSL-105 Models (105 classes)

| Model | Path | Classes | Test Acc |
|-------|------|---------|----------|
| bilstm | `models/fsl_105/bilstm/` | 105 | 84.98% |
| bilstm_tfjs | `models/fsl_105/bilstm_tfjs/` | 105 | 84.98% |

**Public serving path**: `public/models/fsl_105/` (105 classes, same as bilstm_tfjs)

### Unified Model (133 classes = 28 alphabet + 105 FSL-105)

| Model | Path | Classes | Test Acc |
|-------|------|---------|----------|
| bilstm | `models/fsl_unified/bilstm/` | 133 | 88.84% |
| bilstm_tfjs | `public/models/fsl_unified/bilstm_tfjs/` | 133 | 88.84% |

**This is the runtime model**.

---

## Runtime Loading

The camera page (`loader.ts`) loads:
```
MODEL_URL = "/models/fsl_unified/bilstm_tfjs/model.json"
LABELS_URL = "/models/fsl_unified/bilstm_tfjs/labels.json"
```

**Result**: 133 classes, output `dense` layer has `units: 133`.

### Translation Layer

`translation.ts` only maps lowercase `a-z` → uppercase `A-Z`. For FSL-105 signs, `translateLabel()` applies `label.toUpperCase()` (no-op for uppercase labels). FSL-105 signs pass through unchanged.

### Issue

The `translation.ts` `LABEL_DISPLAY` map only covers 26 alphabet letters. 107 other labels (ñ, ng, and 105 FSL-105 signs) are not explicitly mapped. They render via the fallback `label.toUpperCase()`, which for already-uppercase strings produces no visible change. This is functional but not user-friendly for phrase signs.

---

## Which Model Trained Which Dataset

| Model | Dataset | Samples | Signers |
|-------|---------|---------|---------|
| bilstm_v2 | fsl_alphabet_v2 (Kaggle + custom) | ~4500 | Multi-signer |
| bilstm_v3 | fsl_alphabet_combined (v2 + more) | ~4500 | Multi-signer |
| fsl_105/bilstm | fsl_105 (FSL-105 dataset) | 2129 | 105 |
| fsl_unified/bilstm | fsl_alphabet_v2 + fsl_105 | ~5500 | Multi-signer |
