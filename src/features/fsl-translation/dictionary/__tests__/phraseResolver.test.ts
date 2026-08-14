import { afterEach, describe, expect, it } from "vitest";
import { aliasIndex } from "../aliasIndex";
import { maxPhraseWords, resolvePhrase } from "../phraseResolver";
import { globalPipeline } from "@/features/translation-pipeline";

/**
 * Admin-added mappings have to reach the matcher, and the gloss has to stay the
 * asset key while they do. If an alias ever became the key, playback would
 * request something that does not exist, 404, and silently fingerspell — which
 * looks like a dictionary bug rather than a labelling one, and is the failure
 * this whole feature is most able to cause.
 */

afterEach(() => aliasIndex.invalidate());

describe("resolvePhrase", () => {
  it("resolves an admin-added phrase to its gloss", () => {
    aliasIndex.replace([{ phrase: "kamusta ka", gloss: "HOW ARE YOU", language: "tl", isCanonical: true }]);
    expect(resolvePhrase("kamusta ka")).toMatchObject({ gloss: "HOW ARE YOU", source: "database" });
  });

  it("uses the gloss as the animation key, never the phrase", () => {
    aliasIndex.replace([{ phrase: "kamusta ka", gloss: "HOW ARE YOU", language: "tl", isCanonical: true }]);
    const match = resolvePhrase("kamusta ka")!;
    expect(match.animationKey).toBe("HOW ARE YOU");
    expect(match.animationKey).not.toBe("kamusta ka");
  });

  it("falls back to the built-in dictionary for everything else", () => {
    const match = resolvePhrase("thank you");
    expect(match).toMatchObject({ gloss: "THANK YOU", source: "source-dictionary" });
  });

  it("lets the database win during the overlap, so a new sign is reachable at once", () => {
    // "salamat" is a source form of THANK YOU. Publishing a dedicated sign for
    // it must take effect without waiting on a source edit and a deploy.
    expect(resolvePhrase("salamat")?.source).toBe("source-dictionary");
    aliasIndex.replace([{ phrase: "salamat", gloss: "SALAMAT", language: "tl", isCanonical: true }]);
    expect(resolvePhrase("salamat")).toMatchObject({ gloss: "SALAMAT", source: "database" });
  });

  it("returns nothing for a phrase neither store knows", () => {
    expect(resolvePhrase("zzz not a phrase")).toBeUndefined();
  });
});

describe("maxPhraseWords", () => {
  it("grows to cover an alias longer than anything in source", () => {
    const base = maxPhraseWords();
    aliasIndex.replace([
      { phrase: "a b c d e f g h", gloss: "LONG", language: "en", isCanonical: false },
    ]);
    expect(maxPhraseWords()).toBeGreaterThanOrEqual(8);
    expect(maxPhraseWords()).toBeGreaterThan(base);
  });
});

describe("end to end through the pipeline", () => {
  it("matches an admin-added phrase as one gloss, consuming every token", () => {
    aliasIndex.replace([{ phrase: "kamusta ka", gloss: "HOW ARE YOU", language: "tl", isCanonical: true }]);
    const items = globalPipeline.translate("Kumusta ka?").animationPlan.items;
    expect(items.map((i) => i.gloss)).toEqual(["HOW ARE YOU"]);
    // The trailing "ka" must not be left behind as a second sign.
    expect(items).toHaveLength(1);
    expect(items[0].animationKey).toBe("HOW ARE YOU");
  });

  it("matches a long admin phrase that the source dictionary could never bound", () => {
    aliasIndex.replace([
      { phrase: "kamusta ka na po ba talaga", gloss: "HOW ARE YOU", language: "tl", isCanonical: false },
    ]);
    const items = globalPipeline.translate("kamusta ka na po ba talaga").animationPlan.items;
    expect(items.map((i) => i.gloss)).toEqual(["HOW ARE YOU"]);
  });

  it("still resolves the English form to the same sign", () => {
    aliasIndex.replace([{ phrase: "kamusta ka", gloss: "HOW ARE YOU", language: "tl", isCanonical: true }]);
    expect(globalPipeline.translate("how are you").animationPlan.items.map((i) => i.gloss))
      .toEqual(["HOW ARE YOU"]);
  });

  it("stops matching once the alias is removed", () => {
    // Deliberately a phrase the source dictionary does not know. "kamusta ka"
    // would not do: it was added to gestureDictionary.ts when the multi-word
    // matcher was fixed, so removing the alias falls back to source and it
    // still resolves — correct behaviour, but it proves nothing about removal.
    const phrase = "kamusta ka kaibigan";
    aliasIndex.replace([{ phrase, gloss: "HOW ARE YOU", language: "tl", isCanonical: false }]);
    expect(globalPipeline.translate(phrase).animationPlan.items.map((i) => i.gloss)).toEqual(["HOW ARE YOU"]);

    aliasIndex.invalidate();
    const after = globalPipeline.translate(phrase).animationPlan.items;
    expect(after.length, "the phrase should no longer resolve as one sign").toBeGreaterThan(1);
  });
});
