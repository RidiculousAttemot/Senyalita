import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * A free-text box in front of a library of 2.3-4.4MB assets.
 *
 * The panel this replaced drew 21 hardcoded coordinates that were identical for
 * every input, under a stage label reading "Signing". Putting the real player
 * there is only viable if typing stays free: fetching an animation per debounced
 * keystroke would be far worse than the static hand was.
 *
 * So the load policy is the thing under test, and none of it is visible by
 * looking at the rendered panel. The translation pipeline is deliberately NOT
 * mocked -- the second test exists to prove the gloss on screen comes back from
 * the engine rather than from a literal, which a mock would defeat.
 */

const load = vi.fn(async (_gloss: string): Promise<null> => null);
vi.mock("@/features/sign-animation/hooks/useAnimationClip", () => ({
  globalLoader: { load: (gloss: string) => load(gloss) },
}));

vi.mock("@/features/sign-animation/publishedGlosses", () => ({
  publishedGlosses: { load: async () => new Set(["HOW ARE YOU", "THANK YOU", "GOOD MORNING"]) },
}));

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

const { InteractiveShowcaseSection } = await import("../InteractiveShowcaseSection");

/** Renders and scrolls the section into view, which is what starts anything. */
async function show() {
  const result = render(<InteractiveShowcaseSection />);
  await act(async () => { observed.forEach((fire) => fire()); });
  return result;
}

beforeEach(() => {
  load.mockClear();
  observed = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("ResizeObserver", class {
    observe() {} disconnect() {} unobserve() {}
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("landing showcase panel", () => {
  it("fetches no animation on mount or on scroll into view", async () => {
    await show();
    // The hero panel already spends 2.34MB when it scrolls into view. A second
    // automatic asset here would double that for someone who only scrolled past.
    expect(load).not.toHaveBeenCalled();
  });

  // Generous on purpose. This is the only case that waits on the translation
  // pipeline's dynamic import rather than on an already-resolved value, and
  // under the full suite that import competes with 79 other files -- it failed
  // once at a 10s budget while passing every time in isolation. The assertion
  // is about what the engine returns, not about how fast it loads, so the
  // timeout should not be the thing under test.
  it("shows the gloss the engine actually returns for the demo phrase", { timeout: 60_000 }, async () => {
    const { container } = await show();

    // The literal this panel used to carry was ["KAMUSTA", "KA"]. The engine
    // resolves "Kamusta ka?" to a single HOW ARE YOU, and neither KAMUSTA nor
    // KA is a published sign -- so the old panel advertised a result the system
    // would never produce, directly under "this runs the real engine".
    await waitFor(() => expect(container.textContent).toContain("HOW ARE YOU"), { timeout: 45_000 });
    expect(container.textContent).not.toMatch(/\bKAMUSTA\b/);
    expect(container.textContent).not.toMatch(/\bKA\b/);
  });

  it("resolves typed text to gloss without fetching anything", async () => {
    await show();
    await waitFor(() => expect(screen.getByText("HOW ARE YOU")).toBeTruthy());

    const input = screen.getByLabelText(/your message/i);
    // Every keystroke of a real word, the way a visitor types it.
    for (const value of ["S", "Sa", "Sal", "Sala", "Salam", "Salama", "Salamat"]) {
      fireEvent.change(input, { target: { value } });
    }
    await act(async () => { await new Promise((r) => setTimeout(r, 500)); });

    // The gloss is on screen -- resolution happened -- and it cost no network.
    await waitFor(() => expect(screen.getByText("THANK YOU")).toBeTruthy());
    expect(load).not.toHaveBeenCalled();
  });

  it("fetches only when the play control is pressed, and only once", async () => {
    await show();
    const play = await screen.findByRole("button", { name: /play how are you/i });

    fireEvent.click(play);
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("HOW ARE YOU");

    // A second press must not re-fetch megabytes: the request is keyed by gloss.
    fireEvent.click(screen.getByRole("button", { name: /sign unavailable/i }));
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("offers no play control for a phrase with no recorded sign", async () => {
    await show();
    await waitFor(() => expect(screen.getByText("HOW ARE YOU")).toBeTruthy());

    // LOVE is not published and KITA is fingerspelled, so there is nothing to
    // play. A play button that can only fail is worse than none.
    fireEvent.change(screen.getByLabelText(/your message/i), { target: { value: "Mahal kita" } });
    await act(async () => { await new Promise((r) => setTimeout(r, 500)); });

    await waitFor(() => expect(screen.getByText("LOVE")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /^play /i })).toBeNull();
    expect(screen.getByText(/no recording for these signs yet/i)).toBeTruthy();
  });

  it("keeps the expensive modules out of the landing page's first load", async () => {
    /**
     * A source-level guard, because the cost is decided by the import keyword
     * and nothing else. The whole load policy rests on the player, the loader,
     * the pipeline and the trim helper being reachable only through dynamic
     * import; a single static one silently moves them into the bundle every
     * visitor pays for, and no rendered assertion would notice.
     *
     * This already happened once: activeSpan went in as a static import and
     * had to be moved back out.
     */
    const fs = await import("node:fs");
    const heavy = [
      "@/features/sign-animation/player/SignAnimationPlayer",
      "@/features/sign-animation/hooks/useAnimationClip",
      "@/features/sign-animation/activeSpan",
      "@/features/sign-animation/publishedGlosses",
      "@/features/translation-pipeline",
    ];
    for (const file of ["InteractiveShowcaseSection.tsx", "SignPlaybackDemo.tsx"]) {
      const source = fs.readFileSync(`src/components/landing/${file}`, "utf8");
      for (const mod of heavy) {
        // `import x from "mod"` at the top of a line is static; `import("mod")`
        // and `import type` are not.
        const statically = new RegExp(`^import\\s+(?!type\\b)[^\\n]*["']${mod.replace(/[/@]/g, "\\$&")}["']`, "m");
        expect(statically.test(source), `${file} statically imports ${mod}`).toBe(false);
      }
    }
  });

  it("claims no accuracy figure and no fabricated pipeline stages", async () => {
    const { container } = await show();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\d+% match/);
    expect(text).not.toMatch(/confidence/i);
    // The scripted four-stage loop -- "Reading text", "Detecting language",
    // "Mapping to FSL", "Signing" -- was theatre on a timer, and "Signing" sat
    // beside a hand that was not signing.
    expect(text).not.toMatch(/reading text/i);
    expect(text).not.toMatch(/detecting language/i);
  });
});
