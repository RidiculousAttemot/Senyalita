import { describe, expect, it } from "vitest";
import { resolvePublishedAnimationAsset } from "../queries/animationAssets";

const asset = {
  label: "HELLO",
  language: "FSL",
  fps: 30,
  duration: 0.1,
  totalFrames: 1,
  frames: [{ timestamp: 0, landmarks: [] }],
  metadata: { featureDimension: 3, sequenceLength: 1, version: 1 },
};

describe("resolvePublishedAnimationAsset", () => {
  it("returns published landmark JSON and rejects unavailable or nonpublished versions", async () => {
    await expect(resolvePublishedAnimationAsset({
      findVersion: async () => ({ status: "published", json: JSON.stringify(asset) }),
    }, "HELLO")).resolves.toEqual(asset);

    await expect(resolvePublishedAnimationAsset({
      findVersion: async () => null,
    }, "HELLO")).resolves.toBeNull();

    await expect(resolvePublishedAnimationAsset({
      findVersion: async () => ({ status: "approved", json: JSON.stringify(asset) }),
    }, "HELLO")).resolves.toBeNull();
  });
});