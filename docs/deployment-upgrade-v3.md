# Deployment Upgrade Decision — Phase 30I

Generated: Pending (evaluate after v3 training)

## Decision Criteria

Upgrade from current production (fsl_unified/bilstm) → v3 if ALL conditions met:

| # | Condition | Metric | Threshold | Current | Status |
|---|-----------|--------|:---------:|:-------:|:------:|
| 1 | Accuracy gain | Test accuracy | ≥ +3% (≥ 91.84%) | 88.84% | Pending |
| 2 | F1 gain | Macro F1 | ≥ +4.5% (≥ 87.95%) | 83.45% | Pending |
| 3 | Latency maintained | Avg inference | ≤ 10ms | ~5ms | Pending |
| 4 | Load time | Model load | ≤ 3s | ~1.8s | Pending |
| 5 | No regression | Worst-class F1 | ≥ 0.50 | ~0.40 | Pending |

## Upgrade Path

### If APPROVED:

```bash
# 1. Export v3 to TF.js format
# (requires export script update for v3 attention weights)
node scripts/export-unified-bilstm-v3-tfjs.mjs

# 2. Backup current production model
Copy models/fsl_unified/bilstm/ → models/fsl_unified/bilstm_archive/

# 3. Deploy new model
Copy models/fsl_unified_v3/tfjs/ → public/models/fsl_unified/bilstm_tfjs/

# 4. Update loader.ts
Update MODEL_URL to point to new model
Verify labels.json format compatibility

# 5. Tag release
git tag v1.3.0
git push origin v1.3.0
```

### If REJECTED:

Document reasons below and retain current model.

## Decision Log

| Date | Decision | Reason | Signed Off |
|------|----------|--------|:----------:|
| — | Pending | Waiting for v3 training results | — |

## Rollback Plan

If the new model causes issues in production:
1. Revert `loader.ts` MODEL_URL to previous path
2. Restore `public/models/fsl_unified/bilstm_tfjs/` from archive
3. Tag as `v1.3.0-rollback`
4. Investigate root cause before redeploying
