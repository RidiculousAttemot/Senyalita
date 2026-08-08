import { describe, expect, it } from "vitest";
import { analyzeQuality } from "../qualityAnalyzer";
import type { GestureAnimationAsset } from "@/features/sign-animation/types";

/**
 * The frozen-frame ratio must be a possible percentage.
 *
 * It counted once per HAND and divided by FRAME COUNT, so a two-handed sign
 * could report up to 200% frozen. The number is surfaced to the user as
 * "High number of frozen frames (98%)" and feeds the publish verdict, so an
 * impossible value is not cosmetic — it decides whether an asset looks
 * publishable.
 */

/** A hand whose landmarks all sit at the same point. */
const hand = (side: "left" | "right", x: number) => ({
  side,
  landmarks: Array.from({ length: 21 }, () => ({ x, y: 0.5, z: 0 })),
});

function asset(frames: GestureAnimationAsset["frames"]): GestureAnimationAsset {
  return {
    label: "TEST",
    frames,
    fps: 30,
    totalFrames: frames.length,
    duration: (frames.length / 30) * 1000,
  } as GestureAnimationAsset;
}

/** `count` frames, both hands pinned to the same coordinates throughout. */
function motionless(count: number, hands: Array<"left" | "right"> = ["left", "right"]) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: (i / 30) * 1000,
    landmarks: hands.map((s) => hand(s, 0.5)),
    poseLandmarks: [],
    faceLandmarks: [],
  })) as GestureAnimationAsset["frames"];
}

describe("frozen frame ratio", () => {
  it("never exceeds 100% for a two-handed motionless clip", () => {
    // The regression: 60 frames x 2 still hands used to yield 120/60 = 200%.
    const { metrics } = analyzeQuality(asset(motionless(60)));
    expect(metrics.frozenPercent).toBeLessThanOrEqual(100);
    expect(metrics.frozenPercent).toBe(100);
  });

  it("reports the same value for a one-handed and a two-handed still clip", () => {
    // Frozenness is a property of the clip, not of how many hands are tracked.
    const one = analyzeQuality(asset(motionless(40, ["right"]))).metrics.frozenPercent;
    const two = analyzeQuality(asset(motionless(40))).metrics.frozenPercent;
    expect(one).toBe(two);
  });

  it("reports 0% when both hands move every frame", () => {
    const frames = Array.from({ length: 30 }, (_, i) => ({
      timestamp: (i / 30) * 1000,
      landmarks: [hand("left", 0.2 + i * 0.01), hand("right", 0.8 - i * 0.01)],
      poseLandmarks: [],
      faceLandmarks: [],
    })) as GestureAnimationAsset["frames"];

    expect(analyzeQuality(asset(frames)).metrics.frozenPercent).toBe(0);
  });

  it("counts a frame as frozen only when every tracked hand is still", () => {
    // One hand planted, the other moving. The clip is not frozen: this is what
    // a one-handed sign performed against a resting hand looks like, and the
    // per-hand counter used to score it 50% frozen.
    const frames = Array.from({ length: 30 }, (_, i) => ({
      timestamp: (i / 30) * 1000,
      landmarks: [hand("left", 0.5), hand("right", 0.2 + i * 0.01)],
      poseLandmarks: [],
      faceLandmarks: [],
    })) as GestureAnimationAsset["frames"];

    expect(analyzeQuality(asset(frames)).metrics.frozenPercent).toBe(0);
  });

  it("keeps frozenPercent consistent with the raw count it is derived from", () => {
    const result = analyzeQuality(asset(motionless(50)));
    expect(result.metrics.frozenFrames).toBeLessThanOrEqual(50);
    // 49 comparisons for 50 frames — the first has no predecessor.
    expect(result.metrics.frozenFrames).toBe(49);
    expect(result.metrics.frozenPercent).toBe(100);
  });

  it("does not divide by zero on a single-frame asset", () => {
    const result = analyzeQuality(asset(motionless(1)));
    expect(Number.isFinite(result.metrics.frozenPercent)).toBe(true);
    expect(result.metrics.frozenPercent).toBe(0);
  });
});
