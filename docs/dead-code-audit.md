# Dead Code Elimination Audit

## Empty Feature Directories (Removed)

These directories contained only `.gitkeep` files and were never implemented:

| Directory | Status | LOC Removed |
|-----------|--------|-------------|
| `src/features/capture/` | Removed | 0 (empty) |
| `src/features/history/` | Removed | 0 (empty) |
| `src/features/landmarks/` | Removed | 0 (empty) |
| `src/features/reply/` | Removed | 0 (empty) |
| `src/features/speech/` | Removed | 0 (empty) |
| `src/features/translation/` | Removed | 0 (empty) |

## Dead Route (Removed)

| File | Reason | LOC |
|------|--------|-----|
| `src/app/\(routes\)/camera/page.tsx` | Redirect-only to /translate | 14 |

## Dead Code in History View

The `(routes)/history/history-view.tsx` component contains significant dead code paths:

| Code Path | Reason | LOC |
|-----------|--------|-----|
| `authenticated` branches | Public auth removed in Phase 27; `authenticated` prop is always `false` | ~200 |
| Cloud sync (Supabase) history fetching | Only works with authenticated users | ~100 |
| `deleteOwnSession` via server action | Only works when authenticated | ~15 |
| `createSupabaseBrowserClient` usage in history | Unused (admin-only auth doesn't apply here) | ~10 |
| `importLocalHistoryIfNeeded` references | Sync layer for authenticated users only | ~20 |

## Dead Static Classifier References

| File | Reason | LOC |
|------|--------|-----|
| `src/features/recognition/hybrid/static.ts` | Static model never deployed; gracefully degrades | ~60 |
| `src/features/recognition/hybrid/fusion.ts` | Fusion engine only works with static + temporal; static never available | ~80 |
| `src/features/recognition/hybrid/router.ts` | Routing logic for static vs temporal; static never available | ~50 |
| `src/features/recognition/hybrid/types.ts` | Types only used by fusion/router code | ~30 |

## Obsolete Script References

| package.json Script | Reason |
|---------------------|--------|
| `audit:roboflow` | Roboflow dataset unused |
| `extract:roboflow` | Roboflow dataset unused |
| `prep:roboflow:static` | Static model unused |
| `train:roboflow:mlp` | MLP model unused |
| `train:roboflow:llc` | LLC model unused |
| `benchmark:roboflow` | Benchmark unused |
| `export:unified:bilstm:tfjs` | Duplicated by v3 export |
| `train:fsl-alphabet:baseline` | Model unused |
| `train:fsl-alphabet:lstm` | Model unused |
| `train:fsl-alphabet:bilstm` | Model unused |
| `train:fsl-alphabet:cnn-lstm` | Model unused |
| `train:fsl-alphabet:bilstm:v2` | Model unused |
| `train:fsl-alphabet:bilstm-v3` | Model unused |
| `train:fsl-105:bilstm` | Model unused |
| `train:fsl-v45:bilstm-v4` | Dataset unused |
| `train:fsl-v45:cnn-bilstm` | Dataset unused |
| `train:fsl-v45:transformer` | Dataset unused |
| `train:fsl-v45:transformer-attention` | Dataset unused |
| `export:fsl-v45:tfjs` | Dataset unused |

## Total Impact

| Category | Files Removed | LOC Removed | Bundle Impact |
|----------|---------------|-------------|---------------|
| Empty feature dirs | 6 | 0 | None |
| Dead route | 1 | 14 | Minimal |
| History dead paths | 1 | ~345 | ~2KB gzipped |
| Static classifier | 4 | ~220 | ~3KB gzipped |
| Obsolete scripts (package.json) | 19 lines | N/A | None |
| **Total** | **12 files / dirs** | **~579 LOC** | **~5KB gzipped** |
