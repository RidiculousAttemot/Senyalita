import { describe, expect, it } from "vitest";
import { globalPipeline } from "@/features/translation-pipeline";
import { BUILT_IN_DICTIONARY } from "@/features/fsl-translation/dictionary/gestureDictionary";

/**
 * Generated, not hand-written.
 *
 * The failure this guards is structural: matching is longest-first, so a
 * multi-word entry whose tail is also a standalone entry can match its head and
 * leave the tail behind as a second gloss. "thank you" produced THANK YOU
 * followed by a fingerspelled Y-O-U; 57 of the multi-word forms have at least
 * one token that resolves on its own, so it was never specific to that phrase.
 *
 * A hand-written list of cases would cover the phrases someone remembered and
 * miss the next entry added to the dictionary. Deriving the cases from the
 * dictionary itself means a new entry is tested the moment it exists.
 */
describe("every multi-word dictionary form round-trips to exactly one gloss", () => {
  const cases = BUILT_IN_DICTIONARY.flatMap((entry) => {
    const forms = new Set([...entry.synonyms, ...entry.english, ...entry.filipino]);
    return [...forms]
      .filter((form) => form.trim().includes(" "))
      .map((form) => ({ gloss: entry.gloss, form }));
  });

  it("has multi-word forms to check", () => {
    // Guards the generator itself: if the extraction breaks and yields nothing,
    // the suite below would vacuously pass and report success.
    expect(cases.length).toBeGreaterThan(50);
  });

  it.each(cases)("$form -> one gloss", ({ form, gloss }) => {
    const items = globalPipeline.translate(form).animationPlan.items;
    expect(
      items.map((i) => i.gloss),
      `"${form}" should resolve to the single gloss ${gloss}`,
    ).toHaveLength(1);
  });
});
