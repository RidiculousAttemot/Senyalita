import { describe, expect, it } from "vitest";
import { suggest } from "../suggestionEngine";
import { boundedEditDistance, segmentIntoWords } from "../matching";
import { buildVocabulary, toLetterKey, type VocabularyEntry } from "../vocabulary";

const entry = (phrase: string, language: VocabularyEntry["language"] = "english"): VocabularyEntry => ({
  phrase,
  key: toLetterKey(phrase),
  wordCount: phrase.split(" ").length,
  language,
});

/** Small fixed vocabulary so ranking assertions do not depend on the real dictionary. */
const VOCAB: VocabularyEntry[] = [
  entry("HOW"), entry("ARE"), entry("YOU"), entry("HOW ARE YOU"),
  entry("HELLO"), entry("HELP"), entry("HELMET"),
  entry("GOOD"), entry("MORNING"), entry("GOOD MORNING"),
  entry("MAHAL", "filipino"), entry("KITA", "filipino"),
  entry("THANK YOU"), entry("PLEASE"),
];

const phrases = (letters: string, limit = 6) =>
  suggest(letters, { vocabulary: VOCAB, limit }).map((s) => s.phrase);

describe("toLetterKey", () => {
  it("keeps only the characters a signer can actually spell", () => {
    expect(toLetterKey("How are you?")).toBe("HOWAREYOU");
    expect(toLetterKey("mahal  kita!")).toBe("MAHALKITA");
  });
});

describe("boundedEditDistance", () => {
  it("measures small slips", () => {
    expect(boundedEditDistance("HOWAREYUO", "HOWAREYOU", 2)).toBe(2);
    expect(boundedEditDistance("GOODMORNNG", "GOODMORNING", 2)).toBe(1);
  });

  it("abandons once the bound is exceeded", () => {
    expect(boundedEditDistance("HELLO", "PLEASE", 1)).toBeGreaterThan(1);
  });
});

describe("segmentIntoWords", () => {
  it("splits an unspaced run into dictionary words", () => {
    expect(segmentIntoWords("HOWAREYOU", VOCAB)?.words).toEqual(["HOW", "ARE", "YOU"]);
    expect(segmentIntoWords("MAHALKITA", VOCAB)?.words).toEqual(["MAHAL", "KITA"]);
  });

  it("returns null when the letters cannot be covered", () => {
    expect(segmentIntoWords("ZZZZQQ", VOCAB)).toBeNull();
  });
});

describe("suggest", () => {
  it("ranks an exact phrase match first", () => {
    expect(phrases("HOWAREYOU")[0]).toBe("HOW ARE YOU");
  });

  it("reconstructs a phrase from unspaced letters", () => {
    // MAHALKITA is not a dictionary entry; it is only reachable by segmenting.
    expect(phrases("MAHALKITA")[0]).toBe("MAHAL KITA");
  });

  it("offers completions while the signer is mid-word", () => {
    const results = phrases("HEL");
    expect(results).toContain("HELLO");
    expect(results).toContain("HELP");
    expect(results).toContain("HELMET");
  });

  it("recovers from a transposed letter", () => {
    expect(phrases("HOWAREYUO")).toContain("HOW ARE YOU");
  });

  it("recovers from a dropped letter", () => {
    expect(phrases("GOODMORNNG")).toContain("GOOD MORNING");
  });

  it("stays quiet until there is enough signal", () => {
    expect(suggest("H", { vocabulary: VOCAB })).toEqual([]);
    expect(suggest("", { vocabulary: VOCAB })).toEqual([]);
  });

  it("does not let a fuzzy hit outrank an exact one", () => {
    const results = suggest("HELLO", { vocabulary: VOCAB });
    expect(results[0].phrase).toBe("HELLO");
    expect(results[0].kind).toBe("exact");
  });

  it("promotes habitually accepted phrases within their band", () => {
    const withoutUsage = suggest("HEL", { vocabulary: VOCAB }).map((s) => s.phrase);
    const withUsage = suggest("HEL", {
      vocabulary: VOCAB,
      usage: { HELMET: 20 },
    }).map((s) => s.phrase);

    expect(withUsage.indexOf("HELMET")).toBeLessThan(withoutUsage.indexOf("HELMET"));
  });

  it("respects the requested limit", () => {
    expect(suggest("HEL", { vocabulary: VOCAB, limit: 2 })).toHaveLength(2);
  });
});

describe("vocabulary built from the FSL dictionary", () => {
  it("includes multi-word phrases the system can actually sign", () => {
    const vocabulary = buildVocabulary();
    const keys = new Set(vocabulary.map((v) => v.key));

    expect(keys.has("HOWAREYOU")).toBe(true);
    expect(keys.has("THANKYOU")).toBe(true);
    expect(keys.has("GOODMORNING")).toBe(true);
  });

  it("covers Filipino glosses, not only English", () => {
    const vocabulary = buildVocabulary();
    const filipino = vocabulary.filter((v) => v.language === "filipino");

    expect(filipino.length).toBeGreaterThan(20);
    expect(vocabulary.some((v) => v.key === "SALAMAT")).toBe(true);
  });

  it("drops single letters, which would match everything", () => {
    expect(buildVocabulary().every((v) => v.key.length >= 2)).toBe(true);
  });
});
