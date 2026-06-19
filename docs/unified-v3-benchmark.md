# Unified v3 Benchmark

Generated: Pending (run after v3 training completes)

## Comparison: Current Production vs v3 Candidate

| Metric | Current (v1) | v2 (if available) | v3 (candidate) | Delta (v3 - v1) |
|--------|:-----------:|:-----------------:|:--------------:|:----------------:|
| Test Accuracy | 88.84% | — | — | — |
| Macro F1 | 83.45% | — | — | — |
| Weighted F1 | 88.51% | — | — | — |
| Loss | 0.377 | — | — | — |
| Parameters | ~134K | ~230K | ~275K | +141K |
| Inference est. | ~5ms | ~7ms | ~8ms | +3ms |

## Architecture Differences

| Component | v1 | v2 | v3 |
|-----------|----|----|----|
| Hidden size | 32 | 48 | 48 |
| Temporal steps | 30 | 35 | 35 |
| Dropout | 0.20 | 0.25 | 0.25 |
| Attention | — | — | Temporal attn (d=64) |
| LayerNorm | — | — | After attention |
| Activation | tanh | tanh | tanh (LSTM) + GELU (classifier) |
| Loss | CE | CE + label smoothing | CE + focal loss (γ=2.0) + smoothing |
| LR schedule | constant | cosine decay | cosine decay |
| Class weights | — | inverse frequency | inverse frequency |
| Curriculum | — | linear 0.5→1.0 | linear 0.5→1.0 |
| Data | original | original + augmented | original + balanced + hard |

## Per-Class Breakdown

The v3 model targets the following per-class improvements:

| Class Group | v1 avg F1 | v3 target | Method |
|-------------|:---------:|:---------:|--------|
| Alphabet (a-z) | ~92% | ≥95% | Oversampling + balanced training |
| FSL Phrases (common) | ~85% | ≥90% | Focal loss + hard sample mining |
| FSL Phrases (rare) | ~72% | ≥80% | Class weighting + attention |

## Inference Benchmark

| Metric | Target | v1 measured | v3 expected |
|--------|:------:|:-----------:|:-----------:|
| Load time | <3s | ~1.8s | ~2.5s |
| Avg inference | <10ms | ~5ms | ~8ms |
| P95 inference | <20ms | ~10ms | ~15ms |
| FPS | ≥25 | ~30 | ~25 |
| Memory | <300MB | ~180MB | ~220MB |

## Decision Gate

Upgrade to production if ALL of:
- [ ] Test accuracy ≥ 92%
- [ ] Macro F1 ≥ 88%
- [ ] Inference ≤ 10ms average
- [ ] Load time ≤ 3s
- [ ] No regression on any class > 5%
