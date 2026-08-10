import { describe, expect, it } from "vitest";
import { buildVocabulary, playableGlossFor } from "@/lib/learn/vocabulary";

/**
 * Playability is a fact about the library, not a rule about the label.
 *
 * This used to be decided structurally — a single letter, a digit, or a number
 * word — which was true only while the published set was exactly A-Z and 0-10.
 * Publishing THANK YOU made it false: the sign played correctly in Text-to-Sign
 * while /learn kept listing it under "recognised, no animation yet", and every
 * phrase published afterwards would have joined it there.
 */

const ALPHABET_AND_DIGITS = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
];

const set = (glosses: string[]) => new Set(glosses.map((g) => g.toUpperCase()));

describe("playable gloss resolution", () => {
  it("plays a published phrase — the case that was wrong", () => {
    const published = set([...ALPHABET_AND_DIGITS, "THANK YOU"]);
    expect(playableGlossFor("THANK YOU", published)).toBe("THANK YOU");
  });

  it("resolves the underscored spelling of a published phrase", () => {
    // Clients key caches as THANK_YOU; the library stores THANK YOU.
    const published = set([...ALPHABET_AND_DIGITS, "THANK YOU"]);
    expect(playableGlossFor("THANK_YOU", published)).toBe("THANK YOU");
  });

  it("does not offer a phrase that is not published", () => {
    const published = set(ALPHABET_AND_DIGITS);
    expect(playableGlossFor("THANK YOU", published)).toBeNull();
    expect(playableGlossFor("SEE YOU TOMORROW", published)).toBeNull();
  });

  it("maps a number word to its digit only when that digit is published", () => {
    expect(playableGlossFor("THREE", set(["3"]))).toBe("3");
    expect(playableGlossFor("THREE", set(["A", "B"]))).toBeNull();
  });

  it("does not offer a letter the library has not published", () => {
    // The old rule returned any single letter unconditionally, so an
    // unpublished one would render a grid entry whose stage could never load.
    expect(playableGlossFor("Q", set(["A"]))).toBeNull();
    expect(playableGlossFor("A", set(["A"]))).toBe("A");
  });

  it("offers nothing when the library is empty or unreachable", () => {
    const empty = set([]);
    for (const label of ["A", "10", "THREE", "THANK YOU"]) {
      expect(playableGlossFor(label, empty)).toBeNull();
    }
  });
});

describe("vocabulary build", () => {
  const LABELS = ["A", "B", "THANK YOU", "GOOD MORNING", "THREE", "HELLO"];

  it("marks a published phrase playable and leaves the rest listed", () => {
    const vocab = buildVocabulary(LABELS, [...ALPHABET_AND_DIGITS, "THANK YOU"]);
    const byLabel = Object.fromEntries(vocab.map((v) => [v.label, v.gloss]));

    expect(byLabel["THANK YOU"]).toBe("THANK YOU");
    expect(byLabel["THREE"]).toBe("3");
    expect(byLabel["GOOD MORNING"]).toBeNull();
    expect(byLabel["HELLO"]).toBeNull();
  });

  it("tracks the library rather than a snapshot of it", () => {
    // The whole point: publishing a sign changes the page with no code change.
    const before = buildVocabulary(LABELS, ALPHABET_AND_DIGITS);
    const after = buildVocabulary(LABELS, [...ALPHABET_AND_DIGITS, "GOOD MORNING"]);

    expect(before.find((v) => v.label === "GOOD MORNING")?.gloss).toBeNull();
    expect(after.find((v) => v.label === "GOOD MORNING")?.gloss).toBe("GOOD MORNING");
  });

  it("excludes single characters, which the alphabet section owns", () => {
    const vocab = buildVocabulary(LABELS, ALPHABET_AND_DIGITS);
    expect(vocab.some((v) => v.label === "A")).toBe(false);
  });

  it("keeps every multi-character label, playable or not", () => {
    const vocab = buildVocabulary(LABELS, []);
    expect(vocab.map((v) => v.label).sort()).toEqual(
      ["GOOD MORNING", "HELLO", "THANK YOU", "THREE"].sort(),
    );
    expect(vocab.every((v) => v.gloss === null)).toBe(true);
  });
});
