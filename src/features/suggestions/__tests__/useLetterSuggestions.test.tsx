import { describe, expect, it, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLetterSuggestions } from "../useLetterSuggestions";

describe("useLetterSuggestions", () => {
  beforeEach(() => window.localStorage.clear());

  it("builds a word one recognised letter at a time", () => {
    const { result } = renderHook(() => useLetterSuggestions());

    for (const letter of ["H", "O", "W"]) {
      act(() => result.current.appendLabel(letter));
    }

    expect(result.current.letters).toBe("HOW");
  });

  it("treats NG as one sign contributing two characters", () => {
    const { result } = renderHook(() => useLetterSuggestions());

    act(() => result.current.appendLabel("N"));
    act(() => result.current.appendLabel("NG"));
    expect(result.current.letters).toBe("NNG");

    // Backspace removes the whole NG sign, not half of it.
    act(() => result.current.backspace());
    expect(result.current.letters).toBe("N");
  });

  it("ignores labels that are not spellable characters", () => {
    const { result } = renderHook(() => useLetterSuggestions());

    act(() => result.current.appendLabel("A"));
    act(() => result.current.appendLabel("  "));
    act(() => result.current.appendLabel("?"));

    expect(result.current.letters).toBe("A");
  });

  it("surfaces a phrase suggestion as letters accumulate", () => {
    const { result } = renderHook(() => useLetterSuggestions());

    for (const letter of "HOWAREYOU".split("")) {
      act(() => result.current.appendLabel(letter));
    }

    expect(result.current.topSuggestion?.phrase).toBe("HOW ARE YOU");
  });

  it("clears the buffer when a suggestion is accepted", () => {
    const { result } = renderHook(() => useLetterSuggestions());

    for (const letter of "THANKYOU".split("")) {
      act(() => result.current.appendLabel(letter));
    }
    expect(result.current.letters).not.toBe("");

    act(() => { result.current.accept("THANK YOU"); });
    expect(result.current.letters).toBe("");
  });

  it("remembers accepted phrases across mounts", () => {
    const first = renderHook(() => useLetterSuggestions());
    act(() => { first.result.current.accept("THANK YOU"); });

    const second = renderHook(() => useLetterSuggestions());
    expect(window.localStorage.getItem("senyalita.suggestionUsage.v1")).toContain("THANK YOU");
    expect(second.result.current.letters).toBe("");
  });

  it("clears without recording usage", () => {
    const { result } = renderHook(() => useLetterSuggestions());

    act(() => result.current.appendLabel("H"));
    act(() => result.current.clear());

    expect(result.current.letters).toBe("");
    expect(window.localStorage.getItem("senyalita.suggestionUsage.v1")).toBeNull();
  });
});
