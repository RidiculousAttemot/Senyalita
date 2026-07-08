import type { GestureAnimationAsset, AnimationQualityMetrics } from "../types";

export class AnimationQualityEvaluator {
  evaluate(asset: GestureAnimationAsset): AnimationQualityMetrics {
    const frameCount = asset.totalFrames;
    const missingLandmarks = this.countMissingLandmarks(asset);
    const smoothness = this.computeSmoothness(asset);
    const transitionQuality = this.computeTransitionQuality(asset);
    const playbackDuration = asset.duration;
    const assetComplete = this.isAssetComplete(asset);

    const totalScore = Math.round(
      smoothness * 0.3 +
      (1 - missingLandmarks / Math.max(1, frameCount * 42)) * 0.2 +
      transitionQuality * 0.2 +
      (assetComplete ? 1 : 0) * 0.15 +
      Math.min(1, frameCount / 60) * 0.15
    );

    return {
      gesture: asset.label,
      smoothness: Math.round(smoothness * 100),
      frameCount,
      missingLandmarks,
      transitionQuality: Math.round(transitionQuality * 100),
      playbackDuration,
      assetComplete,
      totalScore: Math.round(totalScore * 100),
    };
  }

  evaluateAll(assets: GestureAnimationAsset[]): AnimationQualityMetrics[] {
    return assets.map((a) => this.evaluate(a));
  }

  private computeSmoothness(asset: GestureAnimationAsset): number {
    if (asset.frames.length < 3) return 0;

    let jitterScore = 0;
    let comparisons = 0;

    for (let i = 2; i < asset.frames.length; i++) {
      const f0 = asset.frames[i - 2];
      const f1 = asset.frames[i - 1];
      const f2 = asset.frames[i];

      for (let h = 0; h < Math.min(f0.landmarks.length, f2.landmarks.length); h++) {
        const lms0 = f0.landmarks[h].landmarks;
        const lms1 = f1.landmarks[h].landmarks;
        const lms2 = f2.landmarks[h].landmarks;

        for (let j = 0; j < Math.min(lms0.length, lms1.length, lms2.length); j++) {
          const dx0 = lms1[j].x - lms0[j].x;
          const dy0 = lms1[j].y - lms0[j].y;
          const dx1 = lms2[j].x - lms1[j].x;
          const dy1 = lms2[j].y - lms1[j].y;
          const angleDiff = Math.abs(Math.atan2(dy1, dx1) - Math.atan2(dy0, dx0));
          jitterScore += Math.min(1, angleDiff / Math.PI);
          comparisons++;
        }
      }
    }

    if (comparisons === 0) return 0.5;
    return 1 - (jitterScore / comparisons);
  }

  private countMissingLandmarks(asset: GestureAnimationAsset): number {
    let missing = 0;
    for (const frame of asset.frames) {
      for (const hand of frame.landmarks) {
        for (const lm of hand.landmarks) {
          if (lm.x === 0 && lm.y === 0 && lm.z === 0) {
            missing++;
          }
        }
      }
    }
    return missing;
  }

  private computeTransitionQuality(asset: GestureAnimationAsset): number {
    if (asset.frames.length < 2) return 0.5;

    let goodTransitions = 0;
    let total = 0;

    for (let i = 1; i < asset.frames.length; i++) {
      const prev = asset.frames[i - 1];
      const curr = asset.frames[i];
      const timeGap = curr.timestamp - prev.timestamp;
      const expectedGap = 1000 / asset.fps;

      if (Math.abs(timeGap - expectedGap) < expectedGap * 0.3) {
        goodTransitions++;
      }
      total++;
    }

    return total > 0 ? goodTransitions / total : 0.5;
  }

  private isAssetComplete(asset: GestureAnimationAsset): boolean {
    return (
      asset.frames.length > 0 &&
      asset.duration > 0 &&
      asset.fps > 0 &&
      asset.frames.every((f) => f.landmarks.length > 0)
    );
  }

  getGestureStats(metrics: AnimationQualityMetrics[]): {
    averageScore: number;
    best: AnimationQualityMetrics | null;
    worst: AnimationQualityMetrics | null;
    scoreDistribution: Record<string, number>;
  } {
    if (metrics.length === 0) {
      return { averageScore: 0, best: null, worst: null, scoreDistribution: {} };
    }

    const sorted = [...metrics].sort((a, b) => b.totalScore - a.totalScore);
    const averageScore = metrics.reduce((s, m) => s + m.totalScore, 0) / metrics.length;
    const distribution: Record<string, number> = { "0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0 };

    for (const m of metrics) {
      if (m.totalScore <= 25) distribution["0-25"]++;
      else if (m.totalScore <= 50) distribution["26-50"]++;
      else if (m.totalScore <= 75) distribution["51-75"]++;
      else distribution["76-100"]++;
    }

    return {
      averageScore: Math.round(averageScore),
      best: sorted[0] ?? null,
      worst: sorted[sorted.length - 1] ?? null,
      scoreDistribution: distribution,
    };
  }
}
