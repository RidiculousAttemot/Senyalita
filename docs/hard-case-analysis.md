# Hard Case Analysis

Generated: 2026-06-16

## Objective

Identify systematic misclassifications and build targeted training subsets for the most confused label pairs.

## Worst Classes by F1 Score

| Label | Precision | Recall | F1 | Errors | Support |
|-------|:---------:|:------:|:--:|:------:|:-------:|
| IM FINE | 0.0% | 0.0% | 0.0% | 4 | 4 |
| RED | 33.3% | 25.0% | 28.6% | 3 | 4 |
| SEVEN | 50.0% | 25.0% | 33.3% | 3 | 4 |
| APRIL | 50.0% | 25.0% | 33.3% | 3 | 4 |
| JANUARY | 100.0% | 25.0% | 40.0% | 3 | 4 |

## Top 10 Confusion Pairs (Overall)

| True Label | Predicted | Count |
|------------|-----------|:-----:|
| v | u | 10 |
| m | n | 4 |
| u | r | 3 |
| IM FINE | HELLO | 3 |
| APRIL | AUGUST | 3 |
| r | u | 2 |
| x | t | 2 |
| z | u | 2 |
| GOOD EVENING | GOOD AFTERNOON | 2 |
| THREE | TWO | 2 |

## Alphabet Confusion Pairs (m, n, d, p, q)

| True Label | Predicted | Count |
|------------|-----------|:-----:|
| v | u | 10 |
| m | n | 4 |
| u | r | 3 |
| r | u | 2 |
| x | t | 2 |
| z | u | 2 |
| d | z | 1 |
| j | i | 1 |
| m | s | 1 |
| t | m | 1 |

## Phrase Confusion Pairs

| True Label | Predicted | Count |
|------------|-----------|:-----:|
| IM FINE | HELLO | 3 |
| GOOD EVENING | GOOD AFTERNOON | 2 |
| IM FINE | BLUE | 1 |
| NICE TO MEET YOU | FRIDAY | 1 |
| NICE TO MEET YOU | BREAD | 1 |
| YOURE WELCOME | TODAY | 1 |
| HARD OF HEARING | GIRL | 1 |

## Low-Confidence Phrases

The following phrases have the highest misclassification rates:

- **IM FINE**: 100.0% error rate (4 errors out of 4 samples)
- **GOOD EVENING**: 40.0% error rate (2 errors out of 5 samples)
- **NICE TO MEET YOU**: 40.0% error rate (2 errors out of 5 samples)
- **YOURE WELCOME**: 25.0% error rate (1 errors out of 4 samples)
- **HARD OF HEARING**: 25.0% error rate (1 errors out of 4 samples)
- **GOOD AFTERNOON**: 0.0% error rate (0 errors out of 4 samples)
- **DEAF BLIND**: 0.0% error rate (0 errors out of 4 samples)
- **NO SUGAR**: 0.0% error rate (0 errors out of 4 samples)
- **GOOD MORNING**: 0.0% error rate (0 errors out of 4 samples)
- **HOW ARE YOU**: 0.0% error rate (0 errors out of 4 samples)

## Targeted Hard Case Subset

Created: `datasets/hard_cases/`

Contains focused training subsets for the most problematic pairs:
- m ↔ n
- n ↔ m
- d ↔ p
- p ↔ d
- p ↔ q
- q ↔ p
- v ↔ u
- u ↔ r
- GOOD EVENING ↔ GOOD AFTERNOON
- IM FINE ↔ HELLO

741 total hard case samples collected.

## Methodology

1. Extract confusion matrix from deployed v1 model
2. Rank pairs by confusion count
3. Identify top alphabet confusions (m↔n, d↔p, p↔q)
4. Identify top phrase confusions (similar greetings, low-confidence signs)
5. Collect all available samples for these label pairs
6. Store in `datasets/hard_cases/` for targeted fine-tuning
