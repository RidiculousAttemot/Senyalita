import { describe, expect, it } from "vitest";
import { canPublishAnimationVersion } from "../animationAssets";

describe("canPublishAnimationVersion", () => {
  it("allows only an approved landmark asset version to publish", () => {
    expect(canPublishAnimationVersion("approved")).toBe(true);
    expect(canPublishAnimationVersion("pending")).toBe(false);
    expect(canPublishAnimationVersion("processing")).toBe(false);
    expect(canPublishAnimationVersion("failed")).toBe(false);
    expect(canPublishAnimationVersion("ready")).toBe(false);
    expect(canPublishAnimationVersion("published")).toBe(false);
    expect(canPublishAnimationVersion("archived")).toBe(false);
  });
});