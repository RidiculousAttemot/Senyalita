# Difficult Gesture Collection Campaign

## Motivation

Based on the low-F1 analysis (`docs/low-f1-analysis.md`), 11 of 133 labels have F1 below 0.50. The primary root cause is **insufficient data support** (only 4 test samples each) rather than model architecture limitations.

This campaign defines targeted collection plans for 8 difficult gesture classes identified as needing immediate attention.

## Target Labels

| Label | Current F1 | Support | Difficulty | Priority |
|-------|:---------:|:-------:|:----------:|:-------:|
| IM FINE | 0.0% | 4 | medium | P0 |
| V | — | 4 | hard | P1 |
| U | — | 4 | hard | P1 |
| M | — | 4 | hard | P1 |
| N | — | 4 | hard | P1 |
| D | — | 4 | medium | P2 |
| P | — | 4 | medium | P2 |
| Q | — | 4 | medium | P2 |

> Note: Alphabet labels (V, U, M, N, D, P, Q) are tracked in the low-F1 analysis as potential issues due to low support. The remaining 3 labels (RED, SEVEN, APRIL, JANUARY, JULY, FATHER, MOTHER, FOUR, NINE, BLUE) were already covered in Phase 32 hard sample mining but are included here for cross-reference.

## Campaign Structure

Each campaign (in `datasets/real_world/campaigns/`) defines:

| Field | Description |
|-------|-------------|
| `target_samples` | Number of samples needed per label |
| `target_signers` | Minimum distinct signers |
| `target_environments` | Recording environments |
| `signing_variations` | Speed/emphasis variations |
| `collection_strategy` | Specific collection protocol |
| `confusion_pairs` | Co-collect with confusing labels |

## Collection Protocol

### Signer Requirements

- Minimum **5 distinct signers** per label
- Mix of native, fluent, and learner signers
- Right and left-handed signers
- Multiple age ranges (18-30, 31-50)

### Environment Requirements

| Environment | Lighting | Background |
|-------------|----------|------------|
| Home | Moderate | Variable |
| Office | Bright | Plain |
| Classroom | Bright | Cluttered |

### Recording Requirements

- Minimum 3 recordings per environment per signer
- Each recording: 2-3 repetitions of the gesture
- Frame rate: 30fps minimum
- Resolution: 640x480 minimum
- Camera angle: front-facing (primary), side-angle (supplementary)

## Success Criteria

| Metric | Target |
|--------|--------|
| Minimum samples per label | 15 |
| Minimum signers per label | 3 |
| Minimum environments per label | 2 |
| Expected F1 after retraining (IM FINE) | > 70% |
| Expected F1 after retraining (alphabet) | > 75% |
| Expected macro F1 improvement | +2 to 5 pp |

## Timeline

| Phase | Duration | Activities |
|-------|----------|------------|
| Planning | Week 1 | Finalize protocols, recruit signers |
| Collection | Weeks 2-4 | Capture sessions, validate quality |
| Processing | Week 5 | Extract landmarks, validate consistency |
| Integration | Week 6 | Merge into training dataset, retrain |
