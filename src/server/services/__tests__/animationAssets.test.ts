import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the behaviour that made the fallback incident invisible.
 *
 * When a published asset's lookup FAILS, the local development fallback serves
 * it from disk and the request returns 200. Nothing in the response or the
 * status code distinguishes that from a healthy hit, so a developer sees the
 * animation play while production — which has no local directory — 404s and
 * degrades to fingerspelling.
 *
 * `ANIMATION_LOCAL_FALLBACK=0` (`npm run dev:prod-assets`) is what makes dev
 * resolve like production. These tests assert both halves: that the mask
 * exists when the flag is on, and that the failure surfaces when it is off.
 *
 * The filesystem is mocked so the result does not depend on whether the
 * ~933MB `datasets/processed/user_holistic_assets` directory is present.
 */

const getPublishedAnimationAsset = vi.fn();
vi.mock("@/lib/supabase/queries/animationAssets", () => ({
  getPublishedAnimationAsset: (gloss: string) => getPublishedAnimationAsset(gloss),
}));

vi.mock("fs/promises", () => ({
  default: {
    readdir: vi.fn(async () => ["VID_local_asset.json"]),
    readFile: vi.fn(async () => JSON.stringify({ from: "local-disk" })),
  },
}));

const loadResolver = async () => {
  vi.resetModules();
  return (await import("../animationAssets")).resolveAnimationAsset;
};

const originalFlag = process.env.ANIMATION_LOCAL_FALLBACK;

beforeEach(() => {
  getPublishedAnimationAsset.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  if (originalFlag === undefined) delete process.env.ANIMATION_LOCAL_FALLBACK;
  else process.env.ANIMATION_LOCAL_FALLBACK = originalFlag;
  vi.restoreAllMocks();
});

describe("resolveAnimationAsset", () => {
  it("serves the published asset and never consults the fallback", async () => {
    getPublishedAnimationAsset.mockResolvedValue({ outcome: "found", asset: { from: "supabase" } });
    const resolve = await loadResolver();

    const result = await resolve("A");

    expect(result.outcome).toBe("resolved");
    if (result.outcome !== "resolved") return;
    expect(result.resolved.source).toBe("published");
    expect(result.resolved.asset).toEqual({ from: "supabase" });
  });

  // ---- The mask ----

  it("hides a failed lookup behind the local fallback when it is enabled", async () => {
    process.env.ANIMATION_LOCAL_FALLBACK = "1";
    getPublishedAnimationAsset.mockResolvedValue({
      outcome: "failed",
      stage: "download",
      message: "storage timeout",
    });
    const resolve = await loadResolver();

    const result = await resolve("A");

    // 200 with a working animation. In production this request 404s.
    expect(result.outcome).toBe("resolved");
    if (result.outcome !== "resolved") return;
    expect(result.resolved.source).toBe("local-development-failed");
    expect(result.resolved.asset).toEqual({ from: "local-disk" });
  });

  // ---- What dev:prod-assets makes visible ----

  it("surfaces a failed lookup when the fallback is disabled", async () => {
    process.env.ANIMATION_LOCAL_FALLBACK = "0";
    getPublishedAnimationAsset.mockResolvedValue({
      outcome: "failed",
      stage: "download",
      message: "storage timeout",
    });
    const resolve = await loadResolver();

    const result = await resolve("A");

    // The route turns this into 503 + x-animation-source: lookup-failed.
    expect(result.outcome).toBe("failed");
    if (result.outcome !== "failed") return;
    expect(result.failure.stage).toBe("download");
    expect(result.failure.gloss).toBe("A");
  });

  it("keeps an unpublished gloss distinct from a failure", async () => {
    process.env.ANIMATION_LOCAL_FALLBACK = "0";
    getPublishedAnimationAsset.mockResolvedValue({ outcome: "absent" });
    const resolve = await loadResolver();

    // absent -> 404, failed -> 503. Collapsing these is what let a published
    // asset being unreachable look like a gloss nobody had published yet.
    expect((await resolve("HELLO")).outcome).toBe("absent");
  });

  it("reports absent, not failed, when nothing is published and no local copy exists", async () => {
    process.env.ANIMATION_LOCAL_FALLBACK = "1";
    getPublishedAnimationAsset.mockResolvedValue({ outcome: "absent" });
    const fs = (await import("fs/promises")).default;
    vi.mocked(fs.readdir).mockRejectedValueOnce(new Error("ENOENT"));
    vi.mocked(fs.readdir).mockRejectedValueOnce(new Error("ENOENT"));
    const resolve = await loadResolver();

    expect((await resolve("NOPE")).outcome).toBe("absent");
  });
});
