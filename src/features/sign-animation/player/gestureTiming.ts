import type { GestureAnimationAsset, GestureTimingConfig } from "../types";

export class GestureTimingOptimizer {
  private config: GestureTimingConfig;
  private complexityCache: Map<string, number> = new Map();

  constructor(config?: Partial<GestureTimingConfig>) {
    this.config = {
      baseSpeed: 1,
      adjustByComplexity: true,
      adjustByPunctuation: true,
      minDuration: 300,
      maxDuration: 2000,
      ...config,
    };
  }

  setConfig(config: Partial<GestureTimingConfig>): void {
    Object.assign(this.config, config);
  }

  getSpeedForGesture(asset: GestureAnimationAsset, context?: { previousPunctuation?: string }): number {
    if (!this.config.adjustByComplexity) return this.config.baseSpeed;

    const cacheKey = asset.label;
    const cached = this.complexityCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const frameCount = asset.totalFrames;
    const duration = asset.duration;
    const fps = asset.fps;

    const movementScore = this.computeMovementScore(asset);
    const frameScore = frameCount / 30;

    const complexity = (movementScore * 0.4 + frameScore * 0.3) / (duration / 1000);

    let speed = this.config.baseSpeed;

    if (complexity > 2) {
      speed = this.config.baseSpeed * 0.7;
    } else if (complexity > 1) {
      speed = this.config.baseSpeed * 0.85;
    } else if (complexity < 0.3) {
      speed = this.config.baseSpeed * 1.2;
    }

    if (this.config.adjustByPunctuation && context?.previousPunctuation) {
      if (context.previousPunctuation === "?" || context.previousPunctuation === "!") {
        speed *= 0.9;
      } else if (context.previousPunctuation === ".") {
        speed *= 1.1;
      } else if (context.previousPunctuation === ",") {
        speed *= 1.0;
      }
    }

    const effectiveDuration = duration / speed;
    if (effectiveDuration < this.config.minDuration) {
      speed = duration / this.config.minDuration;
    }
    if (effectiveDuration > this.config.maxDuration) {
      speed = duration / this.config.maxDuration;
    }

    speed = Math.max(0.1, Math.min(10, speed));
    this.complexityCache.set(cacheKey, speed);

    return speed;
  }

  getOptimalSpeed(assets: GestureAnimationAsset[]): number[] {
    return assets.map((a) => this.getSpeedForGesture(a));
  }

  computeMovementScore(asset: GestureAnimationAsset): number {
    if (asset.frames.length < 2) return 0;

    let totalMovement = 0;
    let frameCount = 0;

    for (let i = 1; i < asset.frames.length; i++) {
      const prev = asset.frames[i - 1];
      const curr = asset.frames[i];

      for (let h = 0; h < Math.min(prev.landmarks.length, curr.landmarks.length); h++) {
        const prevLms = prev.landmarks[h].landmarks;
        const currLms = curr.landmarks[h].landmarks;

        for (let j = 0; j < Math.min(prevLms.length, currLms.length); j++) {
          const dx = currLms[j].x - prevLms[j].x;
          const dy = currLms[j].y - prevLms[j].y;
          const dz = currLms[j].z - prevLms[j].z;
          totalMovement += Math.sqrt(dx * dx + dy * dy + dz * dz);
          frameCount++;
        }
      }
    }

    if (frameCount === 0) return 0;
    return totalMovement / frameCount;
  }

  clearCache(): void {
    this.complexityCache.clear();
  }
}
