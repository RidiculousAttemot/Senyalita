import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  allowedLabelsForMode,
  handsForMode,
  phraseLabelsFrom,
  ALPHABET_LABELS,
  NUMBER_LABELS,
} from "../recognitionModes";

/**
 * The mode selects both the vocabulary and the hand count.
 *
 * Hand count matters as much as the labels: tracking one hand while two are in
 * frame makes MediaPipe flip between them, which reads as recognition failing
 * outright. Only Alphabet Practice takes that trade, because fingerspelling is
 * one-handed and the mode exists for drilling letters.
 */

const LABELS: string[] = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs", "labels.json"),
    "utf-8",
  ),
).labels;

describe("recognition mode scope", () => {
  it("partitions the model's 131 classes without gaps or overlap", () => {
    const letters = ALPHABET_LABELS.length;
    const numbers = NUMBER_LABELS.length;
    const phrases = phraseLabelsFrom(LABELS).length;

    expect(letters).toBe(26);
    expect(numbers).toBe(10);
    expect(letters + numbers + phrases).toBe(LABELS.length);
    expect(LABELS.length).toBe(131);
  });

  it("auto covers letters and numbers, the app's character vocabulary", () => {
    const allowed = allowedLabelsForMode("auto", LABELS);
    expect(allowed.size).toBe(36);
    for (const l of ALPHABET_LABELS) expect(allowed.has(l)).toBe(true);
    for (const n of NUMBER_LABELS) expect(allowed.has(n)).toBe(true);
    expect(allowed.has("THANK YOU")).toBe(false);
  });

  it("alphabet practice is letters only", () => {
    const allowed = allowedLabelsForMode("alphabet-practice", LABELS);
    expect(allowed.size).toBe(26);
    expect(allowed.has("a")).toBe(true);
    expect(allowed.has("ONE")).toBe(false);
    expect(allowed.has("THANK YOU")).toBe(false);
  });

  it("conversation is phrases only, and covers the ones users expect", () => {
    const allowed = allowedLabelsForMode("conversation", LABELS);
    expect(allowed.size).toBe(95);
    for (const p of ["THANK YOU", "GOOD MORNING", "HELLO", "RICE", "BLUE"]) {
      expect(allowed.has(p), `${p} should be available in conversation`).toBe(true);
    }
    // A phrase mode that still admits letters would let a stray "a" beat the
    // phrase the user is actually signing.
    expect(allowed.has("a")).toBe(false);
    expect(allowed.has("ONE")).toBe(false);
  });

  it("every mode leaves at least one class predictable", () => {
    // An empty allowed set makes infer fall back to the unrestricted argmax,
    // which would silently defeat the whole mechanism.
    for (const mode of ["auto", "alphabet-practice", "conversation"] as const) {
      expect(allowedLabelsForMode(mode, LABELS).size).toBeGreaterThan(0);
    }
  });

  it("tracks two hands except in alphabet practice", () => {
    expect(handsForMode("auto")).toBe(2);
    expect(handsForMode("conversation")).toBe(2);
    expect(handsForMode("alphabet-practice")).toBe(1);
  });
});
