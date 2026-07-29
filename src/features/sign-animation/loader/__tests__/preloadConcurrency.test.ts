import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationLoader } from "../AnimationLoader";

/**
 * preload() used to be a bare unawaited loop, so every label dispatched at
 * once — 26 concurrent requests moving ~3MB each. Against a production server
 * that burst took 10.7s wall with a p50 of 6.2s per request; the same assets
 * fetched one at a time return in 0.1–0.5s, so almost all of it was
 * self-inflicted queueing.
 *
 * These tests assert the pool, not the timing: peak in-flight requests is the
 * property that regressed, and it is the one a future edit could silently undo
 * by reintroducing a loop.
 */

const ASSET = { frames: [], fps: 30, totalFrames: 0, duration: 0 };

/** Resolves after `ms`, tracking how many calls overlap. */
function trackingFetch(inflight: { now: number; peak: number }, ms = 5) {
  return vi.fn(async () => {
    inflight.now++;
    inflight.peak = Math.max(inflight.peak, inflight.now);
    await new Promise((resolve) => setTimeout(resolve, ms));
    inflight.now--;
    return { ok: true, status: 200, json: async () => ASSET } as unknown as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AnimationLoader.preload concurrency", () => {
  it("never exceeds the default pool of 4", async () => {
    const inflight = { now: 0, peak: 0 };
    vi.stubGlobal("fetch", trackingFetch(inflight));

    const loader = new AnimationLoader();
    await loader.preload("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));

    expect(inflight.peak).toBeLessThanOrEqual(4);
    // Guard against the opposite mistake: serialising everything would also
    // satisfy an upper bound, and would make warming the alphabet far slower.
    expect(inflight.peak).toBeGreaterThan(1);
  });

  it("honours an explicit concurrency argument", async () => {
    const inflight = { now: 0, peak: 0 };
    vi.stubGlobal("fetch", trackingFetch(inflight));

    const loader = new AnimationLoader();
    await loader.preload("ABCDEFGH".split(""), 2);

    expect(inflight.peak).toBeLessThanOrEqual(2);
  });

  it("loads every label exactly once despite the pool", async () => {
    const inflight = { now: 0, peak: 0 };
    const fetchMock = trackingFetch(inflight);
    vi.stubGlobal("fetch", fetchMock);

    const loader = new AnimationLoader();
    const labels = "ABCDEFGHIJ".split("");
    await loader.preload(labels);

    expect(fetchMock).toHaveBeenCalledTimes(labels.length);
    expect(loader.getCacheSize()).toBe(labels.length);
  });

  it("resolves only once the whole list is warm", async () => {
    const inflight = { now: 0, peak: 0 };
    vi.stubGlobal("fetch", trackingFetch(inflight));

    const loader = new AnimationLoader();
    await loader.preload("ABCDEF".split(""));

    // The old fire-and-forget version resolved immediately with nothing in
    // flight settled, so callers could not await a warm cache.
    expect(inflight.now).toBe(0);
    expect(loader.getStats().loaded).toBe(6);
  });
});
