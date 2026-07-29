import type { GestureAnimationAsset } from "../types";

export interface LoaderStats {
  cached: number;
  loaded: number;
  /** Genuinely not published: a 404. Expected, and handled by fingerspelling. */
  missed: number;
  /** Infrastructure failure: network error, 5xx, or malformed payload. */
  failed: number;
}

export class AnimationLoader {
  private cache: Map<string, GestureAnimationAsset> = new Map();
  private pending: Map<string, Promise<GestureAnimationAsset | null>> = new Map();
  private stats: LoaderStats = { cached: 0, loaded: 0, missed: 0, failed: 0 };

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

  /**
   * Returns null for "no asset available", which the caller turns into
   * fingerspelling. That is correct for a 404 and wrong for everything else,
   * so the other cases are logged rather than swallowed.
   *
   * The previous implementation wrapped the whole thing in a bare `catch {}`.
   * A network failure, a 503 and a genuine 404 all produced the same silent
   * null, which is the third place in this path where the reason a frame did
   * not animate was discarded.
   */
  private async fetchAsset(
    key: string,
  ): Promise<GestureAnimationAsset | null> {
    let response: Response;
    try {
      response = await fetch(`/api/animations/${encodeURIComponent(key)}`);
    } catch (error) {
      console.error(
        `[AnimationLoader] network error fetching "${key}":`,
        error instanceof Error ? error.message : error,
      );
      this.stats.failed++;
      return null;
    }

    if (response.ok) {
      try {
        return await response.json() as GestureAnimationAsset;
      } catch (error) {
        console.error(`[AnimationLoader] malformed JSON for "${key}":`, error);
        this.stats.failed++;
        return null;
      }
    }

    // 404 is the expected "not published yet" answer and stays quiet.
    if (response.status !== 404) {
      console.error(
        `[AnimationLoader] "${key}" lookup failed: HTTP ${response.status}` +
          ` (source=${response.headers.get("X-Animation-Source") ?? "unknown"},` +
          ` stage=${response.headers.get("X-Animation-Failure-Stage") ?? "unknown"}).` +
          " This is an infrastructure failure, not a missing animation.",
      );
      this.stats.failed++;
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
    this.stats = { cached: 0, loaded: 0, missed: 0, failed: 0 };
  }
}
