import { describe, expect, it } from "vitest";
import { computeReadyPrefix, type SettledSlot } from "../orderedFlush";

function slots(...values: Array<"pending" | number | null>): SettledSlot<number>[] {
  return values.map((v) => (v === "pending" ? { done: false, value: null } : { done: true, value: v }));
}

describe("computeReadyPrefix", () => {
  it("returns nothing when the first item is still pending", () => {
    const result = computeReadyPrefix(slots("pending", 2, 3), 0);
    expect(result).toEqual({ ready: [], nextIndex: 0 });
  });

  it("flushes only the consecutive ready prefix, holding back out-of-order arrivals", () => {
    // Word 3 resolved before word 2 — must not be emitted yet.
    const result = computeReadyPrefix(slots(1, "pending", 3), 0);
    expect(result).toEqual({ ready: [1], nextIndex: 1 });
  });

  it("flushes everything once the whole prefix is ready", () => {
    const result = computeReadyPrefix(slots(1, 2, 3), 0);
    expect(result).toEqual({ ready: [1, 2, 3], nextIndex: 3 });
  });

  it("resumes from a non-zero fromIndex without re-emitting earlier items", () => {
    const result = computeReadyPrefix(slots(1, 2, 3, "pending", 5), 2);
    expect(result).toEqual({ ready: [3], nextIndex: 3 });
  });

  it("skips null results (no asset / not fingerspellable) but still advances past them", () => {
    const result = computeReadyPrefix(slots(1, null, 3), 0);
    expect(result).toEqual({ ready: [1, 3], nextIndex: 3 });
  });

  it("is a no-op once everything has already been flushed", () => {
    const result = computeReadyPrefix(slots(1, 2), 2);
    expect(result).toEqual({ ready: [], nextIndex: 2 });
  });

  it("handles an empty sequence", () => {
    const result = computeReadyPrefix([], 0);
    expect(result).toEqual({ ready: [], nextIndex: 0 });
  });
});
