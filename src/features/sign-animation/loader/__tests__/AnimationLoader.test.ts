import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationLoader } from "../AnimationLoader";

const asset = {
  label: "HELLO",
  language: "FSL",
  fps: 30,
  duration: 33,
  totalFrames: 1,
  frames: [{ timestamp: 0, landmarks: [] }],
  metadata: { featureDimension: 3, sequenceLength: 1, version: 1 },
};

afterEach(() => vi.unstubAllGlobals());

describe("AnimationLoader", () => {
  it("loads a published landmark asset from the Animation Library API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(asset), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new AnimationLoader().load("hello")).resolves.toEqual(asset);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/animations/HELLO");
  });

  it("returns null when no published asset exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new AnimationLoader().load("MISSING")).resolves.toBeNull();
  });
});
