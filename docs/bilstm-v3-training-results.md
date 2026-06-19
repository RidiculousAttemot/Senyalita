# BiLSTM v3 Training Results

Generated: 2026-06-16

## Configuration

| Parameter | Value |
|-----------|-------|
| Hidden size | 48 |
| Attention size | 64 |
| Temporal steps | 35 |
| Epochs | 80 (early stopped at 63) |
| Learning rate | 0.002 (cosine decay) |
| Focal gamma | 2.0 |
| Label smoothing | 0.1 |
| Dropout | 0.25 |
| Balanced dataset | false |
| Hard samples | false |

## Architecture

| Feature | v1 | v3 |
|---------|:--:|:--:|
| Hidden size | 32 | 48 |
| Attention | — | Temporal (d=64) |
| Loss | CE | Focal (γ=2) + smoothing |
| LayerNorm | — | ✓ |
| GELU | — | Classifier input |
| Parameters | ~25K | ~86K |
| Inference time | ~13ms | ~57ms |

## Training Metrics

| Metric | Value |
|--------|:-----:|
| Train accuracy | 45.13% |
| Validation accuracy | 40.43% |
| Test accuracy | 39.38% |
| Macro F1 | 17.85% |
| Weighted F1 | 37.83% |

## Observations

1. **Loss increased during training** due to curriculum weight ramp-up (0.51 → 1.0).
2. **Training plateaued at ~45%** — the model did not converge to production-quality levels.
3. **Collapse occurred at epoch 58** where accuracy dropped from 28% to 12%, indicating numerical instability.
4. **High class imbalance** (up to 13.29× weight ratio) caused gradient instability for rare classes.

## Comparison with v1

| Metric | v1 | v3 |
|--------|:--:|:--:|
| Test accuracy | 88.84% | 39.38% |
| Macro F1 | 83.45% | 17.85% |
| Parameters | ~25K | ~86K |
| Inference | ~13ms | ~57ms |

## Issues Identified

- Focal loss with γ=2 + high class weights causes gradient explosion for rare classes
- LayerNorm + GELU may interact poorly with the high learning rate
- No balanced dataset or hard sample mining was used in this run
- The v3 architecture has 3.4× more parameters and 4.4× slower inference

## Recommendations

- Reduce focal gamma to 1.0-1.5
- Use sqrt-based class weighting instead of linear
- Lower learning rate to 0.001
- Add gradient clipping at the loss level
- Enable balanced dataset with on-the-fly augmentation
