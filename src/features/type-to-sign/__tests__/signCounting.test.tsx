import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { AnimationClip } from "@/features/sign-animation/types";
import type { AnimationPlanItem } from "@/features/translation-pipeline/types";

/**
 * The loader's "sign N of M" counter.
 *
 * It counts signs, not words, and the two differ by an order of magnitude
 * exactly where the wait is longest: PROGRAMMING is one word and eleven signs.
 * The arithmetic has two ways to go quietly wrong — reporting fetches instead
 * of signs, which stalls the bar at 8 of 11 because the word has only eight
 * distinct letters, and settling a word on top of progress it already
 * reported, which overshoots the total.
 */

const asset = (gloss: string) => ({
  gloss, duration: 1000, fps: 30, totalFrames: 30,
  frames: [{ timestamp: 0, landmarks: [] }],
} as unknown as AnimationClip["asset"]);

const load = vi.fn(async (gloss: string) => asset(gloss));

vi.mock("@/features/sign-animation/hooks/useAnimationClip", () => ({
  globalLoader: { load: (g: string) => load(g) },
}));

const translateMock = vi.fn();
vi.mock("@/features/translation-pipeline", () => ({
  globalPipeline: { translate: (t: string) => translateMock(t) },
}));

const { useProgressiveSignTranslation } = await import("../useProgressiveSignTranslation");

const planItem = (gloss: string, fallbackUsed: boolean): AnimationPlanItem => ({
  gloss, original: gloss, animationKey: gloss, fallbackUsed,
} as unknown as AnimationPlanItem);

const planOf = (items: AnimationPlanItem[]) => ({
  animationPlan: { items },
  language: { language: "en" },
  metrics: { coverage: 1 },
});

beforeEach(() => {
  load.mockClear();
  translateMock.mockReset();
});

describe("sign counting", () => {
  it("counts every letter of a fingerspelled word, not every fetch", async () => {
    // One word, eleven letters, eight of them distinct.
    translateMock.mockReturnValue(planOf([planItem("PROGRAMMING", true)]));

    const { result } = renderHook(() => useProgressiveSignTranslation({
      resolveFallback: async (item, index, progress) => {
        const characters = item.gloss.split("");
        progress.setSigns(characters.length);
        const distinct = [...new Set(characters)];
        await Promise.all(distinct.map(async (c) => {
          await load(c);
          progress.signsLoaded(characters.filter((x) => x === c).length);
        }));
        return characters.map((c, i) => ({
          id: `spell-${c}-${i}`, gesture: c, asset: asset(c),
        })) as AnimationClip[];
      },
    }));

    await act(async () => { await result.current.translate("PROGRAMMING"); });
    await waitFor(() => expect(result.current.stage).toBe("done"));

    // Eleven signs, and the loader reached all of them — not the eight
    // requests it took to get there.
    expect(result.current.totalCount).toBe(11);
    expect(result.current.loadedCount).toBe(11);
    expect(load).toHaveBeenCalledTimes(8);
  });

  it("never reports more loaded than the sentence will produce", async () => {
    translateMock.mockReturnValue(planOf([
      planItem("HELLO", true),
      planItem("WORLD", true),
    ]));

    const { result } = renderHook(() => useProgressiveSignTranslation({
      resolveFallback: async (item, index, progress) => {
        const characters = item.gloss.split("");
        progress.setSigns(characters.length);
        // Deliberately over-reports: a resolver that miscounts must not be
        // able to push the bar past its own total.
        progress.signsLoaded(characters.length + 5);
        return characters.map((c, i) => ({
          id: `s-${index}-${i}`, gesture: c, asset: asset(c),
        })) as AnimationClip[];
      },
    }));

    await act(async () => { await result.current.translate("HELLO WORLD"); });
    await waitFor(() => expect(result.current.stage).toBe("done"));

    expect(result.current.totalCount).toBe(10);
    expect(result.current.loadedCount).toBe(10);
  });

  it("counts a published word as the one sign it is", async () => {
    translateMock.mockReturnValue(planOf([planItem("THANK YOU", false)]));

    const { result } = renderHook(() => useProgressiveSignTranslation({}));

    await act(async () => { await result.current.translate("THANK YOU"); });
    await waitFor(() => expect(result.current.stage).toBe("done"));

    expect(result.current.totalCount).toBe(1);
    expect(result.current.loadedCount).toBe(1);
  });
});
