# Model Comparison Dashboard

## Overview

The model comparison dashboard at `/admin/models` displays side-by-side metrics for all trained model versions, enabling informed decisions about production deployment and identifying performance regressions.

## Dashboard Sections

### 1. Current Runtime

| Field | Value |
|-------|-------|
| Status | Loaded / Failed / Not found |
| Classes | 133 |
| Architecture | BiLSTM |
| Runtime | TF.js WebGL |

### 2. Model Comparison Table

| Metric | BiLSTM v1 | BiLSTM v3 | [Future v1.1.0] |
|--------|:---------:|:---------:|:---------------:|
| **Status** | ✅ Active | Available | — |
| **Test Accuracy** | 88.84% | 39.38% | — |
| **Macro F1** | 83.45% | 17.85% | — |
| **Weighted F1** | 88.51% | — | — |
| **Test Loss** | 0.377 | — | — |
| **Parameters** | 24,773 | 86,115 | — |
| **Inference Time** | 12.95ms | 56.7ms | — |
| **Memory** | 97 KB | — | — |
| **Dataset Size** | 5,721 | — | — |
| **Deployment Date** | 2026-06-16 | — | — |
| **Active** | ✅ | — | — |

### 3. Key Metrics Definitions

| Metric | Definition | Target |
|--------|------------|--------|
| Accuracy | Correct predictions / total predictions | > 90% |
| Macro F1 | Unweighted average of per-class F1 scores | > 85% |
| Weighted F1 | Support-weighted average of per-class F1 | > 88% |
| Inference Time | End-to-end prediction latency | <= 12.95ms |
| Memory Footprint | Model size in KB | < 500 KB |
| Parameters | Learnable weight count | < 100K |

### 4. Deployment Status Indicators

| Status | Meaning | Action |
|--------|---------|--------|
| ✅ Active | Currently deployed and serving predictions | Monitor metrics |
| 🔄 Staged | Ready for A/B testing | Route 10% traffic |
| 📋 Available | Trained but not deployed | Compare metrics |
| ❌ Failed | Training or validation failure | Check logs |

### 5. Mobile Performance Metrics

| Metric | Desktop (WebGL) | Mobile (WebGL) | Mobile (CPU) |
|--------|:--------------:|:--------------:|:-----------:|
| Inference Time | 12.95ms | — | — |
| Memory Usage | 97 KB | — | — |
| GPU Required | Optional | — | — |
| FPS | ~77 | — | — |

## Implementation

The dashboard reads from:

- **`model_versions` table** — Version history, accuracy, dataset size
- **`getCachedResult()`** — Current runtime status
- **`models/*/bilstm/metrics.json`** — Per-model detailed metrics
- **`models/*/benchmark.json`** — Cross-architecture comparison data

## Maintenance

Add new models by:

1. Training and exporting the model to `models/<name>/`
2. Registering in `model_versions` via Supabase
3. Verifying metrics are populated in `metrics.json`
4. Dashboard auto-refreshes on page load

## Projected Targets

Based on Phase 33 data collection:

| Metric | Current (v1) | Target (v1.1.0) | Improvement Path |
|--------|:-----------:|:--------------:|-----------------|
| Test Accuracy | 88.84% | > 90% | +160 diverse samples for low-F1 labels |
| Macro F1 | 83.45% | > 85% | Targeted collection for 11 problem classes |
| Inference Time | 12.95ms | <= 12.95ms | Same architecture, no regression |
| Memory | 97 KB | < 150 KB | Same architecture |
