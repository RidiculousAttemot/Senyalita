# Balanced Dataset Results

Generated: 2026-06-16

## Summary

| Metric | Original | Balanced |
|--------|----------|----------|
| Training samples | 4043 | 8432 |
| Validation samples | 0 (from train split) | 1264 |
| Test samples | 932 | 932 |
| Imbalance ratio | 7.14x | 22.59x |
| Synthetic samples added | — | 4389 |

## Focused Labels

| Label | Original | Balanced | Label ID |
|-------|----------|----------|----------|
| m | 88 | 352 | 12 |
| n | 88 | 352 | 13 |
| d | 96 | 384 | 3 |
| p | 84 | 336 | 15 |
| q | 88 | 352 | 16 |

## Method

- Oversampling with mild noise (\u03c3=0.005) + random scaling (0.9-1.1x)
- Target: 100 samples per alphabet class, 17 per FSL class
- Focused doubling for: m, n, d, p, q

## Output

```
C:\Arwin\Thesis\SignLangVisual\datasets\processed\fsl_unified_balanced/
  metadata.json
  labels.json
  report.json
  train_index.json  (7168 sample indices)
  val_index.json    (1264 sample indices)
```
