# Low-F1 Recovery Analysis

Generated: 2026-06-16

## Summary

Overall model macro F1: **83.45%**
Labels with F1 < 0.50: **11** of 133

## Per-Label Analysis

| Label | Support | Precision | Recall | F1 | Top Confusion | Impact Score |
|-------|:-------:|:---------:|:------:|:-:|:-------------:|:----------:|
| IM FINE | 4 | 0.0% | 0.0% | 0.0% | HELLO (3) | 1.609 |
| RED | 4 | 33.3% | 25.0% | 28.6% | PINK (2) | 1.150 |
| SEVEN | 4 | 50.0% | 25.0% | 33.3% | FOUR (2) | 1.073 |
| APRIL | 4 | 50.0% | 25.0% | 33.3% | AUGUST (3) | 1.073 |
| JANUARY | 4 | 100.0% | 25.0% | 40.0% | JULY (2) | 0.966 |
| JULY | 4 | 33.3% | 50.0% | 40.0% | JUNE (2) | 0.966 |
| FATHER | 4 | 100.0% | 25.0% | 40.0% | SIX (1) | 0.966 |
| MOTHER | 4 | 100.0% | 25.0% | 40.0% | TWO (1) | 0.966 |
| FOUR | 4 | 40.0% | 50.0% | 44.4% | TWO (1) | 0.894 |
| NINE | 4 | 40.0% | 50.0% | 44.4% | FOUR (1) | 0.894 |
| BLUE | 4 | 40.0% | 50.0% | 44.4% | HELLO (1) | 0.894 |

## Detailed Remediation Plan

### IM FINE (F1: 0.0%)

- **Support**: 4 test samples
- **Precision**: 0.0% | **Recall**: 0.0%
- **Top Confusion**: HELLO (3 errors)
- **Diagnosis**: Confused with HELLO (3/4 errors). Both are greeting responses collected from single signer. Need more samples with distinct motion patterns.
- **Difficulty**: medium
- **Remediation**: Collect targeted samples emphasizing differentiation. Add confusion pair to hard-case training.

### RED (F1: 28.6%)

- **Support**: 4 test samples
- **Precision**: 33.3% | **Recall**: 25.0%
- **Top Confusion**: PINK (2 errors)
- **Diagnosis**: Only 4 test samples, confused with PINK. Color terms have similar hand positions (tapping chin).
- **Difficulty**: medium
- **Remediation**: Collect 5-10 more samples from at least 3 signers. This is primarily a data quantity issue.

### SEVEN (F1: 33.3%)

- **Support**: 4 test samples
- **Precision**: 50.0% | **Recall**: 25.0%
- **Top Confusion**: FOUR (2 errors)
- **Diagnosis**: Only 4 test samples, confused with FOUR. Numbers 1-10 are single-hand gestures with subtle finger differences.
- **Difficulty**: hard
- **Remediation**: Collect 5-10 more samples from at least 3 signers. This is primarily a data quantity issue.

### APRIL (F1: 33.3%)

- **Support**: 4 test samples
- **Precision**: 50.0% | **Recall**: 25.0%
- **Top Confusion**: AUGUST (3 errors)
- **Diagnosis**: Only 4 test samples, 3 confused with AUGUST. Calendar terms have similar signing structure (first letter + motion).
- **Difficulty**: hard
- **Remediation**: Collect 5-10 more samples from at least 3 signers. This is primarily a data quantity issue.

### JANUARY (F1: 40.0%)

- **Support**: 4 test samples
- **Precision**: 100.0% | **Recall**: 25.0%
- **Top Confusion**: JULY (2 errors)
- **Diagnosis**: Only 4 test samples, confused with JULY. Both start with J-handshape.
- **Difficulty**: medium
- **Remediation**: Collect 5-10 more samples from at least 3 signers. This is primarily a data quantity issue.

### JULY (F1: 40.0%)

