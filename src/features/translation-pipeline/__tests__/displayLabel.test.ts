import { describe, expect, it } from "vitest";
import { globalPipeline } from "../PipelineOrchestrator";
import { resolveDisplayLabel, speechLocaleFor } from "@/features/fsl-translation/dictionary/displayLabel";

/**
 * The label follows the user's language; the gloss stays the identity.
 *
 * Typing "salamat" resolved to one sign but every surface read "THANK YOU" --
 * the right sign, the wrong word for the user. The fix is presentation only:
 * the gloss remains the animationAsset key, the database row, and the path in
 * /api/animations/[gloss], so one published animation still serves every
 * lexical form that maps to it.
 *
 * The assertion that matters most here is the last one. A label that leaked
 * into animationKey would request /api/animations/SALAMAT, 404, and silently
 * fingerspell -- a regression invisible on screen, because the label would
 * still look correct.
 */

const plan = (text: string) => globalPipeline.translate(text).animationPlan.items;

describe("display label", () => {
  it("labels a Filipino input with its Filipino form", () => {
    const items = plan("salamat");
    expect(items).toHaveLength(1);
    expect(items[0].displayLabel).toBe("SALAMAT");
  });

  it("labels an English input with English", () => {
    for (const text of ["thank you", "thanks"]) {
      const items = plan(text);
      expect(items).toHaveLength(1);
      expect(items[0].displayLabel).toBe("THANK YOU");
    }
  });

  it("KEEPS THE GLOSS AS THE ASSET KEY whatever the label says", () => {
    // The regression that would break playback without changing the screen.
    const items = plan("salamat");
    expect(items[0].gloss).toBe("THANK YOU");
    expect(items[0].animationKey).toBe("THANK YOU");
    expect(items[0].animationKey).not.toBe("SALAMAT");
  });

  it("resolves per sign, so one Filipino word does not relabel a sentence", () => {
    const items = plan("hello salamat");
    expect(items).toHaveLength(2);
    expect(items[0].displayLabel).toBe("HELLO");
    expect(items[1].displayLabel).toBe("SALAMAT");
    // Both still point at their own gloss.
    expect(items.map((i) => i.animationKey)).toEqual(["HELLO", "THANK YOU"]);
  });

  it("uppercases the lowercase lexical forms, matching the gloss chips", () => {
    expect(plan("walang anuman")[0].displayLabel).toBe("WALANG ANUMAN");
  });
});

describe("resolveDisplayLabel fallbacks", () => {
  const withBoth = { gloss: "THANK YOU", english: ["thank you"], filipino: ["salamat"] };
  const noFilipino = { gloss: "PLEASE", english: ["please"], filipino: [] as string[] };

  it("falls back to the gloss when the entry has no form for that language", () => {
    // Never blank, which is the failure that would look like a broken player.
    expect(resolveDisplayLabel(noFilipino, "tl")).toBe("PLEASE");
    expect(resolveDisplayLabel(noFilipino, "tl", "filipino")).toBe("PLEASE");
  });

  it("never returns an empty string", () => {
    expect(resolveDisplayLabel({ gloss: "X", english: [], filipino: [] }, "tl")).toBe("X");
    expect(resolveDisplayLabel(undefined, "tl")).toBe("");
  });

  it("prefers the list the token matched over the sentence language", () => {
    // "mixed" has no sentence-level answer, so the matched list decides.
    expect(resolveDisplayLabel(withBoth, "mixed", "filipino")).toBe("SALAMAT");
    expect(resolveDisplayLabel(withBoth, "mixed", "english")).toBe("THANK YOU");
    // A Filipino token inside an English sentence still reads Filipino.
    expect(resolveDisplayLabel(withBoth, "en", "filipino")).toBe("SALAMAT");
  });

  it("falls back to the gloss for mixed input with no per-token signal", () => {
    // A synonym like "ty" belongs to no lexical list.
    expect(resolveDisplayLabel(withBoth, "mixed", "synonym")).toBe("THANK YOU");
  });
});

describe("speech locale follows the detected language", () => {
  it("speaks Filipino only for Filipino", () => {
    // Was hardcoded "tl-PH", so English input got a Filipino voice.
    expect(speechLocaleFor("tl")).toBe("tl-PH");
    expect(speechLocaleFor("en")).toBe("en-US");
    expect(speechLocaleFor("mixed")).toBe("en-US");
  });
});
