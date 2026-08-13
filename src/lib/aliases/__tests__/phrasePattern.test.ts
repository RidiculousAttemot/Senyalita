import { describe, expect, it } from "vitest";
import { globalPipeline } from "@/features/translation-pipeline";
import { ALIAS_PHRASE_PATTERN, isStorableAliasPhrase } from "../phrasePattern";

/**
 * The constraint must accept everything the tokeniser can emit.
 *
 * This is the direction that matters. A constraint narrower than the
 * normaliser's output rejects a phrase the admin normalised correctly, and it
 * fails at the database as a raw constraint violation rather than as an
 * explanation. The previous pattern was narrower in exactly that way.
 *
 * Driven through the real pipeline rather than against hand-written strings,
 * so the two cannot drift apart without this failing.
 */
const normalise = (input: string) => globalPipeline.translate(input).normalized.words.join(" ");

const INPUTS = [
  // The reported case, and its English twin.
  "Kumusta ka?", "kumusta ka na", "how are you", "How are you doing?",
  // Contractions and apostrophes — the normaliser expands some and keeps others.
  "don't know", "I don't understand", "sino'ng kasama", "what's your name",
  // Hyphenated Filipino.
  "mag-aral", "pa-bili", "nag-aaral ako",
  // Accented letters the normaliser whitelists.
  "café", "piñata", "señor", "à la carte", "naïve", "hôtel",
  // Digits and number words.
  "10", "5 anak", "one two three",
  // Punctuation that must be split off and dropped.
  "salamat!", "hello, world", "tama?; oo!", "good morning.",
  // Multi-word phrases already in the dictionary.
  "thank you", "nice to meet you", "see you tomorrow", "magandang umaga",
  // Messy input.
  "  SALAMAT   po  ", "Hello!!!", "kamusta  ka", "MAG-ARAL",
];

describe("alias phrase pattern", () => {
  it.each(INPUTS)("accepts the normalised form of %j", (input) => {
    const phrase = normalise(input);
    // An input can normalise to nothing (pure punctuation); that is not a
    // phrase and is not this constraint's business.
    if (phrase === "") return;
    expect(
      ALIAS_PHRASE_PATTERN.test(phrase),
      `normalised to ${JSON.stringify(phrase)}, which the CHECK would reject`,
    ).toBe(true);
  });

  it("still rejects what normalisation would never produce", () => {
    // Guards against widening it into meaninglessness.
    expect(isStorableAliasPhrase("Kamusta ka")).toBe(false);   // uppercase
    expect(isStorableAliasPhrase("kamusta  ka")).toBe(false);  // double space
    expect(isStorableAliasPhrase(" kamusta")).toBe(false);     // leading space
    expect(isStorableAliasPhrase("kamusta ")).toBe(false);     // trailing space
    expect(isStorableAliasPhrase("kamusta ka?")).toBe(false);  // sentence punctuation
    expect(isStorableAliasPhrase("")).toBe(false);
    expect(isStorableAliasPhrase("kamusta, ka")).toBe(false);
  });

  it("accepts the cases the first constraint wrongly refused", () => {
    for (const phrase of ["mag-aral", "sino'ng kasama", "café", "piñata"]) {
      expect(isStorableAliasPhrase(phrase), `${phrase} must be storable`).toBe(true);
    }
  });
});
