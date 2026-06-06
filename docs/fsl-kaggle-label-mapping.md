# FSL Kaggle Dataset Label Mapping

**Generated:** 2026-06-06T14:38:23.545Z

## Label Coverage Summary

| Metric | Value |
|--------|-------|
| Expected FSL Labels | 28 |
| Kaggle Labels Found | 26 |
| Matched Labels | 26 |
| Missing Labels | 2 |
| Coverage | 92.86% |
| Total Kaggle Samples | 11700 |

## Label Mapping Details

### Matched Labels ✓

| Label | Kaggle Count | Custom Count | Total |
|-------|--------------|--------------|-------|
| a     |          450 |            0 | 450 |
| b     |          450 |            1 | 451 |
| c     |          450 |            2 | 452 |
| d     |          450 |            3 | 453 |
| e     |          450 |            4 | 454 |
| f     |          450 |            5 | 455 |
| g     |          450 |            6 | 456 |
| h     |          450 |            7 | 457 |
| i     |          450 |            8 | 458 |
| j     |          450 |            9 | 459 |
| k     |          450 |           10 | 460 |
| l     |          450 |           11 | 461 |
| m     |          450 |           12 | 462 |
| n     |          450 |           13 | 463 |
| o     |          450 |           16 | 466 |
| p     |          450 |           17 | 467 |
| q     |          450 |           18 | 468 |
| r     |          450 |           19 | 469 |
| s     |          450 |           20 | 470 |
| t     |          450 |           21 | 471 |
| u     |          450 |           22 | 472 |
| v     |          450 |           23 | 473 |
| w     |          450 |           24 | 474 |
| x     |          450 |           25 | 475 |
| y     |          450 |           26 | 476 |
| z     |          450 |           27 | 477 |

### Missing Labels ⚠️

These FSL alphabet labels are not present in the Kaggle dataset:

- **ñ** (Available in custom: 14)
- **ng** (Available in custom: 15)

## Label Distribution Comparison

Showing samples per label for combined dataset (Kaggle + Custom).

| Label | Kaggle | Custom | Total | Distribution |
|-------|--------|--------|-------|---------------|
| a     |    450 |      0 |   450 | █████████████████████████████ |
| b     |    450 |      1 |   451 | █████████████████████████████ |
| c     |    450 |      2 |   452 | █████████████████████████████ |
| d     |    450 |      3 |   453 | █████████████████████████████ |
| e     |    450 |      4 |   454 | █████████████████████████████ |
| f     |    450 |      5 |   455 | █████████████████████████████ |
| g     |    450 |      6 |   456 | █████████████████████████████ |
| h     |    450 |      7 |   457 | █████████████████████████████ |
| i     |    450 |      8 |   458 | █████████████████████████████ |
| j     |    450 |      9 |   459 | █████████████████████████████ |
| k     |    450 |     10 |   460 | █████████████████████████████ |
| l     |    450 |     11 |   461 | █████████████████████████████ |
| m     |    450 |     12 |   462 | ██████████████████████████████ |
| n     |    450 |     13 |   463 | ██████████████████████████████ |
| ñ     |      0 |     14 |    14 | █ |
| ng    |      0 |     15 |    15 | █ |
| o     |    450 |     16 |   466 | ██████████████████████████████ |
| p     |    450 |     17 |   467 | ██████████████████████████████ |
| q     |    450 |     18 |   468 | ██████████████████████████████ |
| r     |    450 |     19 |   469 | ██████████████████████████████ |
| s     |    450 |     20 |   470 | ██████████████████████████████ |
| t     |    450 |     21 |   471 | ██████████████████████████████ |
| u     |    450 |     22 |   472 | ██████████████████████████████ |
| v     |    450 |     23 |   473 | ██████████████████████████████ |
| w     |    450 |     24 |   474 | ██████████████████████████████ |
| x     |    450 |     25 |   475 | ██████████████████████████████ |
| y     |    450 |     26 |   476 | ██████████████████████████████ |
| z     |    450 |     27 |   477 | ██████████████████████████████ |

## Mapping Status

⚠️ **Missing FSL labels:**
- Count: 2/28
- Labels: ñ, ng

**Recommendation:** These missing labels can be filled from the custom SignLangVisual dataset during merge.

## Recommendations

1. **Label Mapping:** Use 1:1 mapping between Kaggle labels and FSL alphabet
2. **Missing Labels:** Will be supplemented from custom dataset
3. **Data Augmentation:** Kaggle data is already augmented (multiple crops per sign)
4. **Class Balance:** After merge, perform stratified sampling to balance classes
5. **Validation:** Ensure merged dataset maintains label distribution during split

## Next Steps

1. Run: `npm run merge:fsl-datasets`
2. Run: `npm run validate:dataset`
3. Run: `npm run train:fsl-alphabet:bilstm-v3`
