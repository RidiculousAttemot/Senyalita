import { describe, expect, it } from "vitest";
import { detectAliasConflicts, isRefusal, type ClaimedPhrase } from "../conflicts";

const claimed: ClaimedPhrase[] = [
  { phrase: "ka", gloss: "YOU" },
  { phrase: "kamusta", gloss: "HOW ARE YOU" },
  { phrase: "salamat", gloss: "THANK YOU" },
  { phrase: "salamat po", gloss: "THANK YOU" },
];

const check = (phrase: string, gloss: string) => detectAliasConflicts({ phrase, gloss, claimed });

describe("duplicate ownership", () => {
  it("refuses a phrase another sign already owns, and names it", () => {
    const [conflict] = check("salamat", "HELLO");
    expect(conflict.severity).toBe("refuse");
    expect(conflict.kind).toBe("duplicate-owner");
    // Naming the owner is the requirement — "already taken" is not actionable.
    expect(conflict.message).toContain("THANK YOU");
  });

  it("refuses an exact duplicate within the same sign", () => {
    const [conflict] = check("salamat", "THANK YOU");
    expect(conflict.kind).toBe("duplicate-in-asset");
    expect(conflict.severity).toBe("refuse");
  });

  it("does not pile collision warnings onto a refusal", () => {
    // "salamat po" would also be a prefix collision; once refused that is noise.
    expect(check("salamat", "HELLO")).toHaveLength(1);
  });
});

describe("tail collision", () => {
  it("warns when the ending is a phrase of its own, and says what still happens", () => {
    // The reported shape: "kamusta ka" added while "ka" already plays YOU.
    const conflicts = check("kamusta ka", "HOW ARE YOU");
    const tail = conflicts.find((c) => c.kind === "tail-collision");
    expect(tail?.severity).toBe("warn");
    expect(tail?.message).toContain("YOU");
    expect(isRefusal(conflicts)).toBe(false);
  });

  it("does not warn when the ending belongs to nothing", () => {
    expect(check("magandang umaga", "GOOD MORNING").some((c) => c.kind === "tail-collision")).toBe(false);
  });
});

describe("prefix collision", () => {
  it("warns that a longer existing phrase wins", () => {
    const conflicts = detectAliasConflicts({
      phrase: "salamat talaga",
      gloss: "THANK YOU",
      claimed: [{ phrase: "salamat talaga po", gloss: "THANK YOU" }],
    });
    const prefix = conflicts.find((c) => c.kind === "prefix-collision");
    expect(prefix?.severity).toBe("warn");
    expect(prefix?.message).toContain("longer phrase wins");
  });

  it("warns that adding a longer phrase changes what the shorter input does", () => {
    const conflicts = check("kamusta na", "HOW ARE YOU");
    const prefix = conflicts.find((c) => c.kind === "prefix-collision");
    expect(prefix?.message).toContain("kamusta");
  });
});

describe("unspellable phrases", () => {
  it("refuses a phrase with nothing to fingerspell", () => {
    const conflicts = detectAliasConflicts({ phrase: "--", gloss: "HELLO", claimed: [] });
    expect(conflicts.some((c) => c.kind === "unspellable" && c.severity === "refuse")).toBe(true);
  });

  it("accepts a normal phrase", () => {
    expect(detectAliasConflicts({ phrase: "magandang gabi", gloss: "GOOD EVENING", claimed: [] })).toEqual([]);
  });
});

describe("isRefusal", () => {
  it("separates what blocks a save from what merely informs", () => {
    expect(isRefusal(check("salamat", "HELLO"))).toBe(true);
    expect(isRefusal(check("kamusta ka", "HOW ARE YOU"))).toBe(false);
  });
});
