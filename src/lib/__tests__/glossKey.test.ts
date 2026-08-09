import { describe, expect, it } from "vitest";
import { glossLookupCandidates } from "@/lib/glossKey";

/**
 * THANK YOU was the first multi-word gloss ever published, and it 404'd on the
 * first request.
 *
 * Clients key their caches as `toUpperCase().replace(/\s+/g, "_")` and
 * AnimationLoader uses that same key as the URL segment. The row stores what the
 * admin typed, which keeps the space. Exact matching therefore missed:
 *
 *   GET /api/animations/THANK_YOU    -> 404
 *   GET /api/animations/THANK%20YOU  -> 307
 *
 * Invisible until now because every published gloss was a single letter or
 * digit, where underscore normalisation is the identity function.
 */
describe("gloss lookup candidates", () => {
  it("offers the space spelling for an underscored request", () => {
    expect(glossLookupCandidates("THANK_YOU")).toEqual(["THANK_YOU", "THANK YOU"]);
  });

  it("offers only one candidate for a single letter", () => {
    // The case that hid the bug: no underscore, so nothing to vary.
    expect(glossLookupCandidates("A")).toEqual(["A"]);
    expect(glossLookupCandidates("10")).toEqual(["10"]);
  });

  it("tries the exact spelling first", () => {
    // A gloss that genuinely contains an underscore must match itself before
    // the space variant is attempted.
    expect(glossLookupCandidates("THANK_YOU")[0]).toBe("THANK_YOU");
  });

  it("accepts the spaced spelling unchanged", () => {
    expect(glossLookupCandidates("THANK YOU")).toEqual(["THANK YOU"]);
  });

  it("upper-cases and trims", () => {
    expect(glossLookupCandidates("  thank_you  ")).toEqual(["THANK_YOU", "THANK YOU"]);
  });

  it("collapses runs of separators in the variant", () => {
    expect(glossLookupCandidates("SEE__YOU___TOMORROW")).toContain("SEE YOU TOMORROW");
    // The publish path only trims and upper-cases, so a doubled internal space
    // can genuinely be stored. The exact spelling is still offered first, and
    // the collapsed one is what matches a single-spaced row.
    expect(glossLookupCandidates("NICE  TO  MEET  YOU")).toEqual([
      "NICE  TO  MEET  YOU",
      "NICE TO MEET YOU",
    ]);
  });

  it("never returns duplicates", () => {
    for (const gloss of ["A", "THANK YOU", "THANK_YOU", "  B  "]) {
      const candidates = glossLookupCandidates(gloss);
      expect(new Set(candidates).size).toBe(candidates.length);
    }
  });
});
