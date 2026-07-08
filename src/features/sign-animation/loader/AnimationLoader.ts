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
  private baseUrl: string;

  constructor(baseUrl = "/animations") {
    this.baseUrl = baseUrl;
  }

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

    const promise = this.fetchAsset(key, gestureLabel);
    this.pending.set(key, promise);
    const asset = await promise;
    this.pending.delete(key);

    if (asset) {
      this.cache.set(key, asset);
      this.stats.loaded++;
    } else {
      this.stats.missed++;
    }
    return asset;
  }

  private async fetchAsset(
    key: string,
    originalLabel: string,
  ): Promise<GestureAnimationAsset | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${key}.json`);
      if (!response.ok) return null;
      const asset: GestureAnimationAsset = await response.json();
      return asset;
    } catch {
      return null;
    }
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
