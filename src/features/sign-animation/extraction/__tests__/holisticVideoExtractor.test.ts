import { describe, expect, it } from "vitest";
import { mapHolisticVideoResult } from "../holisticVideoExtractor";

describe("mapHolisticVideoResult", () => {
  it("retains a complete Holistic frame and skips an empty detection", () => {
    const mapped = mapHolisticVideoResult({
      faceLandmarks: [[{ x: 0.1, y: 0.2, z: 0 }]],
      leftHandLandmarks: [[{ x: 0.2, y: 0.3, z: 0 }]],
      poseLandmarks: [[{ x: 0.3, y: 0.4, z: 0 }]],
      rightHandLandmarks: [[{ x: 0.4, y: 0.5, z: 0 }]],
    }, 120);

    expect(mapped?.timestamp).toBe(120);
    expect(mapped?.landmarks).toHaveLength(2);
    expect(mapHolisticVideoResult({
      faceLandmarks: [],
      leftHandLandmarks: [],
      poseLandmarks: [],
      rightHandLandmarks: [],
    }, 150)).toBeNull();
  });
});