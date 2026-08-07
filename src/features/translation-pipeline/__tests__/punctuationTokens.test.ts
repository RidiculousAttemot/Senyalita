import { describe, expect, it } from "vitest";
import { globalPipeline } from "../PipelineOrchestrator";
import { defaultTextNormalizer } from "../stages/TextNormalizer";

/**
 * A word must not lose its sign because it ended a sentence.
 *
 * "Kamusta ka?" tokenised as ["kamusta", "ka?"], so the second word was looked
 * up as the gloss KA? and fetched from /api/animations/KA%3F — a 404 — while
 * "kamusta", one word earlier and identical in every other respect, resolved
 * normally. From the outside that reads as the dictionary missing a very
 * common word.
 *
 * The cause was a character class, not the dictionary. `[^\w\s'-ñ…]` looks
 * like it allows an apostrophe and a hyphen; `'-ñ` is a RANGE spanning U+0027
 * to U+00F1, 203 code points, which allowed nearly all ASCII punctuation
 * through. Only ! and #, which sort below the apostrophe, were ever stripped —
 * enough for the rule to look like it worked.
 */

const wordsOf = (text: string) => defaultTextNormalizer.normalize(text).words;

describe("punctuation tokenisation", () => {
  it("gives the word before a question mark a clean gloss", () => {
    expect(wordsOf("Kamusta ka?")).toEqual(["kamusta", "ka"]);
  });

  /**
   * Asserted as "no token carries punctuation" rather than against an exact
   * token list, because normalisation also expands Filipino text-speak and
   * contractions — "c" becomes "si", "it's" becomes "it is". Pinning whole
   * lists here would be testing that vocabulary, not this fix, and would fail
   * whenever someone adds an entry to it.
   */
  it("leaves no word carrying punctuation the range bug let through", () => {
    for (const input of [
      "hello, world",
      "salamat po.",
      "bakit; kasi:",
      "a@b (c)",
      "Kamusta ka?",
    ]) {
      for (const word of wordsOf(input)) {
        expect(word, `${input} -> ${word}`).not.toMatch(/[,.!?;:@()]/);
      }
    }
  });

  it("still keeps apostrophes and hyphens inside words", () => {
    // The two characters the class was actually trying to allow. "it's" is
    // expanded to "it is" by the contraction map, so the hyphen is what this
    // can assert directly.
    expect(wordsOf("well-known")).toEqual(["well-known"]);
    expect(wordsOf("sinabi ni'ya")).toContain("ni'ya");
  });

  it("leaves no animation key carrying punctuation", () => {
    const result = globalPipeline.translate("Kamusta ka?");
    const keys = result.animationPlan.items.map((i) => i.animationKey ?? "");
    // The 404 this test exists for: KA%3F is `KA?` percent-encoded.
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key, `animation key still carries punctuation: ${key}`)
        .not.toMatch(/[,.!?;:]/);
    }
  });

  it("keeps the question mark reaching the segmenter", () => {
    // `normalized` is built before punctuation is dropped, because
    // SentenceSegmenter decides a sentence is interrogative from a trailing
    // "?" — removing it everywhere would have fixed the lookup and broken
    // sentence type instead.
    const { normalized } = defaultTextNormalizer.normalize("Kamusta ka?");
    expect(normalized.trim().endsWith("?")).toBe(true);
  });
});
