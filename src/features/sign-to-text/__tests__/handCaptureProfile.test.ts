import { describe, expect, it } from "vitest";
import { HAND_CAPTURE_CONSTRAINTS, HAND_LANDMARKER_OPTIONS } from "../handCaptureProfile";

describe("hand capture profile", () => {
  it("requests a high-frame-rate front camera for two complete hands", () => {
    expect(HAND_CAPTURE_CONSTRAINTS.video).toMatchObject({
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 60, max: 60 },
    });
    expect(HAND_LANDMARKER_OPTIONS).toMatchObject({
      numHands: 2,
      runningMode: "VIDEO",
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
  });
});