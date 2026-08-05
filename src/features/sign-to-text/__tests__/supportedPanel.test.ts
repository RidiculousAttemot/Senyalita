import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { partitionLabels, numberDisplay } from "@/features/recognition/labelPartition";
import { allowedLabelsForMode, type RecognitionMode } from "@/features/recognition/recognitionModes";

/**
 * The supported panel must advertise exactly what the active mode can predict.
 *
 * It previously hardcoded "0123456789": a ZERO the model has no class for, and
 * no TEN, which it has. Nothing failed, because nothing compared the two. This
 * is that comparison, expressed as the rule the panel renders by — alphabet
 * mode lists letters + numbers, phrase mode lists phrases — so a mismatch
 * between what is shown and what is recognisable becomes a test failure.
 */

const LABELS: string[] = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs", "labels.json"),
    "utf-8",
  ),
).labels;

/** What the panel renders for a mode, in source-label terms. */
function panelContents(mode: RecognitionMode, allLabels: readonly string[]): string[] {
  const { letters, numbers, phrases } = partitionLabels(allLabels);
  return mode === "phrase-signs" ? phrases : [...letters, ...numbers];
}

describe("supported panel follows the mode", () => {
  for (const mode of ["alphabet", "phrase-signs"] as const) {
    it(`${mode}: everything shown is predictable, and everything predictable is shown`, () => {
      const shown = panelContents(mode, LABELS);
      const allowed = allowedLabelsForMode(mode, LABELS);

      const advertisedButUnrecognisable = shown.filter((l) => !allowed.has(l));
      expect(
        advertisedButUnrecognisable,
        `panel advertises classes the mode cannot predict: ${advertisedButUnrecognisable.join(", ")}`,
      ).toEqual([]);

      const recognisableButHidden = [...allowed].filter((l) => !shown.includes(l));
      expect(
        recognisableButHidden,
        `mode can predict classes the panel hides: ${recognisableButHidden.join(", ")}`,
      ).toEqual([]);
    });
  }

  it("alphabet shows 26 letters and 10 numbers, displayed 1-10", () => {
    const { letters, numbers } = partitionLabels(LABELS);
    expect(letters).toHaveLength(26);
    expect(numbers).toHaveLength(10);

    const displayed = numbers.map(numberDisplay);
    expect(displayed).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    // The two halves of the original bug.
    expect(displayed).not.toContain("0");
    expect(displayed).toContain("10");
  });

  it("phrase mode shows all 95 and no characters", () => {
    const shown = panelContents("phrase-signs", LABELS);
    expect(shown).toHaveLength(95);
    expect(shown.some((l) => l.length === 1)).toBe(false);
    expect(shown).not.toContain("ONE");
    expect(shown).toContain("THANK YOU");
  });

  it("the two modes' panels together cover the model exactly once", () => {
    const a = panelContents("alphabet", LABELS);
    const p = panelContents("phrase-signs", LABELS);
    expect(a.length + p.length).toBe(LABELS.length);
    expect(new Set([...a, ...p]).size).toBe(LABELS.length);
  });

  it("no list is hardcoded — a changed model changes the panel", () => {
    // Passing a different label set must produce different contents. A
    // hardcoded array would ignore this and return the same thing.
    const pretend = ["a", "b", "ONE", "TWO", "SOMETHING NEW"];
    const alphabet = panelContents("alphabet", pretend);
    const phrases = panelContents("phrase-signs", pretend);
    expect(alphabet).toEqual(["a", "b", "ONE", "TWO"]);
    expect(phrases).toEqual(["SOMETHING NEW"]);
  });
});