- **Support**: 4 test samples
- **Precision**: 33.3% | **Recall**: 50.0%
- **Top Confusion**: JUNE (2 errors)
- **Diagnosis**: Only 4 test samples, confused with JUNE. Both start with J-handshape near chin.
- **Difficulty**: medium
- **Remediation**: Collect 5-10 more samples from at least 3 signers. This is primarily a data quantity issue.

### FATHER (F1: 40.0%)

- **Support**: 4 test samples
- **Precision**: 100.0% | **Recall**: 25.0%
- **Top Confusion**: SIX (1 errors)
- **Diagnosis**: Only 4 test samples. Single confusion with SIX confirms low support, not actual similarity.
- **Difficulty**: easy
- **Remediation**: Collect 5-10 more samples from at least 3 signers. This is primarily a data quantity issue.

### MOTHER (F1: 40.0%)

- **Support**: 4 test samples
- **Precision**: 100.0% | **Recall**: 25.0%
- **Top Confusion**: TWO (1 errors)
- **Diagnosis**: Only 4 test samples. Single confusion with TWO confirms low support.
- **Difficulty**: easy
- **Remediation**: Collect 5-10 more samples from at least 3 signers. This is primarily a data quantity issue.

### FOUR (F1: 44.4%)

- **Support**: 4 test samples
- **Precision**: 40.0% | **Recall**: 50.0%
- **Top Confusion**: TWO (1 errors)
- **Diagnosis**: Only 4 test samples, confused with TWO. Both are one-hand number gestures.
- **Difficulty**: easy
- **Remediation**: Collect 5-10 more samples from at least 3 signers. This is primarily a data quantity issue.

### NINE (F1: 44.4%)

- **Support**: 4 test samples
- **Precision**: 40.0% | **Recall**: 50.0%
- **Top Confusion**: FOUR (1 errors)
- **Diagnosis**: Only 4 test samples, confused with FOUR. Number system confusion.
- **Difficulty**: easy
- **Remediation**: Collect 5-10 more samples from at least 3 signers. This is primarily a data quantity issue.

### BLUE (F1: 44.4%)

- **Support**: 4 test samples
- **Precision**: 40.0% | **Recall**: 50.0%
- **Top Confusion**: HELLO (1 errors)
- **Diagnosis**: Only 4 test samples, confused with HELLO. Very different gestures - suggests noise from low support.
- **Difficulty**: easy
- **Remediation**: Collect 5-10 more samples from at least 3 signers. This is primarily a data quantity issue.

## Ranked by Impact

| Rank | Label | F1 | Impact Score | Difficulty |
|:----:|-------|:-:|:----------:|:--------:|
| 1 | IM FINE | 0.0% | 1.609 | medium |
| 2 | RED | 28.6% | 1.150 | medium |
| 3 | SEVEN | 33.3% | 1.073 | hard |
| 4 | APRIL | 33.3% | 1.073 | hard |
| 5 | JANUARY | 40.0% | 0.966 | medium |
| 6 | JULY | 40.0% | 0.966 | medium |
| 7 | FATHER | 40.0% | 0.966 | easy |
| 8 | MOTHER | 40.0% | 0.966 | easy |
| 9 | FOUR | 44.4% | 0.894 | easy |
| 10 | NINE | 44.4% | 0.894 | easy |
| 11 | BLUE | 44.4% | 0.894 | easy |

## Recommended Actions

1. **Immediate (Phase 33)**: Collect 5+ samples each for IM FINE, RED, SEVEN, APRIL, JANUARY — these have the highest impact scores and lowest F1.
2. **Short-term**: Add FATHER, MOTHER, BLUE samples — these are easy fixes (low support, not real confusion).
3. **Medium-term**: Calendar and number confusion pairs need targeted augmentation.
4. **Ongoing**: Monitor all 133 labels; any label below 10 test samples risks unreliable F1 measurement.

## Expected Gain

If all 11 low-F1 labels receive 5+ new diverse samples each:
- Estimated macro F1 improvement: **+2 to 5 percentage points** (from 83.45% to ~85-88%)
- This alone brings F1 close to the 85% target threshold
