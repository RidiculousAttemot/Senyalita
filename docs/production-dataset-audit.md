# Production Dataset Audit

Generated: 2026-06-16

## Summary

| Metric | Value |
|--------|:-----:|
| Total datasets | 2 |
| Total samples | 5481 |
| Total labels | 133 |
| Training samples | 4043 |
| Validation samples | 506 |
| Test samples | 932 |

## Dataset Sources

| Dataset | Samples | Labels | Temporal | Static | Duplicate% | Signers |
|---------|:-------:|:------:|:--------:|:------:|:----------:|:-------:|
| fsl_alphabet_v2 | 3352 | 26 | 100.0% | 0.0% | 1.8% | 6 |
| fsl_105 | 2129 | 105 | 100.0% | 0.0% | 0.2% | 105 |

## Class Imbalance

### fsl_alphabet_v2

| Label | Count |
|-------|:----:|
| a | 136 |
| b | 132 |
| c | 120 |
| d | 138 |
| e | 126 |
| f | 126 |
| g | 132 |
| h | 126 |
| i | 132 |
| j | 126 |
| k | 132 |
| l | 126 |
| m | 126 |
| n | 126 |
| o | 132 |
| p | 120 |
| q | 126 |
| r | 126 |
| s | 126 |
| t | 126 |
| u | 132 |
| v | 126 |
| w | 144 |
| x | 132 |
| y | 138 |
| z | 120 |

**Imbalance ratio**: 1.20x

### fsl_105

| Label | Count |
|-------|:----:|
| APRIL | 20 |
| AUGUST | 22 |
| AUNTIE | 20 |
| BEER | 20 |
| BLACK | 20 |
| BLIND | 20 |
| BLUE | 20 |
| BOY | 21 |
| BREAD | 20 |
| BROWN | 20 |
| CHICKEN | 20 |
| COFFEE | 20 |
| COLD | 21 |
| CORRECT | 22 |
| COUSIN | 21 |
| CRAB | 20 |
| DARK | 20 |
| DAUGHTER | 20 |
| DEAF | 21 |
| DEAF BLIND | 20 |
| DECEMBER | 22 |
| DON’T KNOW | 20 |
| DON’T UNDERSTAND | 21 |
| EGG | 20 |
| EIGHT | 20 |
| FAST | 21 |
| FATHER | 20 |
| FEBRUARY | 19 |
| FISH | 20 |
| FIVE | 20 |
| ... (75 more) | |

**Imbalance ratio**: 1.22x

## Sequence Statistics

| Dataset | Min Frames | Max Frames | Avg Frames | Sparsity |
|---------|:----------:|:----------:|:----------:|:--------:|
| fsl_alphabet_v2 | 19 | 298 | 92.8 | 27.0% |
| fsl_105 | 13 | 105 | 43.9 | 62.3% |

## Missing & Corrupted Data

**fsl_alphabet_v2**:
- Missing landmarks frames: 0
- Corrupted samples: 0
**fsl_105**:
- Missing landmarks frames: 0
- Corrupted samples: 0

## Model Performance

| Metric | Value | Target | Status |
|--------|:-----:|:------:|:------:|
| Test accuracy | 88.84% | ≥ 90% | ❌ |
| Macro F1 | 83.45% | ≥ 85% | ❌ |
| Train samples | 4043 | All used | ✅ |
| Val samples | 506 | All used | ✅ |
| Test samples | 932 | All used | ✅ |

## Quality Flags

- ⚠️ MODEL_F1_BELOW_TARGET: 83.45%

## Recommendations

- **[HIGH]** Class imbalance: Alphabet imbalance 1.20x, FSL 1.22x. Use weighted sampling.
- **[HIGH]** Signer diversity: Alphabet has 6 signers. Target 10+ for generalization.
- **[MEDIUM]** Dataset size: Total 5481 samples. Consider augmentation for rare classes.
- **[LOW]** Lighting variety: Alphabet has indoor-angled, indoor-varied, indoor-partial, outdoor-sim, indoor, low-light. FSL all studio.
- **[HIGH]** Model accuracy: F1 83.45% below 85% target. Address via dataset quality.
- **[HIGH]** Model accuracy: Accuracy 88.84% below 90% target.
