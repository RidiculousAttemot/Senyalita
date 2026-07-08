# Hybrid Model vs Production — Benchmark

**Generated:** 2026-06-28
**Source:** Phase 42 Part B

## Models

| Aspect | Production (bilstm_v2) | Hybrid (bilstm_v2_hybrid) |
|--------|:---------------------:|:------------------------:|
| Alphabet data | fsl_alphabet_v2 (557) | fsl_alphabet_v2 (557) + temporally-augmented Kaggle (1,300) |
| Phrase data | fsl_105 (2,129) | fsl_105 (2,129) |
| Alphabet weight | 1x | 3x |
| Augmented weight | — | 1x |
| Total train | ~2,686 | 4,737 (8,735 effective) |

## Results

| Metric | Production | Hybrid | Change |
|--------|:----------:|:------:|:------:|
| **Test Accuracy** | **98.15%** | **96.03%** | **-2.12%** |
| Test Macro F1 | 98.14% | 93.36% | -4.78% |
| Test Weighted F1 | 98.13% | 95.94% | -2.19% |
| Train Accuracy | ~98% | 99.94% | +1.94% |
| Val Accuracy | ~94% | 96.04% | +2.04% |

## Verdict

| Criterion | Pass? |
|-----------|-------|
| Accuracy > production? | ❌ (−2.12%) |
| F1 > production? | ❌ (−4.78%) |
| Generalization improved? | ❌ (overfits) |

The Kaggle dataset does not improve the unified model, even with temporal augmentation and 3x weighting for original data. The static JPG→landmark pipeline produces data that lacks the temporal dynamics of real signing, and synthetic augmentation cannot fully compensate.
