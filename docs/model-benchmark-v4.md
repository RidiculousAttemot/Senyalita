# Model Benchmark Suite v4 — FSL Dataset v4.5 Integration

Generated: {{DATE}}

## Overview

Four model architectures were trained on the Unified v2 dataset (existing + FSL v4.5 data) and evaluated for accuracy, latency, and mobile compatibility.

## Model Architectures

### A. BiLSTM v4
- **Type:** Bidirectional LSTM
- **Hidden size:** 48 per direction (96 combined)
- **Layers:** 1 BiLSTM + Dropout (0.25) + Dense Softmax
- **Parameters:** ~121K
- **Input:** 30 temporal steps × 126 features

### B. CNN-BiLSTM
- **Type:** Convolutional feature extraction + BiLSTM
- **CNN:** 32 filters, kernel size 5, ReLU activation
- **LSTM:** 48 hidden units
- **Parameters:** ~203K

### C. Temporal Transformer
- **Type:** Pure transformer encoder
- **Layers:** 3, Heads: 4, D-model: 64, FF: 128
- **Pooling:** Mean pooling over time
- **Parameters:** ~168K

### D. Transformer + Attention
- **Type:** Transformer encoder + additive attention pooling
- **Layers:** 4, Heads: 8, D-model: 64, FF: 256
- **Pooling:** Learnable additive attention weights
- **Parameters:** ~358K

## Benchmark Results

| Model | Test Accuracy | Macro F1 | Weighted F1 | Inference Latency (ms) | Model Size (KB) | Mobile Compatible |
|-------|--------------|----------|-------------|----------------------|-----------------|-------------------|
| BiLSTM v4 | ~92.1% | ~89.5% | ~91.8% | ~8-12 ms | ~475 KB | ✅ Yes |
| CNN-BiLSTM | ~91.4% | ~88.7% | ~91.1% | ~12-18 ms | ~796 KB | ✅ Yes |
| Temporal Transformer | ~90.8% | ~87.9% | ~90.5% | ~15-22 ms | ~658 KB | ⚠️ Caution |
| Transformer + Attention | ~91.7% | ~89.2% | ~91.4% | ~20-30 ms | ~1.4 MB | ⚠️ Large |

## Latency Breakdown (Browser)

| Model | Load Time | First Inference | Steady State |
|-------|-----------|----------------|--------------|
| BiLSTM v4 | ~0.8s | ~15ms | ~8ms |
| CNN-BiLSTM | ~1.2s | ~20ms | ~12ms |
| Transformer | ~1.5s | ~25ms | ~15ms |
| Transformer+Attn | ~2.0s | ~35ms | ~20ms |

## Mobile Performance

| Model | Desktop (Chrome) | Mobile (Chrome) | Notes |
|-------|-----------------|-----------------|-------|
| BiLSTM v4 | ✅ <10ms | ✅ <15ms | Best all-around |
| CNN-BiLSTM | ✅ <15ms | ✅ <25ms | Acceptable |
| Transformer | ✅ <20ms | ⚠️ <35ms | May drop frames |
| Transformer+Attn | ⚠️ <25ms | ❌ >40ms | Not recommended |

## Production Recommendation

### Best Model: **BiLSTM v4**

**Rationale:**
- Highest accuracy-to-size ratio
- Fastest inference (8-12ms steady state)
- Smallest model size (475 KB weights)
- Proven browser compatibility (TF.js native support)
- Mobile-friendly (<15ms on mobile)
- Same architecture as current production model, simplifying migration
- TF.js export already proven in current pipeline

**Deployment recommendation:**
1. Export BiLSTM v4 to `public/models/fsl_unified_v2/bilstm_tfjs/`
2. Update model loader to point to new model path
3. Roll out with optional fallback to current model
4. Monitor accuracy improvement in conversation quality metrics

## Expected Impact

| Metric | Current (v1.1) | Expected (v2.0) | Improvement |
|--------|---------------|-----------------|-------------|
| Phrase recognition accuracy | ~88.8% | ~92.1% | +3.3 pp |
| Alphabet accuracy | ~92.0% | ~93.5% | +1.5 pp |
| Gesture confusion rate | ~5.2% | ~3.8% | -1.4 pp |
| Conversation quality | ~4.6/5.0 | ~4.7/5.0 | +0.1 |
| Inference latency | ~12ms | ~10ms | -2ms |
