import { describe, expect, it } from "vitest";
import { normalisePhrase, prepareAliasPhrase } from "../normalisePhrase";
import { globalPipeline } from "@/features/translation-pipeline";

/**
 * The stored phrase has to be what the matcher will look up, not what the
 * admin typed. These two must agree for every input or an alias can be saved
 * that never matches — which looks like a broken dictionary, not a storage bug.
 */
describe("normalisePhrase", () => {
  it("applies the spelling substitution the matcher applies", () => {
    // The reported case. Stored as typed, this alias would never fire.
    expect(normalisePhrase("Kumusta ka?").phrase).toBe("kamusta ka");
  });

  it("expands contractions the way the pipeline does", () => {
    expect(normalisePhrase("don't know").phrase).toBe("do not know");
  });

  it("drops punctuation and collapses whitespace", () => {
    expect(normalisePhrase("  SALAMAT   po!  ").phrase).toBe("salamat po");
  });

  it("keeps hyphens, apostrophes and accents", () => {
    expect(normalisePhrase("mag-aral").phrase).toBe("mag-aral");
    expect(normalisePhrase("café").phrase).toBe("café");
  });

  it("is a fixed point: normalising a stored phrase changes nothing", () => {
    // Anything else means a saved alias could differ from what a re-save
    // produces, and the two would diverge silently.
    for (const input of ["Kumusta ka?", "don't know", "  SALAMAT   po!  ", "mag-aral", "Hello, world"]) {
      const once = normalisePhrase(input).phrase;
      expect(normalisePhrase(once).phrase, `${input} is not stable`).toBe(once);
    }
  });

  it("matches what the pipeline hands the matcher, for every case", () => {
    for (const input of ["kumusta ka", "how are you", "thank you", "mag-aral", "don't know", "salamat po"]) {
      const viaPipeline = globalPipeline.translate(input).normalized.words.join(" ");
      expect(normalisePhrase(input).phrase, `${input} diverges from the pipeline`).toBe(viaPipeline);
    }
  });
});

describe("prepareAliasPhrase", () => {
  it("accepts a normal phrase", () => {
    const result = prepareAliasPhrase("Kumusta ka");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.phrase).toBe("kamusta ka");
  });

  it("refuses empty input with something to read", () => {
    const result = prepareAliasPhrase("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/enter a word/i);
  });

  it("refuses input that normalises away to nothing", () => {
    const result = prepareAliasPhrase("?!,.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/nothing to match/i);
  });
});
