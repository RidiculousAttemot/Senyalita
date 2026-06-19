import { describe, it, expect } from "vitest";
import { detectIntent, detectIntentFromContext } from "../intentEngine";
import type { ContextMessage } from "../types";

describe("detectIntent", () => {
  it("detects Greeting intent", () => {
    const result = detectIntent("Hello");
    expect(result.intent).toBe("Greeting");
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("detects Greeting for 'how are you'", () => {
    const result = detectIntent("How are you");
    expect(result.intent).toBe("Greeting");
  });

  it("detects Farewell intent", () => {
    const result = detectIntent("Goodbye");
    expect(result.intent).toBe("Farewell");
  });

  it("detects Emergency intent for 'emergency'", () => {
    const result = detectIntent("Emergency");
    expect(result.intent).toBe("Emergency");
  });

  it("detects Food intent for exact food keyword", () => {
    const result = detectIntent("Food");
    expect(result.intent).toBe("Food");
  });

  it("detects Request for 'help' (Request intent comes first in keyword map)", () => {
    const result = detectIntent("Help");
    expect(result.intent).toBe("Request");
  });

  it("detects Healthcare intent", () => {
    const result = detectIntent("Doctor");
    expect(result.intent).toBe("Healthcare");
  });

  it("detects Education intent", () => {
    const result = detectIntent("School");
    expect(result.intent).toBe("Education");
  });

  it("detects Question intent", () => {
    const result = detectIntent("What is your name");
    expect(result.intent).toBe("Question");
  });

  it("detects Response intent", () => {
    const result = detectIntent("Yes");
    expect(result.intent).toBe("Response");
  });

  it("detects Transportation intent", () => {
    const result = detectIntent("Bus");
    expect(result.intent).toBe("Transportation");
  });

  it("returns Unknown for empty string", () => {
    const result = detectIntent("");
    expect(result.intent).toBe("Unknown");
    expect(result.confidence).toBe(0);
  });

  it("returns Unknown for unrelated text", () => {
    const result = detectIntent("xyzzy");
    expect(result.intent).toBe("Unknown");
  });

  it("is case insensitive", () => {
    const result = detectIntent("HELLO");
    expect(result.intent).toBe("Greeting");
  });

  it("gives 0.95 for exact keyword match", () => {
    const result = detectIntent("thank you");
    expect(result.confidence).toBe(0.95);
  });

  it("gives 0.75 for partial match", () => {
    const result = detectIntent("I need a doctor please");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });
});

describe("detectIntentFromContext", () => {
  it("returns Unknown for empty context", () => {
    const result = detectIntentFromContext([]);
    expect(result.intent).toBe("Unknown");
    expect(result.confidence).toBe(0);
  });

  it("detects dominant intent from recent messages", () => {
    const messages: ContextMessage[] = [
      { gestureLabel: "Hello", translatedText: "Hello", confidence: 0.9, timestamp: 1000 },
      { gestureLabel: "How are you", translatedText: "How are you", confidence: 0.85, timestamp: 2000 },
    ];
    const result = detectIntentFromContext(messages);
    expect(result.intent).toBe("Greeting");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("weighs higher confidence messages more", () => {
    const messages: ContextMessage[] = [
      { gestureLabel: "Food", translatedText: "Food", confidence: 0.3, timestamp: 1000 },
      { gestureLabel: "Doctor", translatedText: "Doctor", confidence: 0.95, timestamp: 2000 },
    ];
    const result = detectIntentFromContext(messages);
    expect(result.intent).toBe("Healthcare");
  });

  it("ignores Unknown intents in scoring", () => {
    const messages: ContextMessage[] = [
      { gestureLabel: "xyzzy", translatedText: "xyzzy", confidence: 0.9, timestamp: 1000 },
    ];
    const result = detectIntentFromContext(messages);
    expect(result.intent).toBe("Unknown");
    expect(result.confidence).toBe(0);
  });

  it("only considers last 5 messages", () => {
    const messages: ContextMessage[] = Array.from({ length: 10 }, (_, i) => ({
      gestureLabel: i < 5 ? "Hello" : "Goodbye",
      translatedText: i < 5 ? "Hello" : "Goodbye",
      confidence: 0.9,
      timestamp: 1000 + i,
    }));
    const result = detectIntentFromContext(messages);
    expect(result.intent).toBe("Farewell");
  });
});
