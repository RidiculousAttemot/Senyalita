import { afterEach, describe, expect, it } from "vitest";
import { globalPipeline } from "@/features/translation-pipeline";
import { BUILT_IN_DICTIONARY } from "@/features/fsl-translation/dictionary/gestureDictionary";
import { aliasIndex } from "@/features/fsl-translation/dictionary/aliasIndex";

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

/**
 * The same guarantee for admin-added phrases.
 *
 * The suite above generates from the source dictionary, which no longer covers
 * everything the matcher can match: aliases are runtime data and grow as
 * vocabulary is published. Without this, the property that makes multi-word
 * matching safe would be enforced for built-in phrases and merely hoped for on
 * exactly the phrases someone types into the admin.
 *
 * Seeded rather than fetched, so the cases are deterministic. The shapes are
 * chosen to be the ones that actually break: tails and prefixes that collide
 * with real dictionary entries, and phrases longer than anything in source.
 */
describe("every admin-added phrase also round-trips to exactly one gloss", () => {
  const aliases = [
    // Tail is a standalone dictionary entry ("ka" resolves to YOU).
    { phrase: "kamusta ka kaibigan", gloss: "HOW ARE YOU" },
    // Prefix of, and prefixed by, existing forms.
    { phrase: "salamat talaga", gloss: "THANK YOU" },
    { phrase: "maraming salamat po", gloss: "THANK YOU" },
    // Longer than the longest source form, so the match window must widen.
    { phrase: "kamusta ka na po ba talaga kaibigan", gloss: "HOW ARE YOU" },
    // Leading token is itself an entry ("magandang umaga" is GOOD MORNING).
    { phrase: "magandang umaga sa inyo", gloss: "GOOD MORNING" },
  ] as const;

  afterEach(() => aliasIndex.invalidate());

  it.each(aliases)("$phrase -> one gloss", ({ phrase, gloss }) => {
    aliasIndex.replace([{ phrase, gloss, language: "tl", isCanonical: false }]);
    const items = globalPipeline.translate(phrase).animationPlan.items;
    expect(items.map((i) => i.gloss), `"${phrase}" should resolve to ${gloss} alone`).toEqual([gloss]);
  });

  it("consumes every token, leaving no tail to fingerspell", () => {
    aliasIndex.replace([
      { phrase: "kamusta ka kaibigan", gloss: "HOW ARE YOU", language: "tl", isCanonical: false },
    ]);
    const items = globalPipeline.translate("Kumusta ka kaibigan?").animationPlan.items;
    expect(items).toHaveLength(1);
    expect(items[0].original).toBe("kamusta ka kaibigan");
  });
});
