import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveConfidenceManager } from "../adaptiveConfidence";

describe("AdaptiveConfidenceManager", () => {
  let manager: AdaptiveConfidenceManager;

  beforeEach(() => {
    manager = new AdaptiveConfidenceManager();
    manager.resetAll();
    manager.setGlobalDefault(0.6);
  });

  it("returns global default for unknown gestures", () => {
    expect(manager.getThreshold("UNKNOWN")).toBe(0.6);
  });

  it("adapts threshold based on high confidence history", () => {
    for (let i = 0; i < 30; i++) {
      manager.recordPrediction("HELLO", 0.85 + Math.random() * 0.1);
    }
    const threshold = manager.getThreshold("HELLO");
    expect(threshold).toBeLessThanOrEqual(0.6);
  });

  it("increases threshold for volatile gestures", () => {
    const confidences = [0.3, 0.9, 0.2, 0.8, 0.1, 0.7, 0.3, 0.85, 0.15, 0.75, 0.25, 0.8, 0.2, 0.9, 0.1];
    for (const c of confidences) {
      manager.recordPrediction("VOLATILE", c);
    }
    const threshold = manager.getThreshold("VOLATILE");
    expect(threshold).toBeGreaterThanOrEqual(0.5);
  });

  it("does not adjust below minimum of 0.4", () => {
    for (let i = 0; i < 50; i++) {
      manager.recordPrediction("EASY", 0.95);
    }
    expect(manager.getThreshold("EASY")).toBeGreaterThanOrEqual(0.4);
  });

  it("does not adjust above maximum of 0.9", () => {
    for (let i = 0; i < 50; i++) {
      manager.recordPrediction("HARD", 0.2);
    }
    expect(manager.getThreshold("HARD")).toBeLessThanOrEqual(0.9);
  });

  it("returns adjustment factors", () => {
    for (let i = 0; i < 10; i++) {
      manager.recordPrediction("TEST", 0.7, "signer-1", { motionQuality: 0.6 });
    }
    const factors = manager.getAdjustmentFactors("TEST");
    expect(factors).not.toBeNull();
    expect(factors!.recentTrend).toBeDefined();
    expect(factors!.motionQualityBoost).toBeDefined();
  });

  it("resets gesture threshold", () => {
    const confidences = [0.9, 0.1, 0.85, 0.15, 0.8, 0.2, 0.75, 0.25, 0.7, 0.3];
    for (const c of confidences) {
      manager.recordPrediction("RESET_ME", c);
    }
    expect(manager.getThreshold("RESET_ME")).not.toBe(0.6);
    manager.resetGesture("RESET_ME");
    expect(manager.getThreshold("RESET_ME")).toBe(0.6);
  });

  it("sets global default", () => {
    manager.setGlobalDefault(0.7);
    expect(manager.getGlobalDefault()).toBe(0.7);
    expect(manager.getThreshold("NEW")).toBe(0.7);
  });

  it("considers motion quality in adjustment", () => {
    for (let i = 0; i < 10; i++) {
      manager.recordPrediction("MOTION", 0.6, undefined, { motionQuality: 0.2 });
    }
    const threshold = manager.getThreshold("MOTION");
    expect(threshold).toBeGreaterThanOrEqual(0.6);
  });

  it("considers lighting quality in adjustment", () => {
    for (let i = 0; i < 10; i++) {
      manager.recordPrediction("LIGHTING", 0.6, undefined, { lightingQuality: 0.2 });
    }
    const threshold = manager.getThreshold("LIGHTING");
    expect(threshold).toBeGreaterThanOrEqual(0.6);
  });
});
