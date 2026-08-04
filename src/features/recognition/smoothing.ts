import { InferenceResult } from "./model";

const SMOOTHING_WINDOW = 5;
const HYSTERESIS_THRESHOLD = 0.10;
const TOPK_COUNT = 5;

export class PredictionSmoother {
  private history: InferenceResult[] = [];
  private lastStableLabel: string | null = null;

  reset(): void {
    this.history = [];
    this.lastStableLabel = null;
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
      // Both sides are vote shares of the same window.
      //
      // This compared a vote ratio against a stored `lastStableConfidence`,
      // which held `avgConfidence` — a model probability. Different units, so
      // the threshold scaled with how confident the incumbent had been rather
      // than how much of the vote it held. With an incumbent at 0.95 the
      // challenger needed a vote share above 1.05, which cannot exist: the
      // label locked until something reset the smoother.
      //
      // Intent is unchanged — a challenger must lead by HYSTERESIS_THRESHOLD
      // to take over — but now it is reachable: leading 4-1 in a 5-frame
      // window is a 0.6 margin, comfortably clear of 0.10.
      const challengerShare = (labelCounts.get(bestLabel) ?? 0) / this.history.length;
      const incumbentShare = (labelCounts.get(this.lastStableLabel) ?? 0) / this.history.length;
      if (challengerShare < incumbentShare + HYSTERESIS_THRESHOLD) {
        bestLabel = this.lastStableLabel;
      }
    }

    this.lastStableLabel = bestLabel;

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
