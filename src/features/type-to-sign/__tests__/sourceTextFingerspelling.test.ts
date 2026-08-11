import { describe, expect, it } from "vitest";
import { globalPipeline } from "@/features/translation-pipeline";
import { fingerspellSource, sourceLabel, spellableCharacters } from "../sourceLabel";

/**
 * The rule: fingerspell and label the source text; look the asset up by gloss.
 *
 * Typing "kamusta ka" was spelled H-O-W-A-R-E-Y-O-U, because the fallback read
 * item.gloss. That puts English letters on screen for a user who wrote
 * Filipino, at the moment the system has nothing better to offer.
 */

/** What the runtime treats as available; see the coverage report for the real set. */
const PUBLISHED = new Set([
  "THANK YOU",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
]);

/** Mirrors resolveFallback: play a published gloss, else spell the source. */
function plan(input: string) {
  const items = globalPipeline.translate(input).animationPlan.items;
  const requests: string[] = [];
  let signs = 0;

  for (const item of items) {
    requests.push(item.animationKey);
    if (PUBLISHED.has(item.animationKey.toUpperCase())) {
      signs += 1;
      continue;
    }
    const characters = spellableCharacters(fingerspellSource(item)).flat();
    signs += characters.length;
    requests.push(...characters);
  }

  return {
    glosses: items.map((i) => i.gloss),
    labels: items.map((i) => sourceLabel(i.original, i.gloss)),
    signs,
    requests,
  };
}

describe("Kamusta ka?", () => {
  it("is one gloss, not two", () => {
    expect(plan("Kamusta ka?").glosses).toEqual(["HOW ARE YOU"]);
  });

  it("is labelled with the words the user typed", () => {
    expect(plan("Kamusta ka?").labels).toEqual(["KAMUSTA KA"]);
  });

  it("fingerspells the source, not the gloss", () => {
    const { signs, requests } = plan("Kamusta ka?");
    // k-a-m-u-s-t-a k-a, not h-o-w-a-r-e-y-o-u y-o-u.
    expect(signs).toBe(9);
    expect(requests.slice(1)).toEqual(["K", "A", "M", "U", "S", "T", "A", "K", "A"]);
  });

  it("does not fingerspell the question mark", () => {
    expect(plan("Kamusta ka?").requests).not.toContain("?");
  });
});

describe("the gloss stays the lookup key while the label follows the source", () => {
  it("requests the gloss and displays the source for a published sign", () => {
    const { glosses, labels, requests, signs } = plan("salamat");
    expect(glosses).toEqual(["THANK YOU"]);
    expect(labels).toEqual(["SALAMAT"]);
    // The constraint: if the label ever became the key this would request
    // SALAMAT, 404, and silently fingerspell -- looking like a dictionary bug.
    expect(requests).toEqual(["THANK YOU"]);
    expect(signs).toBe(1);
  });

  it("requests the gloss and displays the source for an unpublished sign", () => {
    const { glosses, labels, requests } = plan("Kamusta ka?");
    expect(glosses).toEqual(["HOW ARE YOU"]);
    expect(labels).toEqual(["KAMUSTA KA"]);
    expect(requests[0]).toBe("HOW ARE YOU");
  });
});

describe("the reported acceptance cases", () => {
  it("thank you: one gloss, no Y-O-U duplication", () => {
    const { glosses, signs, requests } = plan("thank you");
    expect(glosses).toEqual(["THANK YOU"]);
    expect(signs).toBe(1);
    expect(requests).toEqual(["THANK YOU"]);
  });

  it("how are you: one gloss, spells the English source when unpublished", () => {
    const { glosses, signs, requests } = plan("how are you");
    expect(glosses).toEqual(["HOW ARE YOU"]);
    expect(signs).toBe(9);
    expect(requests.slice(1)).toEqual(["H", "O", "W", "A", "R", "E", "Y", "O", "U"]);
  });

  it("a published gloss typed in English plays without fingerspelling", () => {
    expect(plan("thank you").signs).toBe(1);
  });
});

describe("mixed-language input labels each sign from its own source tokens", () => {
  it("does not label the whole sentence from one detected language", () => {
    const { labels } = plan("hello salamat");
    expect(labels).toEqual(["HELLO", "SALAMAT"]);
  });
});

describe("spellableCharacters", () => {
  it("keeps word boundaries as separate runs", () => {
    // "kamusta ka" is 7 signs then 2, not an undifferentiated run of 9.
    expect(spellableCharacters("kamusta ka")).toEqual([
      ["K", "A", "M", "U", "S", "T", "A"],
      ["K", "A"],
    ]);
  });

  it("drops punctuation and keeps digits", () => {
    expect(spellableCharacters("a? 1")).toEqual([["A"], ["1"]]);
  });

  it("spells a word containing a digit rather than dropping it", () => {
    // engine.isFingerspellable is /^[A-Za-z]+$/ and would reject these. That
    // was harmless while the gloss was spelled, but the source is the user's
    // own text and 1-10 are real signs.
    expect(spellableCharacters("10")).toEqual([["1", "0"]]);
    expect(spellableCharacters("don't")).toEqual([["D", "O", "N", "T"]]);
  });

  it("yields nothing for input with no spellable characters", () => {
    expect(spellableCharacters("?!")).toEqual([]);
  });
});

describe("sourceLabel", () => {
  it("falls back to the gloss when there is no source text", () => {
    expect(sourceLabel("", "HOW ARE YOU")).toBe("HOW ARE YOU");
    expect(sourceLabel(undefined, "HOW ARE YOU")).toBe("HOW ARE YOU");
  });
});

describe("fingerspellSource", () => {
  // This is the exact function resolveFallback calls, so reverting the fix to
  // item.gloss fails here rather than passing against a reimplementation.
  it("spells the typed words, not the gloss they resolved to", () => {
    expect(fingerspellSource({ original: "kamusta ka", gloss: "HOW ARE YOU" })).toBe("kamusta ka");
  });

  it("falls back to the gloss rather than spelling nothing", () => {
    expect(fingerspellSource({ original: "   ", gloss: "HOW ARE YOU" })).toBe("HOW ARE YOU");
    expect(fingerspellSource({ gloss: "HOW ARE YOU" })).toBe("HOW ARE YOU");
  });
});
