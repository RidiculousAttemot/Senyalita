import { describe, expect, it } from "vitest";
import { validateAsset } from "../smartValidator";
import type { GestureAnimationAsset } from "@/features/sign-animation/types";

/**
 * The verdict the publish gate now depends on.
 *
 * PublishTab enforced only the structural check, so an asset could show
 * "FAIL — Failed 2 check(s), 75/100" and publish anyway: the red banner was
 * advisory text with nothing behind it. The gate now calls validateAsset and
 * refuses a failing verdict for publish and approve, so these assert that a
 * verdict is actually produced and is derived from the asset rather than being
 * a constant.
 *
 * Draft and archive stay exempt on purpose — saving work in progress is exactly
 * what you do with an asset that is not ready.
 */

const hand = (side: "left" | "right", x: number) => ({
  side,
  landmarks: Array.from({ length: 21 }, (_, i) => ({ x: x + i * 0.004, y: 0.4 + i * 0.003, z: 0 })),
});

function asset(frameCount: number, moving: boolean): GestureAnimationAsset {
  return {
    label: "TEST",
    fps: 30,
    totalFrames: frameCount,
    duration: (frameCount / 30) * 1000,
    frames: Array.from({ length: frameCount }, (_, i) => ({
      timestamp: (i / 30) * 1000,
      landmarks: [
        hand("left", moving ? 0.2 + i * 0.006 : 0.2),
        hand("right", moving ? 0.7 - i * 0.006 : 0.7),
      ],
      poseLandmarks: Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
      faceLandmarks: Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.4, z: 0 })),
    })),
  } as GestureAnimationAsset;
}

describe("inverted checks grade lower as better", () => {
  /**
   * jitter, frozen_frames and missing_frames are the three checks where a
   * smaller number is better. Their `invert` flag was accepted and never
   * applied — every ternary in validateThreshold had identical branches — so
   * they were graded as if higher were better:
   *
   *   frozen_frames 0   -> FAIL   (a flawless clip)
   *   frozen_frames 98  -> pass   (an unusable one)
   *
   * Harmless while nothing enforced the verdict. Fatal the moment the publish
   * gate depends on it, which it now does: it would have blocked every good
   * asset and waved through the bad ones.
   */
  it("passes a clip with no jitter, no frozen frames and no dropouts", () => {
    const result = validateAsset(asset(90, true));
    for (const name of ["jitter", "frozen_frames", "missing_frames"] as const) {
      const check = result.checks[name];
      expect(check.status, `${name} was ${check.status} at value ${check.value}`).not.toBe("fail");
    }
  });

  it("fails a clip that never moves", () => {
    // Both hands pinned for every frame: frozen_frames is ~100%, far past the
    // 40 ceiling. Under the old logic this passed.
    const result = validateAsset(asset(90, false));
    expect(result.checks.frozen_frames.status).toBe("fail");
    expect(result.verdict).toBe("fail");
  });

  it("does not report a frozen percentage above 100", () => {
    const value = validateAsset(asset(90, false)).checks.frozen_frames.value;
    expect(Number(value)).toBeLessThanOrEqual(100);
  });
});

describe("publish verdict", () => {
  it("produces a verdict and a score for any asset", () => {
    const result = validateAsset(asset(60, true));
    expect(["pass", "warn", "fail"]).toContain(result.verdict);
    expect(typeof result.score).toBe("number");
  });

  it("fails an asset with too few frames to be a sign", () => {
    // frame_count fails below 10 — a clip this short cannot carry a gesture,
    // and it is the clearest case the gate must refuse.
    const result = validateAsset(asset(4, true));
    expect(result.verdict).toBe("fail");
  });

  it("does not fail a well-formed moving clip", () => {
    const result = validateAsset(asset(90, true));
    expect(result.verdict).not.toBe("fail");
  });

  it("names the checks that failed, so the gate can say which", () => {
    // The gate builds its message from these names; an empty or shapeless
    // checks map would leave the admin with "it failed" and nothing to act on.
    const result = validateAsset(asset(4, true));
    const failed = Object.entries(result.checks)
      .filter(([, c]) => c.status === "fail")
      .map(([name]) => name);

    expect(failed.length).toBeGreaterThan(0);
    for (const name of failed) expect(typeof name).toBe("string");
  });

  it("reacts to the asset rather than returning a constant", () => {
    // A gate is worthless if the verdict never changes.
    const good = validateAsset(asset(90, true)).verdict;
    const bad = validateAsset(asset(4, false)).verdict;
    expect(bad).toBe("fail");
    expect(good).not.toBe(bad);
  });
});
