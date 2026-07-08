import type { GestureAnimationAsset, AnimationClip } from "../types";
import { AnimationLoader } from "../loader/AnimationLoader";

export class PerformanceOptimizer {
  private assetPool: Map<string, GestureAnimationAsset> = new Map();
  private loader: AnimationLoader;
  private prefetchedLabels: Set<string> = new Set();
  private frameTimestamps: number[] = [];
  private droppedFrames = 0;
  private totalFrames = 0;
  private renderMemory = 0;

  constructor(loader?: AnimationLoader) {
    this.loader = loader ?? new AnimationLoader();
  }

  async prefetchAssets(labels: string[]): Promise<void> {
    const toFetch = labels.filter((l) => !this.prefetchedLabels.has(l));
    if (toFetch.length === 0) return;

    const promises = toFetch.map(async (label) => {
      const asset = await this.loader.load(label);
      if (asset) {
        this.assetPool.set(label, asset);
        this.prefetchedLabels.add(label);
        this.renderMemory += this.estimateAssetMemory(asset);
      }
    });

    await Promise.all(promises);
  }

  getPooledClip(label: string, createId: () => string): AnimationClip | null {
    const asset = this.assetPool.get(label);
    if (!asset) return null;
    return {
      id: createId(),
      gesture: label,
      asset,
    };
  }

  clearPool(): void {
    this.assetPool.clear();
    this.prefetchedLabels.clear();
    this.renderMemory = 0;
  }

  recordFrame(timestamp: number): void {
    this.totalFrames++;
    this.frameTimestamps.push(timestamp);
    if (this.frameTimestamps.length > 120) {
      this.frameTimestamps.shift();
    }
  }

  recordDroppedFrame(): void {
    this.droppedFrames++;
    this.totalFrames++;
  }

  getAverageFPS(): number {
    if (this.frameTimestamps.length < 2) return 0;
    const duration = this.frameTimestamps[this.frameTimestamps.length - 1] -
      this.frameTimestamps[0];
    if (duration <= 0) return 0;
    return ((this.frameTimestamps.length - 1) / duration) * 1000;
  }

  getDroppedFrameRate(): number {
    if (this.totalFrames === 0) return 0;
    return this.droppedFrames / this.totalFrames;
  }

  getRenderMemoryEstimate(): number {
    return this.renderMemory;
  }

  private estimateAssetMemory(asset: GestureAnimationAsset): number {
    let bytes = 0;
    for (const frame of asset.frames) {
      for (const hand of frame.landmarks) {
        bytes += hand.landmarks.length * 3 * 8;
      }
    }
    return bytes;
  }

  getPoolSize(): number {
    return this.assetPool.size;
  }

  reset(): void {
    this.frameTimestamps = [];
    this.droppedFrames = 0;
    this.totalFrames = 0;
  }
}
