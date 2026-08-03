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
   * Both dimensions and the frame rate now carry a `max`, because `ideal` is a
   * hint a camera may ignore. On a mid-range Android the phone returned a much
   * larger, faster stream and detection cost 500-1000ms per frame — 1-2 FPS,
   * against the 30 the model needs, so recognition could not work at all.
   *
   * This test previously asserted the frame rate was left *unconstrained*,
   * with a comment explaining that 60fps would "double the decode and
   * detection work and then throw half of it away". That reasoning was right;
   * leaving it unconstrained simply did not enforce it. `max: 30` does.
   *
   * None of these are `exact`, so getUserMedia still succeeds on a device that
   * cannot meet them — it returns the closest available instead of failing.
   */
  it("requests a capped front camera and tracks a single hand", () => {
    expect(HAND_CAPTURE_CONSTRAINTS.video).toMatchObject({
      facingMode: "user",
      width: { ideal: 640, max: 960 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    });
    // One hand, not two. MediaPipe runs its landmark model once per tracked
    // hand, so this is the single biggest lever on detection cost — measured
    // 631ms -> 342ms per detection on a software-rendered GPU, 1 FPS -> 3.
    //
    // The trade is that two-handed signs lose their second hand. Sign-to-Text
    // is alphabet-scoped and FSL fingerspelling is one-handed, so it costs
    // nothing on the deployed workflow; it is the first line to revisit if the
    // model's two-handed phrase classes are ever surfaced.
    expect(HAND_LANDMARKER_OPTIONS).toMatchObject({
      numHands: 1,
      runningMode: "VIDEO",
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
  });
});