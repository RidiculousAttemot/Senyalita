# Smart Retraining Feasibility Report

Generated: 2026-06-16

## Current Baseline

| Metric | Value | Target | Gap |
|--------|:-----:|:------:|:---:|
| Test accuracy | 88.84% | 90% | 1.16pp |
| Macro F1 | 83.45% | 85% | 1.55pp |
| Test loss | 0.3770 | - | - |
| Weighted F1 | 88.51% | - | - |
| Dataset size | 968 | - | - |
| Classes | 133 | - | - |
| Avg support per class | 7.3 | - | - |
| Classes with <5 test samples | 99 | 0 | 99 |

## Intervention Impact Estimates

| Intervention | F1 Gain | Target F1 | Acc Gain | Target Acc | F1≥85% | Acc≥90% |
|-------------|:-------:|:---------:|:--------:|:----------:|:------:|:-------:|
| Hard-case augmentation (741 samples) | +1.5pp | 84.95% | +1.4pp | 90.19% | ❌ | ✅ |
| Real-world diversity samples (545 new) | +2.0pp | 85.45% | +1.8pp | 90.64% | ✅ | ✅ |
| Class-balanced training (2.09x oversample) | +1.0pp | 84.45% | +0.9pp | 89.74% | ❌ | ❌ |
| Label cleanup & noise reduction | +0.5pp | 83.95% | +0.5pp | 89.29% | ❌ | ❌ |
| Combined: all interventions | +5.0pp | 88.45% | +4.5pp | 93.34% | ✅ | ✅ |

## Detailed Analysis

### 1. Hard-Case Augmentation (741 samples)
- **Effect**: Targets the 40 identified confusion pairs
- **Biggest win**: Fixing v↔u (10 errors) improves 2 classes simultaneously
- **Expected**: +1.5pp F1, +1.3pp accuracy
- **Confidence**: Medium — augmented samples may not represent real confusion modes

### 2. Real-World Diversity (545 new samples)
- **Effect**: Adds environmental, lighting, and signer diversity
- **Biggest win**: Improves generalization for 11 low-F1 classes
- **Expected**: +2.0pp F1, +1.8pp accuracy
- **Confidence**: High — diversity directly addresses overfitting

### 3. Class-Balanced Training
- **Effect**: Uses existing 10,628 balanced samples (2.09x oversample)
- **Expected**: +1.0pp F1, +0.9pp accuracy
- **Confidence**: Medium — depends on oversampling quality

### 4. Label Cleanup
- **Effect**: Remove mislabeled samples, fix annotation inconsistencies
- **Expected**: +0.5pp F1, +0.5pp accuracy
- **Confidence**: Low — unknown current noise level

### 5. Combined
- **Expected**: +5.0pp F1 (→ 88.45%), +4.5pp accuracy (→ 93.34%)
- **F1 target met**: ✅ Yes
- **Accuracy target met**: ✅ Yes

## Conclusion

**Retraining is recommended**

Combined data improvements could push the model to 88.45% F1 and 93.34% accuracy, meeting or exceeding both targets. This assumes all 4 interventions are executed together with the existing BiLSTM v1 architecture.

### Phase 33 Recommendation

## Phase 33 Training Plan

1. **Data Preparation**
   - Merge production (5,481) + hard-case (741) + real-world (545 target) = ~6,767 total
   - Apply class-balanced sampling
   - Train/val/test split: 80/10/10

2. **Training Configuration**
   - Architecture: BiLSTM v1 (unchanged — 24,773 params)
   - Epochs: 50 (early stopping at patience 10)
   - Learning rate: 0.002 (Adam)
   - Batch size: 32
   - Loss: Sparse categorical crossentropy (drop focal loss)

3. **Validation Gates**
   - Accuracy > 90%
   - Macro F1 > 85%
   - All low-F1 classes improve by at least 5pp
   - Confusion matrix: no single pair >5 errors

4. **Deployment**
   - Export to TFJS
   - Runtime must match current (9ms inference, 30MB heap)
   - Full regression test suite

