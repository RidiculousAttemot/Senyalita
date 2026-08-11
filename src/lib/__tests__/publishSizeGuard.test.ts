import { afterEach, describe, expect, it, vi } from "vitest";
import { animationLibrary } from "../animationLibrary";
import { PUBLISH_BUDGET_BYTES } from "@/lib/admin/payloadBudget";

/**
 * The guard is only worth anything if it stops the request. Asserting on the
 * thrown message alone would still pass if we sent the oversize body first and
 * threw afterwards — which is the exact failure being fixed, because the
 * platform rejects that body with an HTML 413 we cannot annotate.
 */

/** A landmark asset large enough to exceed the budget once serialised. */
function oversizeAsset(frames: number) {
  return {
    gloss: "TEST",
    fps: 30,
    frames: Array.from({ length: frames }, (_, i) => ({
      timestamp: i * 33,
      landmarks: [
        {
          handedness: "Right",
          landmarks: Array.from({ length: 21 }, () => ({
            x: 0.123456789012,
            y: 0.987654321098,
            z: 0.135792468013,
          })),
        },
      ],
    })),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("performAction size guard", () => {
  it("does not send a request when the body exceeds the budget", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const asset = oversizeAsset(20000);
    await expect(
      animationLibrary.performAction("version-1", "publish", { asset }),
    ).rejects.toThrow(/shorter/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends a request for an asset within budget", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: "published" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await animationLibrary.performAction("version-1", "publish", { asset: oversizeAsset(50) });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = fetchSpy.mock.calls[0][1].body as string;
    expect(new TextEncoder().encode(body).length).toBeLessThanOrEqual(PUBLISH_BUDGET_BYTES);
  });
});
