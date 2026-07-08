# Deployment Decision Record

**Updated:** 2026-06-28

## Current Production
- **Model:** fsl_unified/bilstm_v2 (BiLSTM v2)
- **Accuracy:** 98.15% test
- **Model URL:** /models/fsl_unified/bilstm_tfjs/

## Candidates Evaluated

| Candidate | Accuracy | Verdict | Reason |
|-----------|:--------:|:-------:|--------|
| Kaggle combined (Phase 43) | 95.63% | ❌ Reject | -2.52% below production |
| Hybrid temporal-augmented (Phase 42) | 96.03% | ❌ Reject | -2.12% below production |

## Policy
- Never deploy a model that is worse on the production test set.
- Benchmark comes first, deployment second.
- Track all candidates in `docs/model-benchmarks/`.

## Next Candidate
- Wait for higher-quality temporal alphabet data (multi-signer video, not static JPGs).
