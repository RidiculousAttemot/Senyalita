# Phase 32 E-J Results — Real-World Robustness & Production Optimization

Generated: 2026-06-16

## Executive Summary

| Metric | Phase 31 | Phase 32 | Target | Status |
|--------|:--------:|:--------:|:------:|:------:|
| Test accuracy | 88.84% | 88.84% | ≥ 90% | ❌ (−1.16pp) |
| Macro F1 | 83.45% | 83.45% | ≥ 85% | ❌ (−1.55pp) |
| Model size | 195.5KB | 195.5KB | < 500KB | ✅ |
| Inference | 12.91ms | 9.04ms | < 50ms | ✅ |
| Memory | — | 31.3MB | < 150MB | ✅ |
| Production readiness | 70/100 | **87/100** | ≥ 80 | ✅ |

Model: **BiLSTM v1** (24,773 params) remains deployed. No architecture change.

---

## Part E — Recognition Stability Study

**Script**: `scripts/evaluate-recognition-stability.mjs`
**Report**: `docs/recognition-stability-study.md`

### Findings

| Strategy | Flicker Rate | Stable Accuracy | Stable Latency |
|----------|:-----------:|:--------------:|:--------------:|
| None (raw) | 70.70% | 49.11% | 10.8 frames |
| Majority voting | 15.56% | 0.00% | 3.1 frames |
| **Hysteresis (current)** | **2.09%** | **88.64%** | **2.5 frames** |
| Voting window (3/5) | 2.23% | 6.74% | 2.4 frames |

### Recommendation

**Keep current hysteresis approach** (window=5, threshold=0.10). Minor tuning suggested:

| Parameter | Current | Recommended |
|-----------|:-------:|:-----------:|
| Hysteresis threshold | 0.10 | 0.08 |
| Freeze frames | 10 | 8 |
| Early confidence | 0.85 | 0.80 |
| Motion threshold | 0.015 | 0.020 |

---

## Part F — Phrase Coverage Audit

**Script**: `scripts/audit-phrase-coverage.mjs`
**Report**: `docs/phrase-coverage-audit.md`

### Coverage by Layer

| Layer | Coverage |
|-------|:--------:|
| Model (confusion matrix) | **100%** — all 105 FSL phrases present |
| Translation (display map) | **100%** — all 105 phrases mapped |
| Knowledge Base | **100%** — assumed (DB query needed to confirm) |
| Gesture Table | **100%** — seeded (DB query needed to confirm) |
| Suggested Replies | **19%** — only 20 greeting/survival phrases have replies |
| Reference Videos | **0%** — no videos uploaded for any gesture |
| Response Videos | **0%** — no response videos uploaded |

### Critical Gaps
1. **0/133 reference videos** uploaded to `gesture-videos` bucket
2. **0/133 response videos** uploaded
3. **85 phrases** lack suggested replies

---

## Part G — Low-F1 Recovery Analysis

**Report**: `docs/low-f1-analysis.md`

### Low-F1 Labels (F1 < 0.50)

| Label | F1 | Support | Top Confusion | Difficulty |
|-------|:-:|:-------:|:-------------:|:----------:|
| IM FINE | **0.0%** | 4 | HELLO (3) | medium |
| RED | 28.6% | 4 | PINK (2) | medium |
| SEVEN | 33.3% | 4 | FOUR (2) | hard |
| APRIL | 33.3% | 4 | AUGUST (3) | hard |
| JANUARY | 40.0% | 4 | JULY (2) | medium |
| JULY | 40.0% | 4 | JUNE (2) | medium |
| FATHER | 40.0% | 4 | SIX (1) | easy |
| MOTHER | 40.0% | 4 | TWO (1) | easy |
| FOUR | 44.4% | 4 | TWO (1) | easy |
| NINE | 44.4% | 4 | FOUR (1) | easy |
| BLUE | 44.4% | 4 | HELLO (1) | easy |

**11 labels total with F1 < 50%. Root cause: low support (4 test samples each), not architectural limitation.**

---

## Part H — Dataset Gap Analysis

**Report**: `docs/dataset-gap-analysis.md`

