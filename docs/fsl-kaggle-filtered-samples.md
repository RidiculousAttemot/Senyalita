# FSL Kaggle Filtered Samples Report

Generated: 2026-06-07T00:09:17.695Z

## Validation rules

- `sequence.length === 120`
- Each frame has exactly `126` features
- No `NaN` or `Infinity`
- At least `6` non-zero values in the whole sequence (one real hand has 63)
- All values within `[-1.5, 1.5]`
- `label` ∈ [a-z], `labelId` ∈ [0-25]

## Headline

- Samples kept: **10865**
- Samples removed: 0
- Reasons:
  - `badShape`: 0
  - `nan`: 0
  - `allZero`: 0
  - `badLabel`: 0
  - `badValue`: 0

## Per-label

| Label | Original | Kept | Removed |
|-------|----------|------|---------|
| A | 397 | 397 | 0 |
| B | 447 | 447 | 0 |
| C | 381 | 381 | 0 |
| D | 443 | 443 | 0 |
| E | 430 | 430 | 0 |
| F | 450 | 450 | 0 |
| G | 448 | 448 | 0 |
| H | 450 | 450 | 0 |
| I | 447 | 447 | 0 |
| J | 446 | 446 | 0 |
| K | 447 | 447 | 0 |
| L | 430 | 430 | 0 |
| M | 337 | 337 | 0 |
| N | 354 | 354 | 0 |
| O | 326 | 326 | 0 |
| P | 432 | 432 | 0 |
| Q | 356 | 356 | 0 |
| R | 447 | 447 | 0 |
| S | 342 | 342 | 0 |
| T | 444 | 444 | 0 |
| U | 450 | 450 | 0 |
| V | 431 | 431 | 0 |
| W | 445 | 445 | 0 |
| X | 427 | 427 | 0 |
| Y | 440 | 440 | 0 |
| Z | 418 | 418 | 0 |

## Files

- Per-label samples (overwritten in place): `datasets/processed/fsl_kaggle_landmarks/samples_<a-z>.json`
- Raw report: `datasets/processed/fsl_kaggle_landmarks/validation.json`