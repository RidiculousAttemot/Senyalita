# Runtime Validation v3 — Phase 30H

Generated: Pending (run after v3 export to TF.js)

## Target Requirements

| Metric | Target | Priority |
|--------|:------:|:--------:|
| Model load time | <3 seconds | Critical |
| Average inference | <10ms | Critical |
| P95 inference | <20ms | High |
| P99 inference | <50ms | Medium |
| FPS (real-time) | ≥30 FPS | Critical |
| Memory (heap) | <300MB | High |
| GPU memory | <500MB | Medium |

## Measurement Method

Use the existing runtime benchmark infrastructure:

```bash
# Headless mode (Node.js estimate)
node scripts/runtime-benchmark.mjs --mode=headless

# Puppeteer mode (requires running app)
BENCHMARK_URL=http://localhost:3000 node scripts/runtime-benchmark.mjs --mode=puppeteer
```

## v3 Model Size Estimate

| Component | v1 | v2 | v3 |
|-----------|----|----|----|
| LSTM weights | ~124K | ~230K | ~230K |
| Attention weights | — | — | ~13K |
| LayerNorm | — | — | ~0.1K |
| Classifier | ~10K | ~13K | ~13K |
| **Total params** | **~134K** | **~243K** | **~256K** |
| Model file (JSON) | ~4MB | ~7MB | ~8MB |
| Weights binary | ~0.5MB | ~0.9MB | ~1.0MB |
| Total TF.js size | ~4.5MB | ~7.9MB | ~9.0MB |

## Expected vs Actual

| Metric | Expected | Actual (fill after run) | Status |
|--------|:--------:|:-----------------------:|:------:|
| Load time | ~2.5s | — | — |
| Avg inference | ~8ms | — | — |
| P95 inference | ~15ms | — | — |
| FPS | ~28 | — | — |
| Memory | ~220MB | — | — |

## Bottleneck Analysis

1. **Model load**: TF.js parses model topology JSON + downloads weights binary
   - v1: 0.5MB weights → ~1.8s load
   - v3: 1.0MB weights → ~2.5s estimated
   - Mitigation: Cache in IndexedDB after first load

2. **Inference**: Forward pass = LSTM × 2 + attention + classifier
   - LSTM: O(T × H²) where T=35, H=48
   - Attention: O(T × COMBINED_SIZE × ATTN_SIZE) = O(35 × 96 × 64)
   - Classifier: O(COMBINED_SIZE × 133)
   - Total: ~350K FLOPs per inference

3. **Memory**: 3 main tensors
   - Input: 35 × 126 float32 = ~17KB
   - LSTM states: 2 × 48 float32 × 35 steps = ~13KB
   - Attention: 35 scores + 96-dim context = ~0.5KB
   - Total working memory: <100KB (negligible)

## Validation Checklist

- [ ] Load time < 3s
- [ ] Avg inference < 10ms
- [ ] FPS ≥ 25 (acceptable) / ≥ 30 (target)
- [ ] No memory leaks over 5-minute continuous run
- [ ] Mobile browser (Chrome Android) compatibility
- [ ] Desktop browser (Chrome, Firefox, Safari) compatibility
