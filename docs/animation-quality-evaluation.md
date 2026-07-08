# Animation Quality Evaluation

## Overview

The quality evaluation system assesses every gesture animation asset across 7 metrics and provides actionable scores for the admin dashboard.

## Metrics

| Metric | Weight | Description |
|--------|--------|-------------|
| Smoothness | 30% | Angular jitter between consecutive frames. Lower jitter = higher score. |
| Landmark Completeness | 20% | Ratio of non-zero landmarks. Missing zeros reduce score. |
| Transition Quality | 20% | Timestamp consistency against expected FPS intervals. |
| Asset Completeness | 15% | Whether the asset has frames, duration, and non-empty landmark data. |
| Frame Count Adequacy | 15% | Whether the asset has enough frames (target: ≥60 frames at 30fps for 2s). |

## Scoring

Each metric is scored 0-100. Total = weighted average:

```
Total = Smoothness × 0.30
      + Landmarks × 0.20
      + Transition × 0.20
      + Complete × 0.15
      + FrameCount × 0.15
```

### Score Tiers
| Range | Rating | Color |
|-------|--------|-------|
| 80-100 | Excellent | Green |
| 60-79 | Good | Yellow |
| 40-59 | Needs Work | Orange |
| 0-39 | Poor | Red |

## Admin Dashboard

Available at `/admin/animation-quality`:

- Sortable table with all 7 metrics per gesture
- Search/filter by gesture name
- Color-coded scores
- Score distribution histogram (0-25, 26-50, 51-75, 76-100)
- Average score and smoothness overview

## CLI Evaluation

```bash
node scripts/evaluate-animation-quality.mjs
```

Measures:
- Average FPS (target: ≥60)
- Dropped frames (target: 0%)
- Interpolation accuracy (target: ≥95%)
- Playback latency (target: <10ms)
- Transition smoothness (target: ≥80%)
- Renderer memory (target: <50MB)
