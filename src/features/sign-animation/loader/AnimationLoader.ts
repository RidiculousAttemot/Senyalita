import type { GestureAnimationAsset } from "../types";

export interface LoaderStats {
  cached: number;
  loaded: number;
  missed: number;
}

export class AnimationLoader {
  private cache: Map<string, GestureAnimationAsset> = new Map();
  private pending: Map<string, Promise<GestureAnimationAsset | null>> = new Map();
  private stats: LoaderStats = { cached: 0, loaded: 0, missed: 0 };

  async load(gestureLabel: string): Promise<GestureAnimationAsset | null> {
    const key = gestureLabel.toUpperCase().replace(/\s+/g, "_");

    const cached = this.cache.get(key);
    if (cached) {
      this.stats.cached++;
      return cached;
    }

    const pending = this.pending.get(key);
    if (pending) {
      this.stats.cached++;
      return pending;
    }

    const promise = this.fetchAsset(key);
    this.pending.set(key, promise);
    const asset = await promise;
    this.pending.delete(key);

    if (asset) {
      this.normalizeDuration(asset, key);
      this.cache.set(key, asset);
      this.stats.loaded++;
    } else {
      this.stats.missed++;
    }
    return asset;
  }

  private normalizeDuration(asset: GestureAnimationAsset, key: string): void {
    if (asset.fps > 0 && asset.totalFrames > 0) {
      const expectedMs = (asset.totalFrames / asset.fps) * 1000;
      const ratio = asset.duration / expectedMs;
      if (ratio > 0.001 && ratio < 0.01) {
        asset.duration = Math.round(asset.duration * 1000);
        console.warn(`[AnimationLoader] Normalized duration for ${key}: converted from seconds to ms (${asset.duration}ms)`);
      }
    }
  }

  private async fetchAsset(
    key: string,
  ): Promise<GestureAnimationAsset | null> {
    try {
      const publishedResponse = await fetch(`/api/animations/${encodeURIComponent(key)}`);
      if (publishedResponse.ok) {
        return await publishedResponse.json() as GestureAnimationAsset;
      }
    } catch {
    }
    return null;
  }

  preload(gestureLabels: string[]): void {
    for (const label of gestureLabels) {
      this.load(label);
    }
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getStats(): LoaderStats {
    return { ...this.stats };
  }

  clearCache(): void {
    this.cache.clear();
    this.pending.clear();
    this.stats = { cached: 0, loaded: 0, missed: 0 };
  }
}
