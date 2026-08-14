import { describe, expect, it } from "vitest";
import { databaseOwnsGloss, sourceDictionaryClaims } from "../ownership";
import { detectAliasConflicts, isRefusal } from "../conflicts";
import { BUILT_IN_DICTIONARY } from "@/features/fsl-translation/dictionary/gestureDictionary";

describe("databaseOwnsGloss", () => {
  it("is true only for a gloss that has an asset", () => {
    const assets = new Set(["THANK YOU"]);
    expect(databaseOwnsGloss("thank you", assets)).toBe(true);
    expect(databaseOwnsGloss("HELLO", assets)).toBe(false);
  });
});

describe("sourceDictionaryClaims", () => {
  it("collects every lexical form with its gloss", () => {
    const claims = sourceDictionaryClaims([
      { gloss: "THANK YOU", synonyms: ["thanks"], english: ["thank you"], filipino: ["salamat"] },
    ]);
    expect(claims).toEqual([
      { phrase: "thanks", gloss: "THANK YOU" },
      { phrase: "thank you", gloss: "THANK YOU" },
      { phrase: "salamat", gloss: "THANK YOU" },
    ]);
  });

  it("keeps the first claimant when the dictionary already contests a form", () => {
    // 27 forms are claimed by more than one gloss in the built-in dictionary.
    // Those predate this feature; the point is that the checker is stable, not
    // that it retroactively resolves them.
    const claims = sourceDictionaryClaims([
      { gloss: "HELLO", synonyms: ["kumusta"], english: [], filipino: [] },
      { gloss: "HOW ARE YOU", synonyms: ["kumusta"], english: [], filipino: [] },
    ]);
    expect(claims).toEqual([{ phrase: "kumusta", gloss: "HELLO" }]);
  });

  it("covers the real dictionary without throwing", () => {
    expect(sourceDictionaryClaims(BUILT_IN_DICTIONARY).length).toBeGreaterThan(500);
  });
});

describe("the two stores cannot silently disagree", () => {
  const claimed = sourceDictionaryClaims(BUILT_IN_DICTIONARY);

  it("refuses a built-in phrase claimed for a different sign", () => {
    // Without this the database would accept it and then win, overriding a
    // built-in mapping with nothing on screen saying so.
    const conflicts = detectAliasConflicts({ phrase: "salamat", gloss: "HELLO", claimed });
    expect(isRefusal(conflicts)).toBe(true);
    expect(conflicts[0].message).toContain("THANK YOU");
  });

  it("allows adopting a built-in phrase onto its own gloss", () => {
    // This is the one-way move that happens when a gloss gains an animation.
    const conflicts = detectAliasConflicts({ phrase: "salamat", gloss: "THANK YOU", claimed });
    expect(conflicts[0].kind).toBe("duplicate-in-asset");
  });

  it("leaves a phrase neither store knows alone", () => {
    expect(detectAliasConflicts({ phrase: "wala pang ganito", gloss: "HELLO", claimed })).toEqual([]);
  });
});
