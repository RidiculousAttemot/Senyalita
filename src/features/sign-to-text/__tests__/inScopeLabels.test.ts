import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  IN_SCOPE_SOURCE_LABELS,
  IN_SCOPE_DISPLAY_LABELS,
  isInScope,
  isNumberSign,
} from "../inScopeLabels";

/**
 * Pins the Sign-to-Text scope: 26 letters + 10 number signs = 36 of the
 * model's 131 classes, filtered in the app rather than the model.
 */

const LABELS: string[] = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs", "labels.json"),
    "utf-8",
  ),
).labels;

describe("Sign-to-Text label scope", () => {
  it("covers exactly 36 classes", () => {
    expect(IN_SCOPE_SOURCE_LABELS).toHaveLength(36);
    expect(IN_SCOPE_DISPLAY_LABELS.size).toBe(36);
  });

  it("every in-scope source label exists in the deployed model", () => {
    const missing = IN_SCOPE_SOURCE_LABELS.filter((l) => !LABELS.includes(l));
    expect(missing, `not in labels.json: ${missing.join(", ")}`).toEqual([]);
  });

  it("leaves the model's other classes intact — the app filters, the model does not", () => {
    // The filter must not be mistaken for a model change: /evaluation still
    // needs all 131 for the thesis numbers.
    expect(LABELS.length).toBe(131);
    expect(LABELS).toContain("THANK YOU");
    expect(isInScope("THANK YOU")).toBe(false);
  });

  it("accepts letters and numbers in their display form", () => {
    for (const letter of "abcdefghijklmnopqrstuvwxyz") expect(isInScope(letter)).toBe(true);
    for (const n of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]) {
      expect(isInScope(n), `${n} should be in scope`).toBe(true);
    }
  });

  it("rejects phrase classes", () => {
    for (const phrase of ["THANK YOU", "GOOD MORNING", "HELLO", "RICE", "BLUE"]) {
      expect(isInScope(phrase), `${phrase} should be filtered`).toBe(false);
    }
  });

  it("filters on display form, because that is what reaches the consumer", () => {
    // Predictions are display-mapped before leaving the recognition layer, so
    // "ONE" never arrives — matching source labels here would drop every number.
    expect(isInScope("ONE")).toBe(false);
    expect(isInScope("1")).toBe(true);
  });

  describe("number signs", () => {
    it("identifies every number, including the two-character TEN", () => {
      for (const n of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]) {
        expect(isNumberSign(n), `${n} should be a number sign`).toBe(true);
      }
    });

    it("does not treat letters as numbers", () => {
      for (const letter of "abcdefghijklmnopqrstuvwxyz") expect(isNumberSign(letter)).toBe(false);
    });

    it("does not match a bare 0 — the model has no ZERO class", () => {
      // Text-to-Sign can play gloss 0; Sign-to-Text can never produce it.
      expect(LABELS).not.toContain("ZERO");
      expect(LABELS).not.toContain("0");
      expect(isNumberSign("0")).toBe(false);
      expect(isInScope("0")).toBe(false);
    });

    it("does not match 11 or above", () => {
      for (const n of ["11", "20", "100"]) expect(isNumberSign(n)).toBe(false);
    });
  });
});
