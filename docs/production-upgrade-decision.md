# Production Upgrade Decision

Generated: 2026-06-16

## Decision

**RETAIN** current production model (Unified BiLSTM v1).

## Rationale

BiLSTM v3 did not meet the minimum deployment criteria:

| Criterion | Target | v3 Result | v1 Current | Status |
|-----------|:------:|:---------:|:----------:|:------:|
| Accuracy ≥ 92% | 92.00% | 39.38% | 88.84% | ❌ |
| Macro F1 ≥ 88% | 88.00% | 17.85% | 83.45% | ❌ |
| Maintain real-time inference | <10ms | ~57ms | ~13ms | ❌ |

## v3 Issues

1. **Convergence failure**: Training plateaued at 45% train / 40% val accuracy
2. **Numerical instability**: Model collapsed at epoch 58
3. **Loss inflation**: Curriculum weight ramp-up from 0.51→1.0 caused loss to increase 5×
4. **Parameter bloat**: 3.48× more parameters with 4.39× slower inference
5. **No meaningful improvement**: v3 underperformed v1 by 49.46pp in accuracy

## Actions Taken

| Action | Status |
|--------|--------|
| Dataset audit | ✅ Complete |
| Temporal vs static experiment | ✅ Complete |
| Class balancing | ✅ Complete (but not used in training) |
| Hard sample mining | ✅ Complete (but not used in training) |
| v3 architecture training | ✅ Complete |
| Architecture benchmark | ✅ Complete |
| Model export | ❌ Skipped (v3 not qualified) |
| Loader update | ❌ Not needed |
| Model versions update | ❌ Not needed |

## Future Work

To make v3 viable:
1. Reduce focal gamma to 1.0-1.5
2. Use sqrt class weighting instead of linear (max weight ~3.6× instead of 13.29×)
3. Lower learning rate to 0.001
4. Enable on-the-fly balanced sampling
5. Reduce hidden size to 32 (match v1) before increasing

## Version Tag

**RELEASE v1.3.0 NOT triggered** — v3 did not qualify. Keeping v1 as production.
