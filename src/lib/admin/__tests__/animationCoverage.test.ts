import { describe, expect, it } from "vitest";
import { computeAnimationCoverage, coverageKey } from "../animationCoverage";
import { MODEL_LABELS } from "../modelLabels";

describe("coverageKey", () => {
  it("treats the underscore and space spellings as one gloss", () => {
    // The bug this guards: clients cache THANK_YOU, the database stores
    // THANK YOU. Comparing raw strings under-counted every multi-word sign.
    expect(coverageKey("THANK_YOU")).toBe(coverageKey("thank you"));
  });
});

describe("computeAnimationCoverage", () => {
  it("counts a published gloss regardless of how it is spelled", () => {
    const coverage = computeAnimationCoverage(["THANK YOU", "a"], ["THANK_YOU"]);
    expect(coverage.published).toBe(1);
    expect(coverage.total).toBe(2);
  });

  it("does not count a gloss that has no published version", () => {
    // The old card counted every animation_assets row, so an upload left as a
    // draft raised coverage. Only publishing makes a sign visible.
    const coverage = computeAnimationCoverage(["HELLO"], []);
    expect(coverage.published).toBe(0);
    expect(coverage.groups[0].missing).toEqual(["HELLO"]);
  });

  it("separates the alphabet, numbers, and words and phrases", () => {
    const coverage = computeAnimationCoverage(["a", "b", "ONE", "HELLO"], ["a"]);
    expect(coverage.groups.find((g) => g.name === "Alphabet")).toMatchObject({ total: 2, published: 1, missing: ["b"] });
    expect(coverage.groups.find((g) => g.name === "Numbers")).toMatchObject({ total: 1, published: 0 });
    expect(coverage.groups.find((g) => g.name === "Words and phrases")).toMatchObject({ total: 1, published: 0, missing: ["HELLO"] });
  });

  it("matches the model's number words to the library's digits", () => {
    // The model labels these ONE..TEN; the library publishes "1".."10". Without
    // the mapping every number was counted missing AND listed as unrecognised.
    const coverage = computeAnimationCoverage(["ONE", "TEN"], ["1", "10"]);
    expect(coverage.published).toBe(2);
    expect(coverage.unrecognised).toEqual([]);
  });

  it("leaves published ZERO uncounted, because the model has no such class", () => {
    // A real, documented asymmetry (ZERO_IS_TEXT_TO_SIGN_ONLY): Type-to-Sign
    // plays 0-10, Sign-to-Text only recognises 1-10. The report should surface
    // it, not hide it.
    const coverage = computeAnimationCoverage(["ONE"], ["1", "0"]);
    expect(coverage.published).toBe(1);
    expect(coverage.unrecognised).toEqual(["0"]);
  });

  it("reports a published gloss the model cannot recognise, without counting it", () => {
    const coverage = computeAnimationCoverage(["a"], ["a", "SOMETHING ELSE"]);
    expect(coverage.published).toBe(1);
    expect(coverage.percent).toBe(100);
    expect(coverage.unrecognised).toEqual(["SOMETHING ELSE"]);
  });

  it("never rounds an incomplete library up to 100%", () => {
    const labels = Array.from({ length: 131 }, (_, i) => `SIGN ${i}`);
    const coverage = computeAnimationCoverage(labels, labels.slice(0, 130));
    expect(coverage.percent).toBe(99);
  });

  it("handles an empty label list without dividing by zero", () => {
    expect(computeAnimationCoverage([], []).percent).toBe(0);
  });

  it("measures against the deployed model, not a hardcoded dictionary", () => {
    // The previous card's denominator was WORD_TO_GLOSS (211 entries), which
    // describes what the translator will attempt to look up — not what the
    // recognition model knows. If these drift apart again, this fails.
    const coverage = computeAnimationCoverage(MODEL_LABELS, []);
    expect(coverage.total).toBe(MODEL_LABELS.length);
    expect(coverage.total).toBe(131);
  });
});
