# Dataset Quality Engine

## Overview

The Dataset Quality Engine automatically inspects every uploaded video sample before it enters the training pipeline. Samples are scored from 0–100 across six dimensions.

## Scoring Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Blur Score | 20% | Analyzes landmark variance per frame; low variance = blurred |
| Hand Presence | 25% | Checks ≥15 landmarks in ≥70% of frames |
| Lighting | 20% | Rejects very dark (<20%) or overexposed frames |
| Framing | 15% | Ensures hands are centered within 10-90% of frame bounds |
| Motion Blur | 10% | Flags excessive per-frame motion (>1.5 threshold) |
| Duplicates | 10% | Rejects recordings with >50% duplicate frames |

## Threshold

Default threshold: **60/100**

Samples below the threshold are automatically rejected with reasons.

## Usage

```typescript
const inspector = new DatasetQualityInspector();
const score = inspector.inspect(sample);
if (score.passed) {
  // approve sample
} else {
  // reject with score.reasons
}
```

## Implementation

`src/features/analytics/datasetQuality.ts` — pure TypeScript, no external dependencies.
