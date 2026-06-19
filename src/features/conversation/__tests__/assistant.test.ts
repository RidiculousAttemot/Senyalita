import { describe, it, expect, beforeEach } from "vitest";
import { ConversationAssistant } from "../../assistant";

describe("ConversationAssistant", () => {
  let assistant: ConversationAssistant;

  beforeEach(() => {
    assistant = new ConversationAssistant({ language: "en" });
  });

  it("initializes with empty state", () => {
    expect(assistant.getContext()).toEqual([]);
    expect(assistant.getCurrentIntent().intent).toBe("Unknown");
  });

  it("records a gesture and updates context", () => {
    assistant.recordGesture("Hello", "Hello", 0.9);
    const context = assistant.getContext();
    expect(context.length).toBe(1);
    expect(context[0].gestureLabel).toBe("Hello");
    expect(context[0].translatedText).toBe("Hello");
    expect(context[0].confidence).toBe(0.9);
  });

  it("detects intent from recorded gestures", () => {
    assistant.recordGesture("Hello", "Hello", 0.9);
    assistant.recordGesture("How are you", "How are you", 0.85);
    const intent = assistant.getCurrentIntent();
    expect(intent.intent).toBe("Greeting");
    expect(intent.confidence).toBeGreaterThan(0);
  });

  it("returns recent context", () => {
    assistant.recordGesture("Hello", "Hello", 0.9);
    assistant.recordGesture("Goodbye", "Goodbye", 0.8);
    const recent = assistant.getRecentContext(1);
    expect(recent.length).toBe(1);
    expect(recent[0].gestureLabel).toBe("Goodbye");
  });

  it("returns contextual replies for known intents", () => {
    const replies = assistant.getContextualReplies("Greeting");
    expect(replies.length).toBeGreaterThan(0);
    expect(replies).toContain("I'm fine, thank you!");
  });

  it("returns empty replies for unknown intents", () => {
    const replies = assistant.getContextualReplies("Unknown" as any);
    expect(replies).toEqual([]);
  });

  it("tracks quality score", () => {
    assistant.recordGesture("Hello", "Hello", 0.9);
    assistant.recordGesture("Goodbye", "Goodbye", 0.8);
    assistant.recordReplySelection("Hello", true);
    const score = assistant.getQualityScore();
    expect(score.overallScore).toBeGreaterThan(0);
    expect(score.gestureCount).toBe(2);
  });

  it("generates conversation summary", () => {
    assistant.recordGesture("Hello", "Hello", 0.9);
    assistant.recordGesture("Doctor", "Doctor", 0.8);
    const summary = assistant.getConversationSummary();
    expect(summary.gestureCount).toBe(2);
    expect(summary.topTopics.length).toBeGreaterThan(0);
  });

  it("generates formatted summary", () => {
    assistant.recordGesture("Hello", "Hello", 0.9);
    const formatted = assistant.getFormattedSummary();
    expect(formatted).toContain("Conversation Summary");
    expect(formatted).toContain("Greeting");
  });

  it("returns topics", () => {
    assistant.recordGesture("Hello", "Hello", 0.9);
    assistant.recordGesture("Doctor", "Doctor", 0.8);
    const topics = assistant.getTopics();
    expect(topics).toContain("Greeting");
    expect(topics).toContain("Healthcare");
  });

  it("resets session state", () => {
    assistant.recordGesture("Hello", "Hello", 0.9);
    assistant.recordConversation(true);
    assistant.resetSession();
    expect(assistant.getContext()).toEqual([]);
    expect(assistant.getQualityScore().gestureCount).toBe(0);
    expect(assistant.getCurrentIntent().intent).toBe("Unknown");
  });

  it("handles Tagalog language config", () => {
    const tlAssistant = new ConversationAssistant({ language: "tl" });
    expect(tlAssistant.getContext()).toEqual([]);
  });
});
