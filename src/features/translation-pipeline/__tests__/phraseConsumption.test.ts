import { describe, expect, it } from "vitest";
import { globalPipeline } from "../PipelineOrchestrator";
import { BUILT_IN_DICTIONARY } from "@/features/fsl-translation/dictionary/gestureDictionary";

/**
 * A matched multi-word entry must consume every token it covered.
 *
 * Typing "thank you" produced TWO signs: THANK YOU, then a fingerspelled
 * Y-O-U. The phrase had not matched at all -- FslTranslator walks `words` one
 * at a time and calls lookup() with a single token, so the multi-word synonym
 * key "thank you" was unreachable. What actually matched was the single token
 * "thank", which is also a synonym of THANK YOU, leaving "you" behind to
 * resolve on its own.
 *
 * 57 multi-word forms in the dictionary have at least one token that resolves
 * standalone, so this was never specific to THANK YOU.
 *
 * The generated test below is the point: it walks the dictionary rather than
 * naming cases, so an entry added later is covered without anyone remembering
 * to add it here.
 */

const glossesFor = (text: string): string[] =>
  globalPipeline.translate(text).animationPlan.items.map((i) => i.gloss);

describe("multi-word entries consume their own tokens", () => {
  it("thank you is one sign, not THANK YOU + YOU", () => {
    expect(glossesFor("thank you")).toEqual(["THANK YOU"]);
  });

  it("resolves the Tagalog form to the same single sign", () => {
    // One gloss, one published asset. English and Tagalog share the sign.
    expect(glossesFor("salamat")).toEqual(["THANK YOU"]);
  });

  it("keeps the short forms working", () => {
    expect(glossesFor("thanks")).toEqual(["THANK YOU"]);
    expect(glossesFor("thank")).toEqual(["THANK YOU"]);
  });

  it("leaves a standalone token alone", () => {
    // "you" on its own must be unaffected by longest-match.
    expect(glossesFor("you")).toHaveLength(1);
  });

  it("consumes only what it matched, and continues past it", () => {
    const g = glossesFor("thank you very much");
    expect(g[0]).toBe("THANK YOU");
    // The tail must not reappear as its own sign.
    expect(g.filter((x) => x === "YOU")).toHaveLength(0);
  });

  it("handles a longer phrase entry", () => {
    expect(glossesFor("how are you")).toEqual(["HOW ARE YOU"]);
  });

  it("a multi-word Tagalog form leaves no tail", () => {
    const g = glossesFor("walang anuman");
    expect(g).toEqual(["YOURE WELCOME"]);
  });
});

/**
 * Generated from the dictionary: every multi-word form must translate to
 * exactly one gloss. A hand-written list would go stale the moment someone
 * adds an entry; this cannot.
 */
describe("every multi-word dictionary form resolves to a single gloss", () => {
  const forms: Array<{ label: string; form: string }> = [];
  for (const entry of BUILT_IN_DICTIONARY) {
    const all = new Set<string>([...entry.synonyms, ...entry.english, ...entry.filipino]);
    for (const form of all) {
      if (form.trim().includes(" ")) forms.push({ label: entry.label, form });
    }
  }

  it("finds multi-word forms to check", () => {
    // Guards the guard: if the walk returned nothing, every case below would
    // vacuously pass against a dictionary that still leaks tails.
    expect(forms.length).toBeGreaterThan(20);
  });

  for (const { label, form } of forms) {
    it(`"${form}" -> one gloss (${label})`, () => {
      const g = glossesFor(form);
      expect(
        g,
        `"${form}" produced ${g.length} signs (${g.join(" + ")}) instead of one`,
      ).toHaveLength(1);
    });
  }
});
