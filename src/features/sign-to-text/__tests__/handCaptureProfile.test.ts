import { describe, expect, it } from "vitest";
import { HAND_CAPTURE_CONSTRAINTS, HAND_LANDMARKER_OPTIONS } from "../handCaptureProfile";

describe("hand capture profile", () => {
  /**
   * This asserted 1280x720 @ 60fps against an implementation that has always
   * requested 640x480 with no frame-rate constraint — it never passed, in any
   * commit. It described an intent, not the code.
   *
   * 640x480 is deliberate: landmarks are normalised per hand (wrist-centred,
   * scaled to [-1,1]) before reaching the model, so extra capture resolution
   * is discarded and only costs decode time.
   *
   * The frame rate is deliberately left unconstrained. Recognition appends to
   * its buffer on a fixed ~30Hz cadence to match the rate training clips were
   * extracted at; asking the camera for 60fps would double the decode and
   * detection work and then throw half of it away.
   */
  it("requests a front camera sized for two complete hands", () => {
    expect(HAND_CAPTURE_CONSTRAINTS.video).toMatchObject({
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 },
    });
    expect(HAND_CAPTURE_CONSTRAINTS.video).not.toHaveProperty("frameRate");
    expect(HAND_LANDMARKER_OPTIONS).toMatchObject({
      numHands: 2,
      runningMode: "VIDEO",
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
  });
});