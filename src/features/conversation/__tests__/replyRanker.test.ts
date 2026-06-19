import { describe, it, expect, beforeEach } from "vitest";
import { ReplyRanker, CONTEXTUAL_REPLIES } from "../replyRanker";
import type { ContextMessage } from "../types";
import type { ReplySource } from "../replyRanker";

describe("CONTEXTUAL_REPLIES", () => {
  it("has replies for Greeting", () => {
    expect(CONTEXTUAL_REPLIES.Greeting.length).toBeGreaterThan(0);
  });

  it("has replies for Emergency", () => {
    expect(CONTEXTUAL_REPLIES.Emergency.length).toBeGreaterThan(0);
  });

  it("returns undefined for Unknown intent", () => {
    expect(CONTEXTUAL_REPLIES.Unknown).toBeUndefined();
  });
});

describe("ReplyRanker", () => {
  let ranker: ReplyRanker;
  let replies: ReplySource[];

  beforeEach(() => {
    ranker = new ReplyRanker();
    replies = [
      { text: "You're welcome", gestureLabel: "THANK YOU", videoUrl: null, priority: 1, contextTags: ["polite"] },
      { text: "Hello!", gestureLabel: "HELLO", videoUrl: null, priority: 1, contextTags: ["greeting"] },
      { text: "I'm fine", gestureLabel: "HOW ARE YOU", videoUrl: null, priority: 2, contextTags: ["response"] },
    ];
  });

  it("returns empty array for no replies", () => {
    const result = ranker.rank("HELLO", [], [], "en");
    expect(result).toEqual([]);
  });

  it("scores replies by priority", () => {
    const result = ranker.rank("HELLO", replies, [], "en");
    expect(result.length).toBe(3);
    expect(result[0].score).toBeGreaterThanOrEqual(0);
    expect(result[0].source).toBe("gesture");
  });

  it("boosts intent-matching replies", () => {
    const result = ranker.rank("HELLO", replies, [], "en");
    const helloReply = result.find(r => r.text === "Hello!");
    const otherReply = result.find(r => r.text === "You're welcome");
    expect(helloReply).toBeDefined();
    expect(otherReply).toBeDefined();
  });

  it("boosts context-matching replies", () => {
    const context: ContextMessage[] = [
      { gestureLabel: "How are you", translatedText: "How are you", confidence: 0.9, timestamp: Date.now(), intent: "Question" },
    ];
    const result = ranker.rank("HOW ARE YOU", replies, context, "en");
    expect(result.length).toBe(3);
  });

  it("boosts historically selected replies", () => {
    const history = { selectedReplies: ["I'm fine"] };
    const result = ranker.rank("HOW ARE YOU", replies, [], "en", history);
    const preferred = result.find(r => r.text === "I'm fine");
    expect(preferred).toBeDefined();
    expect(preferred!.source).toBe("personalized");
  });

  it("boosts Tagalog replies for tl language", () => {
    const tagalogReplies: ReplySource[] = [
      { text: "Salamat", gestureLabel: "THANK YOU", videoUrl: null, priority: 1, contextTags: ["polite"] },
      { text: "Walang anuman", gestureLabel: "THANK YOU", videoUrl: null, priority: 1, contextTags: ["polite"] },
    ];
    const result = ranker.rank("THANK YOU", tagalogReplies, [], "tl");
    expect(result.length).toBe(2);
    expect(result[0].text).toBe("Salamat");
  });

  it("caps score at 1.0", () => {
    const highPriority: ReplySource[] = [
      { text: "Hello!", gestureLabel: "HELLO", videoUrl: null, priority: 100, contextTags: ["greeting"] },
    ];
    const result = ranker.rank("HELLO", highPriority, [], "en");
    expect(result[0].score).toBeLessThanOrEqual(1);
  });

  it("sorts descending by score", () => {
    const varied: ReplySource[] = [
      { text: "Low", gestureLabel: "UNKNOWN", videoUrl: null, priority: 0, contextTags: [] },
      { text: "High", gestureLabel: "HELLO", videoUrl: null, priority: 5, contextTags: ["greeting"] },
    ];
    const result = ranker.rank("HELLO", varied, [], "en");
    expect(result[0].text).toBe("High");
    expect(result[1].text).toBe("Low");
  });
});
