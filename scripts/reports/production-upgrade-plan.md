# Production Upgrade Decision — Phase 29H

## Current Production
| Metric | Value |
|--------|-------|
| Model | BiLSTM (v1) |
| Accuracy | 88.84% |
| Macro F1 | 83.45% |
| Parameters | ~134K |
| Inference | ~3–5ms |
| Format | TF.js (model.json + weights.bin) |

## Candidate Models

| Architecture | Est. Accuracy | Est. F1 | Params | Inference | Complexity |
|-------------|:------------:|:-------:|:------:|:---------:|:----------:|
| BiLSTM v2 (enhanced) | 91–93% | 87–90% | ~230K | 5–7ms | ★★ |
| CNN-BiLSTM | 90–92% | 86–89% | ~340K | 6–9ms | ★★★ |
| Attention BiLSTM | 91–93% | 87–90% | ~280K | 7–10ms | ★★★ |
| Transformer | 87–90% | 82–86% | ~520K | 12–20ms | ★★★★★ |

## Decision: BiLSTM v2 → Production

**Rationale:**
1. **Accuracy target**: BiLSTM v2 is the most likely to reach ≥93% accuracy with label smoothing + class weighting + cosine LR + augmented data.
2. **Inference budget**: Under 10ms requirement. Transformer exceeds budget at estimated 12–20ms.
3. **Proven architecture**: Same core as v1 — only hyperparameters and training strategy change. Minimal risk of regression.
4. **Export compatibility**: Same weight structure (lstmFwd, lstmBwd, wy, by) — export script needs no changes.
5. **Maintainability**: Single-file, no external dependencies, readable forward/backward pass.

## Rollout Sequence
```
Phase 29E: Train BiLSTM v2 (scripts/train-unified-bilstm-v2.mjs)
Phase 29G: Benchmark v2 vs v1 (scripts/benchmark-architectures.mjs)
Phase 29H: If v2 ≥ 93% accuracy + ≥ 90% F1 → ship to production
Phase 29H+: If not, train with augmented data (scripts/augment-unified-data.mjs) and retry
Phase 29F: Alternative architectures remain experimental for v3
```

## Acceptance Gates
| Gate | Requirement |
|------|------------|
| Test accuracy | ≥ 93% |
| Macro F1 | ≥ 90% |
| Inference time | ≤ 10ms (Node.js) |
| Per-class F1 | No class below 0.60 |
| Export | TF.js weights must be under 2MB |

## Risk Mitigation
- **Training divergence**: Label smoothing and gradient clipping prevent NaNs.
- **Overfitting**: Early stopping (patience=15) + dropout (0.25) + data augmentation.
- **Export failure**: Weight arrays are same shape and structure as v1 — export script maps directly.
