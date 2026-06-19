import { describe, it, expect, beforeEach } from "vitest";
import { QualityScoreTracker } from "../qualityScore";

describe("QualityScoreTracker", () => {
  let tracker: QualityScoreTracker;

  beforeEach(() => {
    tracker = new QualityScoreTracker();
  });

  it("starts with base metrics", () => {
    const metrics = tracker.getMetrics();
    expect(metrics.gestureCount).toBe(0);
    expect(metrics.overallScore).toBe(15);
    expect(metrics.avgConfidence).toBe(0);
    expect(metrics.replySelectionRate).toBe(0);
    expect(metrics.correctionFrequency).toBe(0);
    expect(metrics.topicDiversity).toBe(0);
  });

  it("tracks gesture confidence", () => {
    tracker.recordGesture("Hello", 0.9, "Greeting");
    tracker.recordGesture("Goodbye", 0.8, "Farewell");
    const metrics = tracker.getMetrics();
    expect(metrics.gestureCount).toBe(2);
    expect(metrics.avgConfidence).toBeCloseTo(0.85, 2);
  });

  it("tracks multiple gestures to same topic", () => {
    tracker.recordGesture("Hello", 0.9, "Greeting");
    tracker.recordGesture("Good Morning", 0.85, "Greeting");
    const metrics = tracker.getMetrics();
    expect(metrics.topicDiversity).toBe(1);
  });

  it("tracks topic diversity", () => {
    tracker.recordGesture("Hello", 0.9, "Greeting");
    tracker.recordGesture("Doctor", 0.8, "Healthcare");
    tracker.recordGesture("Food", 0.7, "Food");
    const metrics = tracker.getMetrics();
    expect(metrics.topicDiversity).toBe(3);
  });

  it("tracks reply selections", () => {
    tracker.recordGesture("Hello", 0.9, "Greeting");
    tracker.recordReplySelection();
    const metrics = tracker.getMetrics();
    expect(metrics.replySelectionRate).toBe(1);
  });

  it("tracks corrections", () => {
    tracker.recordGesture("Hello", 0.4, "Greeting");
    tracker.recordCorrection();
    const metrics = tracker.getMetrics();
    expect(metrics.correctionFrequency).toBe(1);
  });

  it("tracks successful conversations", () => {
    tracker.recordConversation(true);
    tracker.recordConversation(true);
    tracker.recordConversation(false);
    const metrics = tracker.getMetrics();
    expect(metrics.totalConversations).toBe(3);
    expect(metrics.successfulConversations).toBe(2);
  });

  it("computes overall score correctly", () => {
    tracker.recordGesture("Hello", 0.9, "Greeting");
    tracker.recordGesture("Goodbye", 0.85, "Farewell");
    tracker.recordReplySelection();
    const metrics = tracker.getMetrics();
    expect(metrics.overallScore).toBeGreaterThan(0);
    expect(metrics.overallScore).toBeLessThanOrEqual(100);
  });

  it("reset clears all state", () => {
    tracker.recordGesture("Hello", 0.9, "Greeting");
    tracker.recordReplySelection();
    tracker.recordConversation(true);
    tracker.reset();
    const metrics = tracker.getMetrics();
    expect(metrics.gestureCount).toBe(0);
    expect(metrics.overallScore).toBe(15);
  });

  it("handles the 50-gesture sliding window gracefully", () => {
    for (let i = 0; i < 100; i++) {
      tracker.recordGesture(`Gesture ${i}`, 0.5 + Math.random() * 0.5, i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C");
    }
    const metrics = tracker.getMetrics();
    expect(metrics.gestureCount).toBe(100);
    expect(metrics.overallScore).toBeGreaterThan(0);
  });
});
