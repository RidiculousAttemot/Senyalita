# Safe Retraining Workflow

## Overview

A controlled, multi-stage retraining pipeline that never replaces production automatically. Every deployment requires administrator approval and supports rollback.

## Stages

```
Production
    ↓
Candidate (new model trained)
    ↓
Validation (automated tests)
    ↓
Benchmark (compare vs production)
    ↓
Approval (admin reviews metrics)
    ↓
Deployment (manual go-ahead)
```

## Stage Details

### Production
The current deployed model (Unified BiLSTM v2, 98.15%).

### Candidate
A new model trained on updated data. Marked as candidate for evaluation.

### Validation
Automated tests run: accuracy, F1, latency, memory. Must meet minimum thresholds.

### Benchmark
Side-by-side comparison with production on held-out test set.

### Approval
Admin reviews benchmark results. Must explicitly approve or reject.

### Deployment
Only after approval. Previous production model is preserved for rollback.

## Rollback

- One-click rollback to any previous production version
- Deployment history is fully logged
- Rollback restores the previous model without data loss

## Implementation

`src/features/analytics/retrainingManager.ts`

Key methods:
- `addCandidate()` — register a new model
- `promoteToValidation/Benchmark/Approval()` — advance stages
- `approveForDeployment()` — admin approval
- `deploy()` — safe deployment
- `rollback()` — return to previous model
- `rejectCandidate()` — discard with reason
