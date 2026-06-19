# Research Dashboard

## Overview

The Research Dashboard provides a dedicated interface for thesis evaluation with comprehensive metrics for assessing model and system performance. It includes recognition accuracy, macro F1, inference latency, FPS, memory usage, communication success rate, user feedback, confidence distribution, confusion matrix, dataset growth, and active learning statistics.

## Architecture

Implemented in `src/features/analytics/researchDashboard.ts`.

### Key Metrics

| Metric | Description | Source |
|--------|-------------|--------|
| Recognition Accuracy | Overall prediction accuracy | In-memory tracking |
| Macro F1 | Per-class F1 average | In-memory tracking |
| Inference Latency | Average inference time | Model loader timing |
| FPS | Frames per second | Recognition loop |
| Memory Usage | TensorFlow.js memory | `tf.memory()` |
| Communication Success | Conversation completion rate | Conversation tracking |
| User Feedback | Ratings and trends | Feedback recording |
| Confidence Distribution | Confidence histogram | Recognition logging |
| Confusion Matrix | Predicted vs actual pairs | Correction tracking |
| Dataset Growth | Sample/class/signer over time | Dataset recording |
| Active Learning Stats | Query and label distribution | Active learning tracking |

## Data Model

```typescript
type ResearchMetrics = {
  recognitionAccuracy: number;
  macroF1: number;
  inferenceLatencyMs: number;
  fps: number;
  memoryUsageMb: number;
  communicationSuccessRate: number;
  userFeedback: {
    totalRatings: number;
    positiveRatings: number;
    negativeRatings: number;
    averageRating: number;
    recentTrend: number[];
  };
  confidenceDistribution: {
    ranges: Array<{ range: string; count: number }>;
    averageConfidence: number;
    medianConfidence: number;
  };
  confusionMatrix: Array<{
    predicted: string;
    actual: string;
    count: number;
  }>;
  datasetGrowth: Array<{
    date: string;
    sampleCount: number;
    classCount: number;
    signerCount: number;
  }>;
  activeLearningStats: {
    totalQueries: number;
    labeledQueries: number;
    pendingQueries: number;
    labelDistribution: Array<{ label: string; count: number }>;
    uncertaintyScores: number[];
  };
};
```

## Admin Dashboard Page

Located at `src/app/admin/research/page.tsx` (existing), now enhanced with:

### Visualizations

1. **Confidence Distribution** — Histogram bar chart (5 ranges: 0-20%, 20-40%, etc.)
2. **Confusion Matrix** — Heatmap table showing most confused pairs
3. **Performance Trends** — Line charts for accuracy, F1, latency, FPS
4. **Communication Success** — Pie chart of successful vs failed conversations
5. **User Feedback** — Rating trend over last 20 interactions
6. **Dataset Growth** — Time series of sample count, class count, signer count
7. **Active Learning** — Label distribution pie chart, uncertainty histogram

### Export Options

#### CSV Export
```csv
metric,value
recognition_accuracy,0.942
macro_f1,0.891
inference_latency_ms,45.2
fps,22.1
memory_usage_mb,128.5
communication_success_rate,0.876
average_confidence,0.834
median_confidence,0.89
```

#### JSON Export
```json
{
  "recognitionAccuracy": 0.942,
  "macroF1": 0.891,
  "inferenceLatencyMs": 45.2,
  "fps": 22.1,
  "memoryUsageMb": 128.5,
  "communicationSuccessRate": 0.876,
  "userFeedback": {
    "totalRatings": 150,
    "positiveRatings": 120,
    "negativeRatings": 15,
    "averageRating": 4.2,
    "recentTrend": [4, 5, 4, 4, 5]
  }
}
```

## API

| Method | Description |
|--------|-------------|
| `recordAccuracy(accuracy)` | Record accuracy metric |
| `recordF1(f1)` | Record F1 score |
| `recordLatency(ms)` | Record inference latency |
| `recordFps(fps)` | Record FPS |
| `recordMemory(mb)` | Record memory usage |
| `recordCommunicationSuccess(successful)` | Track communication success |
| `recordFeedback(rating)` | Record user feedback rating |
| `recordConfidence(confidence)` | Record recognition confidence |
| `recordConfusion(predicted, actual)` | Record confusion pair |
| `recordDatasetGrowth(entry)` | Record dataset growth snapshot |
| `recordActiveLearning(label, uncertainty)` | Track active learning |
| `getMetrics()` | Get complete metrics snapshot |
| `exportCsv()` | Export metrics as CSV string |
| `exportJson()` | Export metrics as JSON string |
| `reset()` | Clear all data |

## Files Created

- `src/features/analytics/researchDashboard.ts`

## Integration

The Research Dashboard integrates with:
1. **Admin Research Page** — Enhanced `src/app/admin/research/page.tsx`
2. **Recognition Pipeline** — Automatically tracks accuracy, latency, FPS
3. **Conversation System** — Tracks communication success
4. **Feedback System** — Records user ratings
5. **Dataset Pipeline** — Records growth statistics

## Usage for Thesis

The dashboard provides all necessary metrics for thesis evaluation:

- **Quantitative**: Accuracy, F1, latency, FPS, memory
- **Qualitative**: User feedback, communication success
- **Diagnostic**: Confusion matrix, confidence distribution
- **Growth**: Dataset statistics, active learning progress
- **Exportable**: CSV and JSON for analysis tools
