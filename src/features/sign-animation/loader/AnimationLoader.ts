import type { GestureAnimationAsset } from "../types";

/**
 * Concurrent requests allowed while warming the cache.
 *
 * Four, not one: browsers open ~6 connections per origin, so a slightly
 * smaller pool keeps the warm-up from monopolising them while still finishing
 * the alphabet promptly. Anything the user actually asks for goes through
 * load() directly and is never queued behind this.
 */
const PRELOAD_CONCURRENCY = 4;

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

  /**
   * Warms the cache without stampeding.
   *
   * This was a bare unawaited loop, so every label dispatched at once: 26
   * concurrent requests moving ~3MB each, roughly 82MB in one burst on every
   * mount. Measured against a production server that took 10.7s wall with a
   * p50 of 6.2s per request, and against storage directly it was 32.7s. The
   * same assets fetched one at a time return in 0.1-0.5s, so nearly all of
   * that was self-inflicted queueing.
   *
   * A small pool keeps the warm-up in the background where it belongs. This is
   * deliberately NOT a fix for the local-development fallback incident: that
   * cause was never identified (storage survived 38-way concurrency and the
   * database survived 150-way, both without a single error). Reducing peak
   * load is worth doing on its own merits, and the observability added in
   * "distinguish a failed lookup from an absent asset" is what will identify
   * the fallback if it recurs.
   *
   * 2026-07-31, replayed against a dev server with ANIMATION_LOCAL_FALLBACK=0
   * (`npm run dev:prod-assets`), so a masked failure would surface as 503:
   *
   *   concurrency  1 -> 26/26 published, p50 1639ms, wall 44.8s
   *   concurrency  4 -> 26/26 published, p50 1702ms, wall 12.3s
   *   concurrency 26 -> 26/26 published, p50 2611ms, wall  3.0s  (x3 rounds)
   *   concurrency 78 -> 78/78 published, p50 4688ms, 259MB
   *   concurrency 156 -> 156/156 published, p50 10.0s, max 92.7s, 519MB
   *
   * Still not reproduced, and the space is now smaller: not pool exhaustion,
   * not rate limiting, not an upstream timeout — none of those fire even at
   * 519MB across 156 concurrent requests. What load produces is unbounded
   * latency with a clean 200: a 3MB asset took 92.7s while the server logged
   * success. Any client-side timeout turns that into a failure the server
   * never records, which fits an incident invisible in the logs.
   *
   * Note the cap is a production tradeoff, not a local win: locally it makes
   * wall time 4x worse (12.3s at 4 vs 3.0s at 26). It was chosen against
   * production numbers (10.7s wall, p50 6.2s), where the burst is the problem.
   */
  async preload(gestureLabels: string[], concurrency = PRELOAD_CONCURRENCY): Promise<void> {
    const queue = [...gestureLabels];
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let label = queue.shift(); label !== undefined; label = queue.shift()) {
        // load() already de-duplicates in-flight requests, and swallows
        // nothing: failures are logged by fetchAsset.
        await this.load(label);
      }
    });
    await Promise.all(workers);
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
