# Phase 34 — Production Pilot Deployment + Real-World Dataset Expansion

## Dual-Track Strategy

Phase 34 combines two parallel tracks:

- **Track A**: Pilot deployment with real users to collect baseline data
- **Track B**: Targeted difficult gesture collection campaigns

## Track A — Production Pilot Deployment

### Timeline: 4 Weeks

#### Week 1 — Infrastructure Activation
- [x] Apply Phase 33 database migration (0032)
- [x] Enable diversity metadata capture in recognition flow
- [x] Create collection API endpoint (`POST /api/collection`)
- [x] Create signer registration endpoint (`POST /api/signers/register`)
- [x] Build `/admin/collection` dashboard
- [x] Add review queue badge to admin nav

#### Week 2 — Pilot Recruitment
- [ ] Register 10+ signer profiles
- [ ] Onboard pilot users with study consent
- [ ] Verify diversity metadata capture is working

#### Week 3 — Data Collection
- [ ] Collect 200+ real-world predictions
- [ ] Monitor review queue ingestion
- [ ] Track daily performance metrics

#### Week 4 — Analysis
- [ ] Run signer diversity analysis (`node scripts/analyze-signer-diversity.mjs`)
- [ ] Run longitudinal performance report (`node scripts/monitor-longitudinal-performance.mjs`)
- [ ] Identify remaining data gaps

## Track B — Dataset Expansion

### Timeline: 6 Weeks (parallel with Track A)

| Weeks | Campaigns | Target Samples | Target Confusion Pairs |
|-------|-----------|:-------------:|:----------------------:|
| 1-2 | IM FINE, V, U | 60 | HELLO, V ↔ U |
| 3-4 | M, N, D | 60 | M ↔ N, D ↔ P |
| 5-6 | P, Q, remaining low-F1 | 60+ | P ↔ D, Q ↔ G |

### Collection Protocol

Each campaign session records:
1. Signer metadata (handedness, experience, age range)
2. Environment metadata (lighting, camera angle, background)
3. 3+ recordings per gesture per environment
4. Landmark sequences extracted via MediaPipe

### Campaign Execution

```bash
# Execute a campaign: collects targeted samples for a label
node scripts/execute-campaign.mjs --campaign IM_FINE --signer-id pilot_01 --samples 5

# Export collected campaign data for training
node scripts/export-campaign-data.mjs --output datasets/real_world/collected
```

## Deliverables

| Deliverable | Track | Owner | Due |
|-------------|-------|-------|-----|
| Migration applied | A | System | Week 1 |
| Diversity capture enabled | A | System | Week 1 |
| Collection dashboard | A | System | Week 1 |
| 10+ signer profiles | A | Admin | Week 2 |
| 200+ predictions logged | A | Users | Week 3 |
| 100+ approved training samples | A | Admin | Week 4 |
| 160+ campaign samples | B | System | Week 6 |
| Dataset version 1.1.0 | A+B | System | Week 6 |
| Incremental retrain | A+B | System | Week 7 |
| Production promotion decision | A+B | Admin | Week 8 |

## Decision Gate (Week 8)

### Go Criteria (all must pass)
- Accuracy > 90%
- Macro F1 > 85%
- Runtime <= 12.95ms
- Mobile performance unchanged

### If Go → Phase 35: Widespread Deployment
### If No-Go → Phase 34B: Extended Collection

## Quick Start

```bash
# 1. Apply migration
node scripts/db-apply.mjs --file supabase/migrations/0032_phase33_data_pipeline.sql

# 2. Start development server
npm run dev

# 3. Access admin panel
# Open /admin/collection to monitor progress
# Open /admin/review to approve/reject items

# 4. Collect data
# Run campaigns via scripts/execute-campaign.mjs

# 5. Monitor
node scripts/analyze-signer-diversity.mjs --days 7
node scripts/monitor-longitudinal-performance.mjs --days 7
```
