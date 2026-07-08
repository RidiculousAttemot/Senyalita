import { describe, it, expect, beforeEach } from "vitest";
import { AnimationUsageTracker } from "../animationTracker";

describe("AnimationUsageTracker", () => {
  let tracker: AnimationUsageTracker;

  beforeEach(() => {
    tracker = new AnimationUsageTracker();
    tracker.clear();
  });

  it("starts empty", () => {
    const stats = tracker.getOverallStats();
    expect(stats.totalPlays).toBe(0);
    expect(stats.totalReplays).toBe(0);
  });

  it("tracks play events", () => {
    tracker.recordPlay("HELLO", "minimal");
    tracker.recordPlay("THANK YOU", "skeleton");
    const stats = tracker.getOverallStats();
    expect(stats.totalPlays).toBe(2);
  });

  it("tracks replay events", () => {
    tracker.recordPlay("HELLO", "minimal");
    tracker.recordReplay("HELLO", "minimal");
    const stats = tracker.getOverallStats();
    expect(stats.totalPlays).toBe(1);
    expect(stats.totalReplays).toBe(1);
  });

  it("tracks completions and interruptions", () => {
    tracker.recordPlay("HELLO", "minimal");
    tracker.recordComplete("HELLO", 2000, "minimal");
    tracker.recordPlay("BYE", "flat");
    tracker.recordInterrupt("BYE", 500, "flat");
    const stats = tracker.getOverallStats();
    expect(stats.totalCompletions).toBe(1);
    expect(stats.totalInterruptions).toBe(1);
  });

  it("computes per-gesture stats", () => {
    tracker.recordPlay("HELLO", "minimal");
    tracker.recordComplete("HELLO", 2000, "minimal");
    tracker.recordPlay("HELLO", "minimal");
    tracker.recordComplete("HELLO", 1800, "minimal");

    const gestureStats = tracker.getGestureStats("HELLO");
    expect(gestureStats.totalPlays).toBe(2);
    expect(gestureStats.completions).toBe(2);
    expect(gestureStats.completionRate).toBe(1);
    expect(gestureStats.averageDuration).toBe(1900);
  });

  it("tracks preferred avatar styles", () => {
    tracker.recordPlay("HELLO", "minimal");
    tracker.recordPlay("HELLO", "skeleton");
    tracker.recordPlay("HELLO", "minimal");
    const stats = tracker.getGestureStats("HELLO");
    expect(stats.preferredStyles.minimal).toBe(2);
    expect(stats.preferredStyles.skeleton).toBe(1);
  });

  it("finds least completed gestures", () => {
    tracker.recordPlay("A", "minimal");
    tracker.recordInterrupt("A", 100, "minimal");
    tracker.recordPlay("B", "minimal");
    tracker.recordComplete("B", 500, "minimal");

    const stats = tracker.getOverallStats();
    expect(stats.leastCompletedGestures.length).toBeGreaterThanOrEqual(1);
    const least = stats.leastCompletedGestures[0];
    expect(least.gestureLabel).toBe("A");
    expect(least.completionRate).toBe(0);
  });

  it("returns all events", () => {
    tracker.recordPlay("A", "minimal");
    tracker.recordPlay("B", "minimal");
    expect(tracker.getAllEvents().length).toBe(2);
  });

  it("clears all data", () => {
    tracker.recordPlay("A", "minimal");
    tracker.clear();
    expect(tracker.getAllEvents().length).toBe(0);
  });
});
