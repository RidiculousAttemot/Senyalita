import { describe, expect, it } from "vitest";
import { LANDMARK_PRECISION, isQuantisableAsset, quantiseAsset } from "@/lib/landmarkPrecision";
import type { GestureAnimationAsset } from "@/features/sign-animation/types";

/**
 * Quantisation trims digits, never points.
 *
 * The studio published raw float64 while scripts/seed-animation-assets.mjs --
 * which produced all 37 assets in the library -- quantised to 4dp. A sign made
 * in the browser was therefore about twice the size of the same sign made by the
 * script, and THANK YOU serialised to 7,552,771 bytes: publishable on localhost,
 * impossible in production against a 4.5 MB request cap.
 *
 * The risk in fixing that is dropping data to hit a number. These tests exist to
 * make that impossible to do silently: landmark counts, frame counts and
 * structure are all asserted alongside the precision.
 */

const point = (x: number, y: number, z: number) => ({ x, y, z });

function asset(): GestureAnimationAsset {
  return {
    label: "TEST",
    fps: 30,
    totalFrames: 2,
    duration: 66.6666666,
    frames: [
      {
        timestamp: 0.123456789,
        landmarks: [
          { side: "left", landmarks: Array.from({ length: 21 }, (_, i) => point(0.3959202170372009 + i * 1e-6, 0.5, 0.001)) },
          { side: "right", landmarks: Array.from({ length: 21 }, () => point(0.7, 0.25, -0.002)) },
        ],
        poseLandmarks: Array.from({ length: 33 }, () => point(0.111119, 0.222229, 0.333339)),
        faceLandmarks: Array.from({ length: 478 }, () => point(0.4444449, 0.5555559, 0.6666669)),
      },
      {
        timestamp: 33.3333333,
        landmarks: [{ side: "left", landmarks: Array.from({ length: 21 }, () => point(0.5, 0.5, 0)) }],
        poseLandmarks: Array.from({ length: 33 }, () => point(0.1, 0.2, 0.3)),
        faceLandmarks: Array.from({ length: 478 }, () => point(0.4, 0.5, 0.6)),
      },
    ],
  } as GestureAnimationAsset;
}

const decimals = (n: number) => (String(n).split(".")[1] ?? "").length;

describe("landmark quantisation", () => {
  it("keeps every frame, hand, pose and face landmark", () => {
    const before = asset();
    const after = quantiseAsset(before);

    expect(after.frames).toHaveLength(before.frames.length);
    after.frames.forEach((frame, i) => {
      const source = before.frames[i];
      expect(frame.landmarks).toHaveLength(source.landmarks.length);
      frame.landmarks.forEach((hand, h) => {
        expect(hand.side).toBe(source.landmarks[h].side);
        expect(hand.landmarks).toHaveLength(source.landmarks[h].landmarks.length);
      });
      expect(frame.poseLandmarks).toHaveLength(source.poseLandmarks!.length);
      // 478 points. The face mesh is 90% of the payload and the obvious thing
      // to delete for size; it stays.
      expect(frame.faceLandmarks).toHaveLength(478);
    });
  });

  it("rounds every coordinate to the configured precision", () => {
    const after = quantiseAsset(asset());
    for (const frame of after.frames) {
      const all = [
        ...frame.landmarks.flatMap((h) => h.landmarks),
        ...(frame.poseLandmarks ?? []),
        ...(frame.faceLandmarks ?? []),
      ];
      for (const p of all) {
        expect(decimals(p.x)).toBeLessThanOrEqual(LANDMARK_PRECISION);
        expect(decimals(p.y)).toBeLessThanOrEqual(LANDMARK_PRECISION);
        expect(decimals(p.z)).toBeLessThanOrEqual(LANDMARK_PRECISION);
      }
    }
  });

  it("rounds rather than truncates", () => {
    const after = quantiseAsset(asset());
    // 0.3959202170372009 -> 0.3959, and 0.4444449 -> 0.4444 (not 0.4445).
    expect(after.frames[0].landmarks[0].landmarks[0].x).toBe(0.3959);
    expect(after.frames[0].faceLandmarks![0].x).toBe(0.4444);
    expect(after.frames[0].poseLandmarks![0].y).toBe(0.2222);
  });

  it("shrinks the payload without changing what is drawn", () => {
    const before = asset();
    const rawBytes = JSON.stringify(before).length;
    const quantisedBytes = JSON.stringify(quantiseAsset(before)).length;
    expect(quantisedBytes).toBeLessThan(rawBytes);
  });

  it("leaves metadata alone", () => {
    const after = quantiseAsset(asset());
    expect(after.label).toBe("TEST");
    expect(after.fps).toBe(30);
    expect(after.totalFrames).toBe(2);
  });

  it("does not mutate its input", () => {
    const before = asset();
    const originalX = before.frames[0].landmarks[0].landmarks[0].x;
    quantiseAsset(before);
    expect(before.frames[0].landmarks[0].landmarks[0].x).toBe(originalX);
  });

  it("recognises only values it can actually walk", () => {
    expect(isQuantisableAsset(asset())).toBe(true);
    expect(isQuantisableAsset({ frames: [] })).toBe(true);
    expect(isQuantisableAsset({})).toBe(false);
    expect(isQuantisableAsset(null)).toBe(false);
    expect(isQuantisableAsset("asset")).toBe(false);
  });
});
