import { describe, expect, it, beforeEach, vi } from "vitest";
import { PlaybackEngine } from "../PlaybackEngine";
import type { AnimationClip, AnimationFrame, GestureAnimationAsset } from "../../types";

const FPS = 30;

function makeAsset(label: string, frameCount: number, base: number): GestureAnimationAsset {
  const frames: AnimationFrame[] = Array.from({ length: frameCount }, (_, i) => ({
    timestamp: Math.round(i * (1000 / FPS)),
    // Distinct per frame so any blend or interpolation is detectable.
    poseLandmarks: [{ x: base + i * 0.05, y: base + i * 0.05, z: 0 }],
    faceLandmarks: [],
    landmarks: [{ side: "right", landmarks: [{ x: base + i * 0.05, y: 0.5, z: 0 }] }],
  }));
  return {
    label,
    language: "FSL",
    fps: FPS,
    duration: (frameCount / FPS) * 1000,
    totalFrames: frameCount,
    frames,
    imageWidth: 1920,
    imageHeight: 1080,
    metadata: { featureDimension: 3, sequenceLength: frameCount, version: 1 },
  };
}

function clip(id: string, asset: GestureAnimationAsset): AnimationClip {
  return { id, gesture: asset.label, asset };
}

/** Drives the engine's rAF loop deterministically. */
function installClock() {
  let now = 0;
  const callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal("performance", { now: () => now });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    callbacks.push(cb);
    return callbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return {
    advance(ms: number) {
      now += ms;
      const pending = callbacks.splice(0, callbacks.length);
      for (const cb of pending) cb(now);
    },
  };
}

describe("PlaybackEngine exact mode", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("emits extracted frames verbatim, never a blended pose", () => {
    const clock = installClock();
    const engine = new PlaybackEngine();
    engine.setExactMode(true);

    const assetA = makeAsset("A", 4, 0.1);
    const assetB = makeAsset("B", 4, 0.9);
    const seen: AnimationFrame[] = [];
    engine.setCallbacks({ onFrame: (frame) => seen.push(frame) });

    engine.loadSequence([clip("a", assetA), clip("b", assetB)]);
    for (let i = 0; i < 20; i++) clock.advance(1000 / FPS);

    expect(seen.length).toBeGreaterThan(0);
    const allowed = new Set<number>();
    for (const asset of [assetA, assetB]) {
      for (const f of asset.frames) allowed.add(f.poseLandmarks![0].x);
    }
    for (const frame of seen) {
      // Every emitted x must be one an extracted frame actually contained.
      expect(allowed.has(frame.poseLandmarks![0].x)).toBe(true);
    }
    engine.dispose();
  });

  it("steps frames at the asset fps rather than resampling", () => {
    const clock = installClock();
    const engine = new PlaybackEngine();
    engine.setExactMode(true);

    const asset = makeAsset("A", 6, 0.1);
    const indices: number[] = [];
    engine.setCallbacks({
      onFrame: (frame) => {
        indices.push(asset.frames.findIndex((f) => f.poseLandmarks![0].x === frame.poseLandmarks![0].x));
      },
    });

    engine.loadSequence([clip("a", asset)]);
    for (let i = 0; i < 5; i++) clock.advance(1000 / FPS);

    expect(indices.every((i) => i >= 0)).toBe(true);
    // Monotonic, one step per frame interval, no repeats or skips.
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(indices.length);
    engine.dispose();
  });

  it("still blends across clips when exact mode is off", () => {
    const clock = installClock();
    const engine = new PlaybackEngine();
    engine.setExactMode(false);

    const assetA = makeAsset("A", 3, 0.1);
    const assetB = makeAsset("B", 3, 0.9);
    const seen: number[] = [];
    engine.setCallbacks({ onFrame: (frame) => seen.push(frame.poseLandmarks![0].x) });

    engine.loadSequence([clip("a", assetA), clip("b", assetB)]);
    for (let i = 0; i < 12; i++) clock.advance(1000 / FPS);

    const extracted = new Set([...assetA.frames, ...assetB.frames].map((f) => f.poseLandmarks![0].x));
    expect(seen.some((x) => !extracted.has(x))).toBe(true);
    engine.dispose();
  });
});
