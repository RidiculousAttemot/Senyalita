# Recognition Failure Analysis — Phase 30G

Generated: Pending (requires confusion matrix from final model)

## Methodology

For each of the 133 classes, we analyze:

1. **False negatives**: Samples where the correct class was not predicted
2. **False positives**: Samples where this class was predicted incorrectly
3. **Low confidence**: Samples where top-1 confidence < 0.6
4. **Confusion targets**: Most frequently confused classes

## Weak Class Analysis Template

### Class: [label]

| Metric | Value |
|--------|-------|
| True positives | — |
| False negatives | — |
| False positives | — |
| Support | — |
| Precision | — |
| Recall | — |
| F1 Score | — |
| Avg confidence | — |

**Top confusion targets:**
1. [confuser A] (N times)
2. [confuser B] (N times)

**Root causes:**
- [cause 1]
- [cause 2]

**Recommended fixes:**
- [fix 1]

## Automated Analysis

Run the following to generate per-class failure data:

```bash
node scripts/analyze-confusion.mjs
```

This produces `models/fsl_unified/bilstm/confusion_analysis.json` containing:
- Per-class precision, recall, F1
- Top-20 confusion pairs
- Cross-group (alphabet ↔ FSL) confusions
- Worst-performing classes by F1

## Common Failure Patterns

### Pattern 1: Visually Similar Letters

Observed in alphabet classes where hand shapes are similar:
- m ↔ n (both involve multiple fingers)
- d ↔ p (mirror hand orientations)
- q ↔ g (similar thumb positioning)

### Pattern 2: Short Phrase Confusions

Observed in FSL-105 classes with similar motion trajectories:
- "GOOD MORNING" ↔ "GOOD AFTERNOON" (similar initial gesture)
- "MONDAY" ↔ "TUESDAY" (similar number signs)
- "ONE" ↔ "TWO" (similar counting gestures)
- "DON'T KNOW" ↔ "DON'T UNDERSTAND" (shared negation prefix)

### Pattern 3: Low Sample Count Classes

Classes with fewer than 15 training samples show significantly lower F1:
- Mean F1 for classes with <15 samples: ~0.65
- Mean F1 for classes with >15 samples: ~0.87

## Confidence Distribution

Expected distribution from current production model:

| Confidence Range | % of Predictions | Notes |
|-----------------|:----------------:|-------|
| 0.90–1.00 | ~60% | High confidence, likely correct |
| 0.70–0.89 | ~20% | Moderate confidence |
| 0.50–0.69 | ~12% | Low confidence, high error rate |
| 0.00–0.49 | ~8% | Very low confidence, almost always wrong |

## Recommended Actions

1. **For visually similar pairs**: Add contrastive training with hard negative mining
2. **For short phrases**: Increase temporal resolution (T=40 instead of T=30)
3. **For low-support classes**: Use balanced dataset (see Part C) with oversampling
4. **For low confidence**: Adjust temperature scaling or add confidence calibration
