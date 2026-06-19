# Hard Sample Dataset Report

Generated: 2026-06-16

## Summary

- Total hard sample entries: 3390
- Unique confusion pairs: 40
- Unique hard labels: 51
- Weight range: 1.07–4

## Top Confusion Pairs

| True Label | Predicted | Confusions | Samples Available |
|------------|-----------|------------|------------------|
| v | u | 10 | 219 |
| m | n | 4 | 214 |
| u | r | 3 | 219 |
| IM FINE | HELLO | 3 | 40 |
| APRIL | AUGUST | 3 | 42 |
| r | u | 2 | 219 |
| x | t | 2 | 219 |
| z | u | 2 | 214 |
| GOOD EVENING | GOOD AFTERNOON | 2 | 43 |
| THREE | TWO | 2 | 40 |

## Worst Classes by F1

| Label | F1 | Error Rate | Hard Samples |
|-------|----|------------|-------------|
| IM FINE | 0.0% | 100.0% | 40 |
| RED | 28.6% | 75.0% | 20 |
| SEVEN | 33.3% | 75.0% | 63 |
| APRIL | 33.3% | 75.0% | 20 |
| JANUARY | 40.0% | 75.0% | 40 |
| JULY | 40.0% | 50.0% | 63 |
| FATHER | 40.0% | 75.0% | 0 |
| MOTHER | 40.0% | 75.0% | 0 |
| FOUR | 44.4% | 50.0% | 80 |
| NINE | 44.4% | 50.0% | 60 |

## Usage

The hard sample index can be used for:
1. **Weighted sampling**: Higher weight = more frequent sampling
2. **Curriculum**: Inject after epoch 10-15
3. **Focused fine-tuning**: Train only on hard samples

## Output

```
C:\Arwin\Thesis\SignLangVisual\datasets\hard_samples/
  metadata.json
  hard_index.json (3390 entries)
```
