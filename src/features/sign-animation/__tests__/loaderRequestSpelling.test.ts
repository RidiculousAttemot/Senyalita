import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationLoader } from "../loader/AnimationLoader";
import { canonicalGloss, glossLookupCandidates } from "@/lib/glossKey";

/**
 * The loader must ask for the spelling the database stores.
 *
 * Every client cache keys a gloss as `toUpperCase().replace(/\s+/g, "_")`, and
 * AnimationLoader used that same string as the URL segment. The database keeps
 * what the admin typed -- `gloss.trim().toUpperCase()` -- so the browser asked
 * for THANK_YOU while the row read THANK YOU.
 *
 * eb0c10a made the server accept both, which is why playback works. That
 * tolerance stays: it is what protects the next cache that invents its own
 * key. But it made every multi-word request miss its first candidate and cost
 * a second query, and showed a spelling in the network tab that no row has.
 * Asking canonically means the first candidate hits.
 */

const okAsset = { label: "THANK YOU", fps: 30, totalFrames: 1, duration: 33, frames: [] };

const mockFetch = () => {
  const seen: string[] = [];
  const fn = vi.fn(async (url: string) => {
    seen.push(decodeURIComponent(String(url).replace("/api/animations/", "")));
    return { ok: true, status: 200, json: async () => okAsset, headers: { get: () => null } };
  });
  vi.stubGlobal("fetch", fn as never);
  return seen;
};

afterEach(() => vi.unstubAllGlobals());

describe("canonicalGloss", () => {
  it("produces the spelling the database stores", () => {
    expect(canonicalGloss("thank you")).toBe("THANK YOU");
    expect(canonicalGloss("THANK_YOU")).toBe("THANK YOU");
    expect(canonicalGloss("  thank   you  ")).toBe("THANK YOU");
    expect(canonicalGloss("A")).toBe("A");
  });

  it("is idempotent", () => {
    expect(canonicalGloss(canonicalGloss("THANK_YOU"))).toBe("THANK YOU");
  });
});

describe("AnimationLoader request spelling", () => {
  it("requests the spaced gloss, not the underscore cache key", () => {
    const seen = mockFetch();
    return new AnimationLoader().load("THANK YOU").then(() => {
      expect(seen).toEqual(["THANK YOU"]);
      expect(seen[0]).not.toContain("_");
    });
  });

  it("normalises an underscore caller back to the stored spelling", async () => {
    const seen = mockFetch();
    await new AnimationLoader().load("THANK_YOU");
    expect(seen).toEqual(["THANK YOU"]);
  });

  it("leaves single-character glosses untouched", async () => {
    const seen = mockFetch();
    const loader = new AnimationLoader();
    await loader.load("A");
    await loader.load("10");
    expect(seen).toEqual(["A", "10"]);
  });

  it("still caches, so the second call makes no request", async () => {
    const seen = mockFetch();
    const loader = new AnimationLoader();
    await loader.load("THANK YOU");
    await loader.load("THANK_YOU");
    // Both spellings share the underscore cache key, so one fetch total.
    expect(seen).toHaveLength(1);
  });

  it("the canonical form is the server's first candidate", () => {
    // The point of the change: no wasted round-trip.
    expect(glossLookupCandidates(canonicalGloss("THANK_YOU"))[0]).toBe("THANK YOU");
  });
});
