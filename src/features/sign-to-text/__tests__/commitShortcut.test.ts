import { describe, expect, it } from "vitest";
import { isTranscriptCommitShortcut } from "../commitShortcut";

describe("isTranscriptCommitShortcut", () => {
  it("matches the configured key without modifiers", () => {
    expect(isTranscriptCommitShortcut({ code: "Space", altKey: false, ctrlKey: false, metaKey: false }, "Space")).toBe(true);
    expect(isTranscriptCommitShortcut({ code: "KeyK", altKey: false, ctrlKey: false, metaKey: false }, "Space")).toBe(false);
  });

  it("does not commit when a modifier is held", () => {
    expect(isTranscriptCommitShortcut({ code: "Enter", altKey: false, ctrlKey: true, metaKey: false }, "Enter")).toBe(false);
  });
});