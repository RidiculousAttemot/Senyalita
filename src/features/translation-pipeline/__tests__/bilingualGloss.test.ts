import { describe, expect, it } from "vitest";
import { globalPipeline } from "../PipelineOrchestrator";

/**
 * A Tagalog word must resolve inside an otherwise-English sentence.
 *
 * LanguageDetector runs before the translator, so the worry was that it picks
 * one language and drops out-of-language tokens. It does not: lookup consults
 * the synonym, english and filipino indexes regardless of the detected
 * language, so the two vocabularies coexist in one sentence.
 *
 * These share one published asset per sign. "salamat" and "thank you" both
 * reach THANK YOU and play the same animation -- the dictionary maps many
 * lexical forms onto one gloss, and no Tagalog gloss is uploaded separately.
 */
const glossesFor = (text: string): string[] =>
  globalPipeline.translate(text).animationPlan.items.map((i) => i.gloss);

describe("english and tagalog share one sign", () => {
  it("resolves the same gloss from either language", () => {
    expect(glossesFor("salamat")).toEqual(["THANK YOU"]);
    expect(glossesFor("thank you")).toEqual(["THANK YOU"]);
    expect(glossesFor("magandang umaga")).toEqual(["GOOD MORNING"]);
    expect(glossesFor("good morning")).toEqual(["GOOD MORNING"]);
  });

  it("keeps a tagalog word inside an english sentence", () => {
    expect(glossesFor("hello salamat")).toEqual(["HELLO", "THANK YOU"]);
    expect(glossesFor("good morning salamat")).toEqual(["GOOD MORNING", "THANK YOU"]);
    expect(glossesFor("walang anuman thank you")).toEqual(["YOURE WELCOME", "THANK YOU"]);
  });

  it("consumes multi-word tagalog forms whole", () => {
    // "walang anuman" must not leave "anuman" behind, the same rule the
    // English phrases follow.
    expect(glossesFor("walang anuman")).toEqual(["YOURE WELCOME"]);
    expect(glossesFor("hindi alam")).toEqual(["DONT KNOW"]);
    expect(glossesFor("ikinagagalak kong makilala ka")).toEqual(["NICE TO MEET YOU"]);
  });
});
