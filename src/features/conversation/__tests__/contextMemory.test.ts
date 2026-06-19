import { describe, it, expect, beforeEach } from "vitest";
import { ContextMemory } from "../contextMemory";

describe("ContextMemory", () => {
  let memory: ContextMemory;

  beforeEach(() => {
    memory = new ContextMemory();
  });

  it("starts empty", () => {
    expect(memory.size).toBe(0);
    expect(memory.hasContent()).toBe(false);
    expect(memory.getContext()).toEqual([]);
  });

  it("stores a message", () => {
    memory.addMessage("Hello", "Hello", 0.9, "Greeting");
    expect(memory.size).toBe(1);
    expect(memory.hasContent()).toBe(true);
    const ctx = memory.getContext();
    expect(ctx[0].gestureLabel).toBe("Hello");
    expect(ctx[0].translatedText).toBe("Hello");
    expect(ctx[0].confidence).toBe(0.9);
    expect(ctx[0].intent).toBe("Greeting");
  });

  it("maintains last 10 messages", () => {
    for (let i = 0; i < 12; i++) {
      memory.addMessage(`Gesture ${i}`, `Text ${i}`, 0.8);
    }
    expect(memory.size).toBe(10);
    const ctx = memory.getContext();
    expect(ctx[0].gestureLabel).toBe("Gesture 2");
    expect(ctx[9].gestureLabel).toBe("Gesture 11");
  });

  it("getRecentContext returns last N messages", () => {
    for (let i = 0; i < 10; i++) {
      memory.addMessage(`Gesture ${i}`, `Text ${i}`, 0.8);
    }
    const recent = memory.getRecentContext(3);
    expect(recent.length).toBe(3);
    expect(recent[0].gestureLabel).toBe("Gesture 7");
    expect(recent[2].gestureLabel).toBe("Gesture 9");
  });

  it("clearContext resets everything", () => {
    memory.addMessage("Hello", "Hello", 0.9, "Greeting");
    memory.clearContext();
    expect(memory.size).toBe(0);
    expect(memory.hasContent()).toBe(false);
  });

  it("getTopics returns unique non-Unknown intents", () => {
    memory.addMessage("Hello", "Hello", 0.9, "Greeting");
    memory.addMessage("Goodbye", "Goodbye", 0.8, "Farewell");
    memory.addMessage("Food", "Food", 0.7, "Food");
    memory.addMessage("Hello", "Hello", 0.9, "Greeting");
    const topics = memory.getTopics();
    expect(topics).toContain("Greeting");
    expect(topics).toContain("Farewell");
    expect(topics).toContain("Food");
    expect(topics.length).toBe(3);
  });

  it("getTopics excludes Unknown intent", () => {
    memory.addMessage("xyzzy", "xyzzy", 0.5);
    const topics = memory.getTopics();
    expect(topics.length).toBe(0);
  });

  it("message has a timestamp", () => {
    const before = Date.now();
    memory.addMessage("Hello", "Hello", 0.9);
    const after = Date.now();
    const ctx = memory.getContext();
    expect(ctx[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(ctx[0].timestamp).toBeLessThanOrEqual(after);
  });
});
