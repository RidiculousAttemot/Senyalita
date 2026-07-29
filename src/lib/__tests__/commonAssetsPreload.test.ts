import { describe, expect, it } from "vitest";
import { COMMON_WORDS } from "@/lib/commonAssetsPreload";

/**
 * Pins the preload list to the published vocabulary.
 *
 * The list used to include twelve phrases (HELLO, THANK YOU, KAMUSTA,
 * SALAMAT …) that were never published, so every mount of /translate fired
 * twelve requests guaranteed to 404. Nothing failed, which is why it survived:
 * a 404 here is indistinguishable from "not published yet", so the waste was
 * silent.
 *
 * If a phrase vocabulary is ever published, extend this test deliberately
 * rather than adding entries to the list and hoping they resolve.
 */
describe("common asset preload list", () => {
  it("is exactly the fingerspelling alphabet", () => {
    expect(COMMON_WORDS).toEqual("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
  });

  it("contains no multi-character gloss", () => {
    // Every entry must be a single letter. A phrase here means a request that
    // 404s on every page mount.
    const phrases = COMMON_WORDS.filter((word) => word.length !== 1);
    expect(phrases, `these are not published and would 404: ${phrases.join(", ")}`).toEqual([]);
  });

  it("has no duplicates", () => {
    expect(new Set(COMMON_WORDS).size).toBe(COMMON_WORDS.length);
  });
});
