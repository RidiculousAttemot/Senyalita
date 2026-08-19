import { describe, expect, it } from "vitest";
import { BUILT_IN_DICTIONARY } from "@/features/fsl-translation/dictionary/gestureDictionary";
import { globalPipeline } from "@/features/translation-pipeline";

/**
 * A matched phrase must advance the cursor by exactly its own token count.
 *
 * multiWordRoundTrip.test.ts already proves every multi-word form resolves to a
 * single gloss ON ITS OWN. That check cannot see over-consumption: a matcher
 * that swallowed one token too many would still produce exactly one gloss for a
 * phrase in isolation, and would silently eat the following word in real use.
 *
 * Under-consumption is the failure that was actually shipped -- "thank you"
 * matching only "thank" and leaving "you" to fingerspell itself -- so both
 * directions matter, and only this suite pins the far side.
 *
 * Generated from the dictionary rather than listed, so phrases added later are
 * covered without anyone remembering to extend a list.
 */

/** Resolves standalone, is not a prefix or tail of the phrases under test. */
const FOLLOWER = "doctor";

describe("a matched phrase advances the cursor by exactly its own length", () => {
  const phrases = BUILT_IN_DICTIONARY.flatMap((entry) => {
    const forms = new Set([...entry.synonyms, ...entry.english, ...entry.filipino]);
    return [...forms].filter((f) => f.trim().includes(" ")).map((form) => ({ gloss: entry.gloss, form }));
  });

  it("has multi-word forms to check", () => {
    // Guards the generator: a broken extraction would make every case below
    // vacuous while the suite reported green.
    expect(phrases.length).toBeGreaterThan(50);
  });

  it("the follower resolves to something on its own", () => {
    // If FOLLOWER silently resolved to nothing, the cases below would pass for
    // the wrong reason -- they would be asserting that one item is one item.
    const items = globalPipeline.translate(FOLLOWER).animationPlan.items;
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it.each(phrases)("$form + a following word keeps both", ({ form, gloss }) => {
    const alone = globalPipeline.translate(form).animationPlan.items;
    const followed = globalPipeline.translate(`${form} ${FOLLOWER}`).animationPlan.items;

    // The phrase still collapses to its own gloss.
    expect(followed[0].gloss, `"${form} ${FOLLOWER}" lost the phrase ${gloss}`).toBe(alone[0].gloss);

    // And the follower survives. Over-consumption shows here and nowhere else:
    // the phrase would look correct while the next word had been eaten.
    expect(
      followed.length,
      `"${form} ${FOLLOWER}" produced ${followed.length} items; the phrase should ` +
        `consume only its own ${form.trim().split(/\s+/).length} tokens and leave ${FOLLOWER}`,
    ).toBeGreaterThan(alone.length);
  });
});
