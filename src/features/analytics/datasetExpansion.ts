export interface GestureSampleNeed {
  gesture: string;
  recommendedSamples: number;
  priority: number;
  reasons: Array<{
    factor: string;
    severity: number;
    description: string;
  }>;
}

export interface GestureMetrics {
  gesture: string;
  falsePositives: number;
  falseNegatives: number;
  f1Score: number;
  avgConfidence: number;
  correctionCount: number;
  totalPredictions: number;
  currentSamples: number;
  targetSamples: number;
  sampleGap: number;
}

const DEFAULT_TARGET_SAMPLES = 200;
const MIN_SAMPLES_PER_GESTURE = 50;

export class DatasetExpansionEngine {
  private gestureMetrics: Map<string, GestureMetrics> = new Map();

  updateGesture(metrics: GestureMetrics): void {
    this.gestureMetrics.set(metrics.gesture, metrics);
  }

  updateBatch(metricsList: GestureMetrics[]): void {
    for (const m of metricsList) this.updateGesture(m);
  }

  getRecommendations(maxResults = 20): GestureSampleNeed[] {
    const needs: GestureSampleNeed[] = [];

    for (const [gesture, metrics] of this.gestureMetrics) {
      const reasons: GestureSampleNeed["reasons"] = [];
      let totalPriority = 0;

      if (metrics.sampleGap > 0) {
        const severity = Math.min(metrics.sampleGap / DEFAULT_TARGET_SAMPLES, 1);
        reasons.push({
          factor: "sample_gap",
          severity,
          description: `Needs ${metrics.sampleGap} more samples (${metrics.currentSamples}/${metrics.targetSamples})`,
        });
        totalPriority += severity * 0.3;
      }

      if (metrics.f1Score < 0.8 && metrics.totalPredictions > 0) {
        const severity = (1 - metrics.f1Score);
        reasons.push({
          factor: "low_f1",
          severity,
          description: `F1 score is ${(metrics.f1Score * 100).toFixed(0)}% — below 80% threshold`,
        });
        totalPriority += severity * 0.25;
      }

      if (metrics.avgConfidence < 0.7 && metrics.totalPredictions > 0) {
        const severity = (0.7 - metrics.avgConfidence) / 0.7;
        reasons.push({
          factor: "low_confidence",
          severity,
          description: `Average confidence is ${(metrics.avgConfidence * 100).toFixed(0)}%`,
        });
        totalPriority += severity * 0.2;
      }

      if (metrics.correctionCount > 0) {
        const correctionRate = metrics.totalPredictions > 0 ? metrics.correctionCount / metrics.totalPredictions : 0;
        if (correctionRate > 0.1) {
          const severity = Math.min(correctionRate, 1);
          reasons.push({
            factor: "high_correction_rate",
            severity,
            description: `${metrics.correctionCount} corrections in ${metrics.totalPredictions} predictions (${(correctionRate * 100).toFixed(0)}%)`,
          });
          totalPriority += severity * 0.25;
        }
      }

      if (reasons.length > 0) {
        const recommendedSamples = Math.max(
          MIN_SAMPLES_PER_GESTURE - metrics.currentSamples,
          Math.ceil(metrics.sampleGap * Math.min(1, totalPriority * 2)),
        );

        needs.push({
          gesture,
          recommendedSamples: Math.max(0, recommendedSamples),
          priority: Math.round(totalPriority * 100) / 100,
          reasons,
        });
      }
    }

    return needs
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxResults);
  }

  getUnderrepresentedGestures(threshold = 30): GestureMetrics[] {
    return [...this.gestureMetrics.values()]
      .filter((m) => m.currentSamples < threshold)
      .sort((a, b) => a.currentSamples - b.currentSamples);
  }

  getGestureMetrics(gesture: string): GestureMetrics | undefined {
    return this.gestureMetrics.get(gesture);
  }

  getAllMetrics(): GestureMetrics[] {
    return [...this.gestureMetrics.values()];
  }

  clear(): void {
    this.gestureMetrics.clear();
  }
}

export const globalDatasetExpansion = new DatasetExpansionEngine();
