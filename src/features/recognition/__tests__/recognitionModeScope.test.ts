import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  allowedLabelsForMode,
  handsForMode,
  MODE_CONFIGS,
  MODE_ORDER,
  DEFAULT_MODE,
} from "../recognitionModes";
import { partitionLabels, assertPartition, numberDisplay } from "../labelPartition";

/**
 * The mode is the scope filter, and every list it drives comes from the model.
 *
 * The supported-characters panel used to hardcode "0123456789" — advertising a
 * ZERO the model has no class for, and omitting TEN, which it has. Nothing
 * failed, because nothing compared the list to the model. These tests are that
 * comparison.
 */

const LABELS: string[] = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs", "labels.json"),
    "utf-8",
  ),
).labels;

describe("label partition", () => {
  it("covers the model's label set exactly", () => {
    const partition = partitionLabels(LABELS);
    expect(() => assertPartition(LABELS, partition)).not.toThrow();

    const total = partition.letters.length + partition.numbers.length + partition.phrases.length;
    expect(total).toBe(LABELS.length);
    expect(LABELS.length).toBe(131);
  });

  it("splits 26 letters, 10 numbers, 95 phrases", () => {
    const { letters, numbers, phrases } = partitionLabels(LABELS);
    expect(letters).toHaveLength(26);
    expect(numbers).toHaveLength(10);
    expect(phrases).toHaveLength(95);
  });

  it("has no ZERO, and does have TEN", () => {
    // The exact bug the hardcoded "0123456789" row shipped.
    const { numbers } = partitionLabels(LABELS);
    expect(numbers).toContain("TEN");
    expect(LABELS).not.toContain("ZERO");
    expect(LABELS).not.toContain("0");
    expect(numbers.map(numberDisplay)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });

  it("orders numbers by count, not alphabetically", () => {
    // Sorted as strings, EIGHT would come first and TWO last.
    const { numbers } = partitionLabels(LABELS);
    expect(numbers[0]).toBe("ONE");
    expect(numbers[9]).toBe("TEN");
  });

  it("throws when a group goes missing rather than failing silently", () => {
    const partition = partitionLabels(LABELS);
    expect(() => assertPartition([...LABELS, "NEW CLASS"], partition)).toThrow(/does not cover/);
    expect(() => assertPartition(LABELS, { ...partition, numbers: [] })).toThrow();
  });

  it("puts every non-letter, non-number label in phrases", () => {
    const { phrases } = partitionLabels(LABELS);
    for (const p of ["THANK YOU", "GOOD MORNING", "HELLO", "RICE", "BLUE", "MONDAY"]) {
      expect(phrases, `${p} should be a phrase`).toContain(p);
    }
  });
});

describe("recognition modes", () => {
  it("offers exactly two, with no auto", () => {
    expect(MODE_ORDER).toEqual(["alphabet", "phrase-signs"]);
    expect(Object.keys(MODE_CONFIGS)).toHaveLength(2);
    expect(MODE_CONFIGS).not.toHaveProperty("auto");
  });

  it("defaults to alphabet, the path that works", () => {
    expect(DEFAULT_MODE).toBe("alphabet");
  });

  it("marks phrase signs as beta with an honest caveat, and alphabet as neither", () => {
    expect(MODE_CONFIGS["phrase-signs"].beta).toBe(true);
    expect(MODE_CONFIGS["phrase-signs"].caveat).toMatch(/experimental/i);
    expect(MODE_CONFIGS.alphabet.beta).toBeFalsy();
    expect(MODE_CONFIGS.alphabet.caveat).toBeUndefined();
  });

  it("alphabet allows the 36 character classes", () => {
    const allowed = allowedLabelsForMode("alphabet", LABELS);
    expect(allowed.size).toBe(36);
    expect(allowed.has("a")).toBe(true);
    expect(allowed.has("ONE")).toBe(true);
    expect(allowed.has("TEN")).toBe(true);
    expect(allowed.has("THANK YOU")).toBe(false);
  });

  it("phrase signs allows the 95 phrase classes and no characters", () => {
    const allowed = allowedLabelsForMode("phrase-signs", LABELS);
    expect(allowed.size).toBe(95);
    expect(allowed.has("THANK YOU")).toBe(true);
    // A phrase mode admitting letters would let a stray "a" beat the phrase
    // actually being signed.
    expect(allowed.has("a")).toBe(false);
    expect(allowed.has("ONE")).toBe(false);
  });

  it("the two modes together cover the model exactly once", () => {
    const alphabet = allowedLabelsForMode("alphabet", LABELS);
    const phrases = allowedLabelsForMode("phrase-signs", LABELS);
    expect(alphabet.size + phrases.size).toBe(LABELS.length);
    for (const l of alphabet) expect(phrases.has(l)).toBe(false);
  });

  it("tracks one hand for alphabet, two for phrase signs", () => {
    expect(handsForMode("alphabet")).toBe(1);
    expect(handsForMode("phrase-signs")).toBe(2);
  });

  it("defaults to one hand for alphabet when the flag is omitted", () => {
    // The default is load-bearing: two hands costs about a third of the frame
    // rate (342ms vs 631ms per detection), so it must be opt-in.
    expect(handsForMode("alphabet")).toBe(1);
    expect(handsForMode("alphabet", false)).toBe(1);
  });

  it("lets alphabet opt in to a second hand", () => {
    expect(handsForMode("alphabet", true)).toBe(2);
  });

  it("keeps phrase signs on two hands whatever the flag says", () => {
    // 93% of phrase sequences in the v4 training split carry both hands, so
    // one is not a supported configuration for them at any setting.
    expect(handsForMode("phrase-signs", false)).toBe(2);
    expect(handsForMode("phrase-signs", true)).toBe(2);
  });
});
