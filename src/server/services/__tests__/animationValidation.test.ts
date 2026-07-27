import { describe, expect, it } from "vitest";
import { MIN_FRAMES, validateAnimationAsset } from "../animationValidation";

const point = () => ({ x: 0.5, y: 0.5, z: 0 });
const hand = () => ({ landmarks: Array.from({ length: 21 }, point) });

function makeFrames(count: number, opts: { hands?: number; pose?: boolean; face?: number } = {}) {
  const { hands = 1, pose = true, face = 478 } = opts;
  return Array.from({ length: count }, (_, i) => ({
    timestamp: i / 30,
    landmarks: Array.from({ length: hands }, hand),
    ...(pose ? { poseLandmarks: Array.from({ length: 33 }, point) } : {}),
    ...(face > 0 ? { faceLandmarks: Array.from({ length: face }, point) } : {}),
  }));
}

/** Mirrors the real extracted assets: 30fps, ~160 frames, ~5.3s. */
function makeAsset(overrides: Record<string, unknown> = {}, frameOpts = {}) {
  return {
    label: "A",
    language: "fsl",
    fps: 30,
    duration: 5300,
    totalFrames: 160,
    frames: makeFrames(160, frameOpts),
    metadata: {},
    ...overrides,
  };
}

describe("validateAnimationAsset", () => {
  it("accepts a typical two-handed asset", () => {
    const result = validateAnimationAsset(makeAsset({}, { hands: 2 }));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.stats.maxHandsInAnyFrame).toBe(2);
  });

  /**
   * The rule that matters most. 19 of the 37 real FSL assets are one-handed
   * (digits 0,1,2,4,5,6,7 and letters b,c,f,h,j,k,m,r,u,w,x,y), so requiring
   * both hands would reject over half the alphabet.
   */
  it("accepts a one-handed sign — most fingerspelling is one-handed", () => {
    const result = validateAnimationAsset(makeAsset({}, { hands: 1 }));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.stats.maxHandsInAnyFrame).toBe(1);
  });

  it("rejects an asset with no hands in any frame", () => {
    const result = validateAnimationAsset(makeAsset({}, { hands: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("no_hands");
  });

  it.each([
    ["fps", { fps: 0 }, "fps_invalid"],
    ["duration", { duration: 0 }, "duration_invalid"],
  ])("rejects invalid %s", (_label, override, code) => {
    const result = validateAnimationAsset(makeAsset(override));
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain(code);
  });

  it("rejects an animation shorter than the frame minimum", () => {
    const short = makeAsset({ totalFrames: 3, frames: makeFrames(3) });
    const result = validateAnimationAsset(short);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("too_few_frames");
    expect(MIN_FRAMES).toBeGreaterThan(3);
  });

  it("rejects a missing or empty gloss", () => {
    expect(validateAnimationAsset(makeAsset({ label: "" })).valid).toBe(false);
    expect(validateAnimationAsset(makeAsset({ label: "   " })).valid).toBe(false);
    // An explicit gloss overrides a blank label.
    expect(validateAnimationAsset(makeAsset({ label: "" }), { gloss: "HELLO" }).valid).toBe(true);
  });

  it("rejects non-object input", () => {
    for (const bad of [null, undefined, "asset", 42]) {
      expect(validateAnimationAsset(bad).valid).toBe(false);
    }
  });

  describe("versioning", () => {
    it("accepts a version that advances", () => {
      const r = validateAnimationAsset(makeAsset(), { expectedVersion: 3, previousVersion: 2 });
      expect(r.valid).toBe(true);
    });

    it("rejects a version that does not advance", () => {
      for (const v of [2, 1]) {
        const r = validateAnimationAsset(makeAsset(), { expectedVersion: v, previousVersion: 2 });
        expect(r.valid).toBe(false);
        expect(r.errors.map((e) => e.code)).toContain("version_not_incremented");
      }
    });

    it("rejects a non-positive version", () => {
      const r = validateAnimationAsset(makeAsset(), { expectedVersion: 0, previousVersion: 0 });
      expect(r.valid).toBe(false);
      expect(r.errors.map((e) => e.code)).toContain("version_invalid");
    });
  });

  describe("warnings do not block publishing", () => {
    it("warns but still publishes without a face mesh", () => {
      const r = validateAnimationAsset(makeAsset({}, { face: 0 }));
      expect(r.valid).toBe(true);
      expect(r.warnings.map((w) => w.code)).toContain("no_face_mesh");
      expect(r.stats.hasFaceMesh).toBe(false);
    });

    it("warns but still publishes without pose landmarks", () => {
      const r = validateAnimationAsset(makeAsset({}, { pose: false }));
      expect(r.valid).toBe(true);
      expect(r.warnings.map((w) => w.code)).toContain("no_pose");
    });

    it("warns when hands appear in only a few frames", () => {
      const frames = [...makeFrames(10, { hands: 1 }), ...makeFrames(90, { hands: 0 })];
      const r = validateAnimationAsset(makeAsset({ totalFrames: 100, frames }));
      expect(r.valid).toBe(true);
      expect(r.warnings.map((w) => w.code)).toContain("sparse_hands");
    });
  });
});
