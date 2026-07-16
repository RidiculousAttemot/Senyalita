import { describe, expect, it } from "vitest";
import { createFrameRateTracker } from "../cameraFrameRate";

describe("createFrameRateTracker", () => {
  it("reports actual processed frames over the elapsed measurement window", () => {
    const tracker = createFrameRateTracker(0);

    tracker.record(0);
    tracker.record(100);
    tracker.record(200);
    tracker.record(300);
    tracker.record(400);
    tracker.record(500);
    tracker.record(600);
    tracker.record(700);
    tracker.record(800);
    tracker.record(900);
    expect(tracker.record(1000)).toBe(11);
  });

  it("keeps the last FPS until a full window is measured", () => {
    const tracker = createFrameRateTracker(0);
    tracker.record(0);
    expect(tracker.record(500)).toBe(0);
  });
});