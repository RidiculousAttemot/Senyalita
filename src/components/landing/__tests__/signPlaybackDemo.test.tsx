import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

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

const load = vi.fn(async (_gloss: string): Promise<null> => null);
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

beforeEach(() => {
  load.mockClear();
  observed = [];
  reducedMotion = false;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("ResizeObserver", class {
    observe() {} disconnect() {} unobserve() {}
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("landing sign playback demo", () => {
  it("fetches nothing on mount", () => {
    render(<SignPlaybackDemo />);
    expect(load).not.toHaveBeenCalled();
  });

  it("fetches once the panel scrolls into view", async () => {
    render(<SignPlaybackDemo />);
    expect(load).not.toHaveBeenCalled();

    await act(async () => { observed.forEach((fire) => fire()); });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("KNOW");
  });

  it("does not observe or fetch at all under reduced motion", async () => {
    reducedMotion = true;
    render(<SignPlaybackDemo />);

    // No observer is even registered, so there is nothing to fire.
    expect(observed).toHaveLength(0);
    expect(load).not.toHaveBeenCalled();

    // The panel is still usable: the control is the only trigger.
    expect(screen.getByRole("button", { name: /play know/i })).toBeTruthy();
  });

  it("offers a play control before anything is loaded", () => {
    render(<SignPlaybackDemo />);
    expect(screen.getByRole("button", { name: /play know/i })).toBeTruthy();
  });

  it("never claims an accuracy figure", () => {
    const { container } = render(<SignPlaybackDemo />);
    const text = container.textContent ?? "";
    // The literals this component was built to remove.
    expect(text).not.toMatch(/\d+% match/);
    expect(text).not.toMatch(/confidence/i);
    expect(text).not.toMatch(/step \d+ of \d+/i);
    // What it says instead is checkable: the sign, and what the data is.
    expect(text).toContain("KNOW");
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

  it("says so plainly when the sign is not published", async () => {
    render(<SignPlaybackDemo />);
    await act(async () => { observed.forEach((fire) => fire()); });
    // load resolves null by default — the asset is missing.
    expect(screen.getByRole("button", { name: /sign unavailable/i })).toBeTruthy();
  });
});
