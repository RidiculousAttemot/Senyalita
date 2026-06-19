import { InferenceResult } from "./model";

const SMOOTHING_WINDOW = 5;
const HYSTERESIS_THRESHOLD = 0.10;
const TOPK_COUNT = 5;

export class PredictionSmoother {
  private history: InferenceResult[] = [];
  private lastStableLabel: string | null = null;
  private lastStableConfidence = 0;

  reset(): void {
    this.history = [];
    this.lastStableLabel = null;
    this.lastStableConfidence = 0;
  }

  smooth(result: InferenceResult): InferenceResult {
    this.history.push(result);

    if (this.history.length > SMOOTHING_WINDOW) {
      this.history.shift();
    }

    if (this.history.length < 2) {
      return result;
    }

    const labelCounts = new Map<string, number>();
    let totalConfidence = 0;

    for (const entry of this.history) {
      labelCounts.set(entry.label, (labelCounts.get(entry.label) ?? 0) + 1);
      totalConfidence += entry.confidence;
    }

    let bestLabel = result.label;
    let bestCount = 0;

    for (const [label, count] of labelCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestLabel = label;
      }
    }

    const avgConfidence = totalConfidence / this.history.length;

    if (
      this.lastStableLabel !== null &&
      bestLabel !== this.lastStableLabel
    ) {
      const labelAvg = labelCounts.get(bestLabel) ?? 0;
      const newConfidence = labelAvg / this.history.length;
      if (newConfidence < this.lastStableConfidence + HYSTERESIS_THRESHOLD) {
        bestLabel = this.lastStableLabel;
      }
    }

    this.lastStableLabel = bestLabel;
    this.lastStableConfidence = avgConfidence;

    const topKCounts = new Map<string, number>();
    for (const entry of this.history) {
      for (const suggestion of entry.topK) {
        topKCounts.set(
          suggestion.label,
          (topKCounts.get(suggestion.label) ?? 0) + 1
        );
      }
    }

    const smoothedTopK = Array.from(topKCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOPK_COUNT)
      .map(([label]) => ({
        label,
        confidence: (labelCounts.get(label) ?? 0) / this.history.length
      }));

    return {
      label: bestLabel,
      labelId: result.labelId,
      confidence: avgConfidence,
      topK: smoothedTopK
    };
  }
}
