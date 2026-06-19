import { describe, it, expect } from "vitest";
import { normalizeLandmarks } from "../normalize";

const hand21 = (values: number[] = []) =>
  Array.from({ length: 21 }, (_, i) => ({
    x: values[0] ?? 0 + i * 0.001,
    y: values[1] ?? 0 + i * 0.001,
    z: values[2] ?? 0 + i * 0.001
  }));

describe("normalizeLandmarks", () => {
  it("returns a 126-length zero vector when no hands are present", () => {
    const out = normalizeLandmarks(null, null);
    expect(out.length).toBe(126);
    expect(Array.from(out).every((v) => v === 0)).toBe(true);
  });

  it("centers the hand on the wrist", () => {
    const hand = hand21();
    hand[0] = { x: 0.5, y: 0.5, z: 0.5 };
    const out = normalizeLandmarks(hand, null);
    // The wrist (index 0) should be the origin in the first hand slot
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(0, 5);
    expect(out[2]).toBeCloseTo(0, 5);
  });

  it("normalizes the maximum absolute value to 1", () => {
    const hand = hand21();
    hand[0] = { x: 0.1, y: 0.2, z: 0.3 };
    hand[5] = { x: 0.6, y: 0.2, z: 0.3 };
    const out = normalizeLandmarks(hand, null);
    const maxAbs = Math.max(...Array.from(out.slice(0, 63)).map(Math.abs));
    expect(maxAbs).toBeCloseTo(1, 5);
  });

  it("places left hand in first 63 dims and right hand in next 63", () => {
    const left = hand21();
    left[0] = { x: 0, y: 0, z: 0 };
    left[5] = { x: 1, y: 0, z: 0 };
    const right = hand21();
    right[0] = { x: 0, y: 0, z: 0 };
    right[5] = { x: -1, y: 0, z: 0 };
    const out = normalizeLandmarks(left, right);
    // Right hand (negative x) should land in the upper half
    const leftHalf = Array.from(out.slice(0, 63));
    const rightHalf = Array.from(out.slice(63, 126));
    expect(leftHalf.some((v) => Math.abs(v) > 0)).toBe(true);
    expect(rightHalf.some((v) => Math.abs(v) > 0)).toBe(true);
  });

  it("treats an empty hand as zeros", () => {
    const out = normalizeLandmarks([], null);
    const leftHalf = Array.from(out.slice(0, 63));
    expect(leftHalf.every((v) => v === 0)).toBe(true);
  });
});
