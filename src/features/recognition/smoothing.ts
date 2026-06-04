import { InferenceResult } from "./model";

const SMOOTHING_WINDOW = 10;

export class PredictionSmoother {
  private history: InferenceResult[] = [];

  reset(): void {
    this.history = [];
  }

  smooth(result: InferenceResult): InferenceResult {
    this.history.push(result);

    if (this.history.length > SMOOTHING_WINDOW) {
      this.history.shift();
    }

    if (this.history.length < SMOOTHING_WINDOW / 2) {
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
      .slice(0, 3)
      .map(([label]) => ({
        label,
        confidence: (labelCounts.get(label) ?? 0) / this.history.length
      }));

    return {
      label: bestLabel,
      labelId: result.labelId,
      confidence: totalConfidence / this.history.length,
      topK: smoothedTopK
    };
  }
}
