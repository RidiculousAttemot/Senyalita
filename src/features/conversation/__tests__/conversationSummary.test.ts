import { describe, it, expect } from "vitest";
import { generateSummary, formatSummary } from "../conversationSummary";
import type { ContextMessage } from "../types";

describe("generateSummary", () => {
  const startTime = 0;
  const endTime = 60000;

  it("returns empty summary for no messages", () => {
    const summary = generateSummary([], startTime, endTime);
    expect(summary.gestureCount).toBe(0);
    expect(summary.topTopics).toEqual([]);
    expect(summary.duration).toBe("0 minutes");
    expect(summary.avgConfidence).toBe(0);
    expect(summary.suggestedFollowUp).toBe("Start a conversation to receive suggestions.");
  });

  it("computes gesture count and duration", () => {
    const messages: ContextMessage[] = [
      { gestureLabel: "Hello", translatedText: "Hello", confidence: 0.9, timestamp: startTime + 1000 },
      { gestureLabel: "Goodbye", translatedText: "Goodbye", confidence: 0.8, timestamp: startTime + 5000 },
    ];
    const summary = generateSummary(messages, startTime, endTime);
    expect(summary.gestureCount).toBe(2);
    expect(summary.duration).toBe("1m 0s");
  });

  it("identifies top topics", () => {
    const messages: ContextMessage[] = [
      { gestureLabel: "Hello", translatedText: "Hello", confidence: 0.9, timestamp: startTime + 1000 },
      { gestureLabel: "Good Morning", translatedText: "Good Morning", confidence: 0.85, timestamp: startTime + 2000 },
      { gestureLabel: "Doctor", translatedText: "Doctor", confidence: 0.8, timestamp: startTime + 3000 },
    ];
    const summary = generateSummary(messages, startTime, endTime);
    expect(summary.topTopics.length).toBeGreaterThan(0);
    expect(summary.topTopics.some(t => t.topic === "Greeting")).toBe(true);
    expect(summary.topTopics.some(t => t.topic === "Healthcare")).toBe(true);
  });

  it("computes average confidence", () => {
    const messages: ContextMessage[] = [
      { gestureLabel: "Hello", translatedText: "Hello", confidence: 0.9, timestamp: 1000 },
      { gestureLabel: "Goodbye", translatedText: "Goodbye", confidence: 0.7, timestamp: 2000 },
    ];
    const summary = generateSummary(messages, 0, 10000);
    expect(summary.avgConfidence).toBe(0.8);
  });

  it("generates transcript with timestamps", () => {
    const messages: ContextMessage[] = [
      { gestureLabel: "Hello", translatedText: "Hello", confidence: 0.9, timestamp: startTime + 1000 },
    ];
    const summary = generateSummary(messages, startTime, endTime);
    expect(summary.transcript.length).toBe(1);
    expect(summary.transcript[0].text).toBe("Hello");
  });

  it("generates healthcare follow-up", () => {
    const messages: ContextMessage[] = [
      { gestureLabel: "Doctor", translatedText: "Doctor", confidence: 0.9, timestamp: 1000 },
    ];
    const summary = generateSummary(messages, 0, 10000);
    expect(summary.suggestedFollowUp.toLowerCase()).toContain("healthcare");
  });

  it("generates food follow-up", () => {
    const messages: ContextMessage[] = [
      { gestureLabel: "Food", translatedText: "Food", confidence: 0.9, timestamp: 1000 },
    ];
    const summary = generateSummary(messages, 0, 10000);
    expect(summary.suggestedFollowUp.toLowerCase()).toContain("food");
  });

  it("generates greeting/Introduction follow-up", () => {
    const messages: ContextMessage[] = [
      { gestureLabel: "Hello", translatedText: "Hello", confidence: 0.9, timestamp: 1000 },
      { gestureLabel: "Nice to meet you", translatedText: "Nice to meet you", confidence: 0.85, timestamp: 2000 },
    ];
    const summary = generateSummary(messages, 0, 10000);
    expect(summary.suggestedFollowUp.toLowerCase()).toContain("conversation basics");
  });

  it("uses sorted topics (most frequent first)", () => {
    const messages: ContextMessage[] = [
      { gestureLabel: "Hello", translatedText: "Hello", confidence: 0.9, timestamp: 1000 },
      { gestureLabel: "Hello", translatedText: "Hello", confidence: 0.8, timestamp: 2000 },
      { gestureLabel: "Goodbye", translatedText: "Goodbye", confidence: 0.7, timestamp: 3000 },
    ];
    const summary = generateSummary(messages, 0, 10000);
    expect(summary.topTopics[0].topic).toBe("Greeting");
    expect(summary.topTopics[0].count).toBe(2);
  });
});

describe("formatSummary", () => {
  it("produces a multi-line string", () => {
    const summary = generateSummary(
      [{ gestureLabel: "Hello", translatedText: "Hello", confidence: 0.9, timestamp: 1000 }],
      0,
      10000
    );
    const formatted = formatSummary(summary);
    expect(formatted).toContain("Conversation Summary");
    expect(formatted).toContain("Duration:");
    expect(formatted).toContain("Gestures: 1");
    expect(formatted).toContain("Top Topics:");
    expect(formatted).toContain("Suggested Follow-up:");
  });

  it("shows 'None detected' when no topics", () => {
    const summary = generateSummary([], 0, 1000);
    const formatted = formatSummary(summary);
    expect(formatted).toContain("None detected");
  });
});