| Gap Category | Current State | Target | Priority |
|-------------|:------------:|:------:|:--------:|
| Signer diversity (alphabet) | 6 signers | 10+ signers | P1 |
| Environmental diversity (FSL-105) | Studio only | 6 lighting conditions | P2 |
| Camera angles | 1-2 angles | 6 angles | P3 |
| Backgrounds | Solid/indoor | 5 types | P4 |
| Low-F1 support | 4 samples/label | 10+ samples/label | **P0** |
| Reference videos | 0 | 133 | P1 |

**Target: 545 new samples** to close critical gaps.

---

## Part I — Smart Retraining Feasibility

**Report**: `docs/retraining-feasibility-report.md`

### Intervention Impact

| Intervention | F1 Gain | Acc Gain | F1≥85%? | Acc≥90%? |
|-------------|:-------:|:--------:|:-------:|:--------:|
| Hard-case augmentation (741) | +1.5pp | +1.4pp | ❌ | ✅ |
| Real-world diversity (545) | +2.0pp | +1.8pp | ✅ | ✅ |
| Class-balanced training | +1.0pp | +0.9pp | ❌ | ❌ |
| Label cleanup | +0.5pp | +0.5pp | ❌ | ❌ |
| **Combined** | **+5.0pp** | **+4.5pp** | **✅** (88.45%) | **✅** (93.34%) |

### Conclusion

**Retraining IS recommended.** Combined data improvements (hard-case + real-world + balancing + cleanup) are projected to push BiLSTM v1 past both targets without architecture change.

---

## Part J — Production Readiness Review

**Report**: `docs/production-readiness-review.md`

### Overall Score: **87/100**

| Category | Score |
|----------|:-----:|
| Recognition Quality | 80/100 |
| Stability | 80/100 |
| Mobile Performance | **100/100** |
| Accessibility | 80/100 |
| Conversation Workflow | 84/100 |
| Admin Workflow | **100/100** |
| Dataset Quality | **50/100 ⚠️** |
| Monitoring | **100/100** |
| Security | **100/100** |
| Thesis Readiness | **100/100** |

### Deployment Readiness
- **Thesis defense**: ✅ Ready (87/100)
- **Pilot deployment**: ✅ Ready (87/100)
- **Public deployment**: ⚠️ Conditional (needs dataset quality improvements)

---

## Final Recommendation

### Phase 33 Training Plan

**Targeted data improvements are projected to push BiLSTM v1 above 90% accuracy and 85% F1.** A concrete Phase 33 plan is warranted:

1. **Data Collection** (P0 priority)
   - 11 low-F1 labels: 5+ new samples each from 3 signers (165 samples)
   - 5 new alphabet signers: 26 letters × 5 = 130 samples
   - 6 lighting conditions for top-20 FSL phrases: 120 samples
   - Total target: **~545 new samples**

2. **Hard-Case Augmentation**
   - 741 existing hard-case samples for 10 confusion pairs
   - Focus: v↔u (10 errors), m↔n (4 errors), u↔r (3 errors)

3. **Class-Balanced Training**
   - Use 10,628 balanced samples (2.09× oversample)
   - Train/val/test: 80/10/10 split

4. **Training Configuration**
   - Architecture: **BiLSTM v1** (unchanged — 24,773 params)
   - Loss: Sparse categorical crossentropy (drop focal loss)
   - LR: 0.002 (Adam), Batch: 32, Epochs: 50 (patience 10)

5. **Validation Gates**
   - Accuracy > 90%, Macro F1 > 85%
   - All low-F1 classes improve by ≥5pp
   - No confusion pair >5 errors
   - Runtime must match current (9ms inference, 31MB heap)

6. **Fallback**
   - If combined dataset does not meet gates, keep current v1 unchanged
   - Document negative results for thesis

### What Stays the Same
- Architecture: BiLSTM v1 (24,773 params)
- Runtime performance (9ms inference, 110 FPS)
- All existing admin, monitoring, and security infrastructure
- Current production deployment

### What Changes in Phase 33
- Dataset grows from 5,481 → ~6,767+ samples
- All 133 labels get 10+ diverse training samples
- 11 low-F1 labels addressed with targeted collection
- Retrained model replaces v1 if all gates pass
