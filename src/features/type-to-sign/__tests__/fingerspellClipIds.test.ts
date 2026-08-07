import { describe, expect, it } from "vitest";

/**
 * Clip ids for a fingerspelled item have to be unique across the whole
 * expansion, not within each word.
 *
 * A grammar rule can turn one item into several words — "KUMUSTA" becomes
 * "HOW ARE YOU" — and the position used to reset at each word boundary. O sits
 * at position 1 of both HOW and YOU, so both clips came out as
 * `spell-O-0-1-<stamp>`. React renders the timeline by clip id and drops or
 * duplicates children under a repeated key; the console filled with the
 * warning and the timeline showed the wrong number of signs.
 *
 * This mirrors the id construction in TypeToSignInterface.resolveFallback
 * rather than importing it, because that resolver is a closure inside a client
 * component that pulls in the whole animation stack. The shape under test is
 * the numbering, and it is asserted directly.
 */

const idsForItem = (gloss: string, index: number, stamp: number) => {
  const spelled = gloss.split(/\s+/).map((w) => w.toUpperCase().replace(/[^A-Z0-9]/g, "").split(""));
  const ids: string[] = [];
  let position = 0;
  for (const characters of spelled) {
    for (const character of characters) {
      ids.push(`spell-${character}-${index}-${position}-${stamp}`);
      position += 1;
    }
  }
  return ids;
};

describe("fingerspelled clip ids", () => {
  it("stays unique when one item expands into several words", () => {
    // The reported case: O is at position 1 of HOW and of YOU.
    const ids = idsForItem("HOW ARE YOU", 0, 1786061318808);
    expect(new Set(ids).size, `duplicates in ${ids.join(" ")}`).toBe(ids.length);
    expect(ids).toHaveLength("HOWAREYOU".length);
  });

  it("stays unique when a word repeats letters", () => {
    const ids = idsForItem("PROGRAMMING", 0, 1);
    expect(new Set(ids).size).toBe(11);
  });

  it("does not collide across items in the same sentence", () => {
    const stamp = 42;
    const all = [...idsForItem("HOW ARE YOU", 0, stamp), ...idsForItem("HOW ARE YOU", 1, stamp)];
    expect(new Set(all).size).toBe(all.length);
  });
});
