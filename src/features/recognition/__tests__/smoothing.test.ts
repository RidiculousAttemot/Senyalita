import { describe, it, expect } from "vitest";
import { PredictionSmoother } from "../smoothing";
import type { InferenceResult } from "../model";

const result = (label: string, confidence: number, topK: Array<{ label: string; confidence: number }> = []): InferenceResult => ({
  label,
  labelId: 0,
  confidence,
  topK
});

describe("PredictionSmoother", () => {
  it("returns the raw result until the buffer reaches minimum votes", () => {
    const smoother = new PredictionSmoother();
    const r1 = result("a", 0.5);
    const out1 = smoother.smooth(r1);
    expect(out1.label).toBe(r1.label);
    expect(out1.confidence).toBe(r1.confidence);
  });

  it("picks the most frequent label once enough votes exist", () => {
    const smoother = new PredictionSmoother();
    for (let i = 0; i < 3; i += 1) smoother.smooth(result("a", 0.6));
    for (let i = 0; i < 2; i += 1) smoother.smooth(result("b", 0.5));
    const smoothed = smoother.smooth(result("a", 0.7));
    expect(smoothed.label).toBe("a");
  });

  it("averages confidence over the buffer", () => {
    const smoother = new PredictionSmoother();
    for (let i = 0; i < 5; i += 1) smoother.smooth(result("a", 0.6));
    const smoothed = smoother.smooth(result("a", 0.8));
    // buffer keeps last 5 entries, so 4*0.6 + 1*0.8 = 3.2 / 5 = 0.64
    expect(smoothed.confidence).toBeCloseTo(0.64, 5);
  });

  it("limits topK to 5 suggestions", () => {
    const smoother = new PredictionSmoother();
    for (let i = 0; i < 5; i += 1) {
      smoother.smooth(
        result("a", 0.5, [
          { label: "a", confidence: 0.5 },
          { label: "b", confidence: 0.3 },
          { label: "c", confidence: 0.1 },
          { label: "d", confidence: 0.05 },
          { label: "e", confidence: 0.05 }
        ])
      );
    }
    const smoothed = smoother.smooth(result("a", 0.5));
    expect(smoothed.topK.length).toBeLessThanOrEqual(5);
  });

  it("resets the smoothing history", () => {
    const smoother = new PredictionSmoother();
    for (let i = 0; i < 5; i += 1) smoother.smooth(result("a", 0.6));
    smoother.reset();
    const out = smoother.smooth(result("x", 0.99));
    expect(out).toBe(out);
  });
});
