import { describe, expect, it } from "vitest";
import { assignHandSlots, type DetectedHand } from "../handSlots";
import { normalizeLandmarks } from "../normalize";

/**
 * Two hands in one frame must both survive into the feature vector.
 *
 * The live path used two independent findIndex calls, one per handedness label.
 * MediaPipe guesses handedness per frame and regularly returns "Right" for both
 * hands, which made the left lookup fail and silently discarded a hand — 63 of
 * the model's 126 features left at zero.
 *
 * Measured over a stride sample of the v4 test split, 93% of phrase sequences
 * carry both hands against 18% of letters, so this is precisely the case that
 * made two-handed phrase signs stop being recognised.
 *
 * The reference is scripts/extract-fsl-105-landmarks.mjs, which built the
 * training vectors with a collision fallback. Inference has to agree with it.
 */

const hand = (x: number): DetectedHand["landmarks"] =>
  Array.from({ length: 21 }, (_, i) => ({ x: x + i * 0.001, y: 0.5, z: 0 }));

const detected = (handedness: string | undefined, x: number): DetectedHand => ({
  landmarks: hand(x),
  handedness,
});

describe("hand slot assignment", () => {
  it("puts left in slot 0 and right in slot 1", () => {
    const [left, right] = assignHandSlots([detected("Left", 0.2), detected("Right", 0.8)]);
    expect(left?.[0].x).toBeCloseTo(0.2);
    expect(right?.[0].x).toBeCloseTo(0.8);
  });

  it("is order independent", () => {
    const [left, right] = assignHandSlots([detected("Right", 0.8), detected("Left", 0.2)]);
    expect(left?.[0].x).toBeCloseTo(0.2);
    expect(right?.[0].x).toBeCloseTo(0.8);
  });

  it("keeps both hands when MediaPipe labels them the same — the regression", () => {
    // The exact failure: two hands, both reported "Right".
    const [left, right] = assignHandSlots([detected("Right", 0.2), detected("Right", 0.8)]);
    expect(left, "second hand was discarded").not.toBeNull();
    expect(right).not.toBeNull();
    expect([left?.[0].x, right?.[0].x].sort()).toEqual([0.2, 0.8]);
  });

  it("keeps both hands when both are reported Left", () => {
    const [left, right] = assignHandSlots([detected("Left", 0.2), detected("Left", 0.8)]);
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
  });

  it("treats missing handedness as right, matching training's default", () => {
    // extract-fsl-105-landmarks.mjs: `categoryName || "Right"`.
    const [left, right] = assignHandSlots([detected(undefined, 0.5)]);
    expect(left).toBeNull();
    expect(right?.[0].x).toBeCloseTo(0.5);
  });

  it("leaves the other slot empty for a single hand", () => {
    const [left, right] = assignHandSlots([detected("Left", 0.3)]);
    expect(left).not.toBeNull();
    expect(right).toBeNull();
  });

  it("ignores empty detections", () => {
    const [left, right] = assignHandSlots([
      { landmarks: [], handedness: "Left" },
      detected("Right", 0.6),
    ]);
    expect(left).toBeNull();
    expect(right?.[0].x).toBeCloseTo(0.6);
  });

  it("returns empty slots for no detections", () => {
    expect(assignHandSlots([])).toEqual([null, null]);
  });

  it("yields a fully populated 126-feature vector for two same-labelled hands", () => {
    // The point of all of the above: what the model actually receives.
    const [left, right] = assignHandSlots([detected("Right", 0.2), detected("Right", 0.8)]);
    const features = normalizeLandmarks(left, right);

    expect(features).toHaveLength(126);
    const leftHalf = features.slice(0, 63);
    const rightHalf = features.slice(63);
    expect(leftHalf.some((v) => v !== 0), "left half is all zeros").toBe(true);
    expect(rightHalf.some((v) => v !== 0), "right half is all zeros").toBe(true);
  });
});
