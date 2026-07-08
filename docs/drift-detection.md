# Drift Detection System

## Overview

Monitors production recognition metrics over time and notifies administrators when performance declines. Detects six types of drift.

## Drift Types

| Metric | Warning | Critical |
|--------|---------|----------|
| Accuracy | >10% drop | >20% drop |
| Avg Confidence | >10% drop | >20% drop |
| Gesture Distribution | >10% shift | >20% shift |
| Lighting | >10% change | info only |
| Camera Angle | >10% change | info only |
| Low-Confidence Rate | >10% increase | >20% increase |

## Architecture

- `DriftDetector` class maintains daily snapshots
- Baseline is set from initial production data
- New snapshots are compared against baseline
- Alerts are generated with severity levels
- Dashboard displays active alerts at `/admin/active-learning`

## Snapshot Format

```typescript
interface DriftSnapshot {
  timestamp: string;
  accuracy: number;
  avgConfidence: number;
  gestureDistribution: Record<string, number>;
  avgLighting: number;
  avgCameraAngle: number;
  lowConfidenceRate: number;
  predictionCount: number;
}
```

## Implementation

`src/features/analytics/driftDetection.ts`
