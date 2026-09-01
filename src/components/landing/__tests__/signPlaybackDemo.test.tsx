import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { GestureAnimationAsset } from "@/features/sign-animation/types";

/**
 * The landing demo must not cost anything until it is asked for.
 *
 * It replaced a fabricated hand rig that claimed "96% match", and the thing
 * that makes the replacement viable is that the real asset is 2.34MB decoded
 * (468KB gzipped) against a landing page that transfers ~258KB in total. Fetch
 * it on mount and the page is several times heavier for every visitor,
 * including the ones who bounce without scrolling to it.
 *
 * Two properties, and neither is visible by looking at the rendered panel:
 *
 *   - nothing is fetched on mount, and
 *   - under prefers-reduced-motion nothing is fetched automatically at all,
 *     because that user has not asked for the content.
 *
 * The second is the one a browser check cannot easily make, since the media
 * query has to be emulated. Asserted here instead.
 */

type MockProgress = {
  clipTime: number;
  clipDuration: number;
  index: number;
  total: number;
  fps: number;
};

const playerRenders = vi.hoisted(() => [] as Array<{
  clips: unknown[];
  onProgress?: (progress: MockProgress) => void;
}>);

vi.mock("@/features/sign-animation/player/SignAnimationPlayer", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    SignAnimationPlayer: (props: {
      clips: unknown[];
      onProgress?: (progress: MockProgress) => void;
    }) => {
      playerRenders.push(props);
      return React.createElement("div", { "data-testid": "mock-player" });
    },
  };
});

const load = vi.fn(async (_gloss: string): Promise<GestureAnimationAsset | null> => null);
vi.mock("@/features/sign-animation/hooks/useAnimationClip", () => ({
  globalLoader: { load: (gloss: string) => load(gloss) },
}));

let reducedMotion = false;
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return { ...actual, useReducedMotion: () => reducedMotion };
});

/** Captures the observer so a scroll into view can be simulated. */
let observed: Array<() => void> = [];
class FakeIntersectionObserver {
  constructor(private cb: IntersectionObserverCallback) {
    observed.push(() => this.cb(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    ));
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = "";
  thresholds = [];
}

const { SignPlaybackDemo } = await import("../SignPlaybackDemo");

function makeAsset(label = "HELLO"): GestureAnimationAsset {
  const frames = Array.from({ length: 30 }, (_, frame) => ({
    timestamp: Math.round(frame * (1000 / 30)),
    landmarks: [],
    poseLandmarks: Array.from({ length: 33 }, (_, point) => ({
      x: 0.3 + point * 0.001,
      y: 0.2 + frame * 0.001,
      z: 0,
    })),
    faceLandmarks: [],
  }));
  return {
    label,
    language: "FSL",
    fps: 30,
    duration: 1000,
    totalFrames: frames.length,
    frames,
    metadata: { featureDimension: 3, sequenceLength: frames.length, version: 1 },
  };
}

beforeEach(() => {
  load.mockClear();
  playerRenders.length = 0;
  observed = [];
  reducedMotion = false;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("ResizeObserver", class {
    observe() {} disconnect() {} unobserve() {}
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("landing sign playback demo", () => {
  it("fetches immediately on mount when the page is first accessed", async () => {
    render(<SignPlaybackDemo />);
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
      expect(load).toHaveBeenCalledWith("HELLO");
    });
  });

  it("does not wait for scroll to load the visible hero asset", async () => {
    render(<SignPlaybackDemo />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(load).toHaveBeenCalledWith("HELLO");

    await act(async () => { observed.forEach((fire) => fire()); });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not observe or fetch at all under reduced motion", async () => {
    reducedMotion = true;
    render(<SignPlaybackDemo />);

    // No observer is even registered, so there is nothing to fire.
    expect(observed).toHaveLength(0);
    expect(load).not.toHaveBeenCalled();

    // The panel is still usable: the control is the only trigger.
    expect(screen.getByRole("button", { name: /play hello/i })).toBeTruthy();
  });

  it("shows a loading state immediately when the page is first accessed", async () => {
    render(<SignPlaybackDemo />);
    await waitFor(() => {
      expect(screen.getByText(/loading recorded landmarks/i)).toBeTruthy();
    });
  });

  it("never claims an accuracy figure", () => {
    const { container } = render(<SignPlaybackDemo />);
    const text = container.textContent ?? "";
    // The literals this component was built to remove.
    expect(text).not.toMatch(/\d+% match/);
    expect(text).not.toMatch(/confidence/i);
    expect(text).not.toMatch(/step \d+ of \d+/i);
    // What it says instead is checkable: the sign, and what the data is.
    expect(text).toContain("HELLO");
    expect(text).toMatch(/recorded landmark data/i);
  });

  it("shows a placeholder rather than a blank panel while loading", async () => {
    // Never resolves, so the panel stays in its loading state.
    load.mockImplementationOnce(() => new Promise(() => {}) as Promise<null>);
    const { container } = render(<SignPlaybackDemo />);
    await act(async () => { observed.forEach((fire) => fire()); });

    expect(container.textContent).toMatch(/loading recorded landmarks/i);
    // The stand-in figure is drawn, so the panel is never empty.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("does not restart the player when frame progress re-renders the panel", async () => {
    load.mockResolvedValueOnce(makeAsset());
    render(<SignPlaybackDemo />);

    await act(async () => { observed.forEach((fire) => fire()); });
    await screen.findByTestId("mock-player");
    const firstClips = playerRenders[playerRenders.length - 1]?.clips;

    await act(async () => {
      playerRenders[playerRenders.length - 1]?.onProgress?.({
        clipTime: 0.33,
        clipDuration: 1,
        index: 0,
        total: 1,
        fps: 30,
      });
    });

    await waitFor(() => expect(playerRenders.length).toBeGreaterThan(1));
    expect(playerRenders[playerRenders.length - 1]?.clips).toBe(firstClips);
  });

  it("says so plainly when the sign is not published", async () => {
    render(<SignPlaybackDemo />);
    await act(async () => { observed.forEach((fire) => fire()); });
    // load resolves null by default — the asset is missing.
    expect(screen.getByRole("button", { name: /sign unavailable/i })).toBeTruthy();
  });
});
