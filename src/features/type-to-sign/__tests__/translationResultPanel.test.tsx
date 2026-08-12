import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { AnimationClip } from "@/features/sign-animation/types";
import type { AnimationPlanItem } from "@/features/translation-pipeline/types";

/**
 * The result panel has to actually appear when a translation finishes.
 *
 * It did not, for either kind of translation, on every run: the panel is the
 * only place the FSL gloss row and the "spelled letter by letter" note exist,
 * and a user who translated anything got a progress checklist stuck on "Ready"
 * instead. The hook was reaching `stage: "done"` the whole time — the panel was
 * being withheld by `<AnimatePresence mode="wait">`, which will not mount the
 * incoming child until the outgoing one reports its exit animation complete.
 *
 * Two things have to be true for that report to go missing, and this test
 * arranges both deliberately, because with either one absent the old code
 * passes and the test is worthless:
 *
 *   - the progress panel must have finished animating in before it is removed,
 *     which is why assets are held behind a gate the test opens rather than
 *     resolving as fast as a mock can; and
 *   - the update that removes it must arrive from a promise continuation
 *     rather than a React event handler, which is what clicking Translate and
 *     letting the hook's `await Promise.all` settle produces. Removing it from
 *     inside a click handler animates out perfectly well.
 *
 * Asserted through the rendered interface rather than the hook, since the hook
 * was never the broken part. The assertions are the panel's user-visible
 * content, not an implementation detail of how the swap is staged.
 */

const asset = (gloss: string) => ({
  gloss, duration: 1000, fps: 30, totalFrames: 30,
  frames: [{ timestamp: 0, landmarks: [] }],
} as unknown as AnimationClip["asset"]);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Assets are held until the test releases them, rather than resolving after a
 * fixed delay. The bug needs the progress panel to have finished animating in
 * before the translation completes, and a timeout long enough for that today is
 * a timeout that silently stops reproducing it when an animation is retuned.
 */
let assetGate: Promise<void>;
let releaseAssets: () => void;

vi.mock("@/features/sign-animation/hooks/useAnimationClip", () => ({
  globalLoader: {
    load: vi.fn(async (gloss: string) => { await assetGate; return asset(gloss); }),
    preload: vi.fn(async () => {}),
  },
}));

vi.mock("@/features/sign-animation/publishedGlosses", async () => {
  const actual = await vi.importActual<typeof import("@/features/sign-animation/publishedGlosses")>(
    "@/features/sign-animation/publishedGlosses",
  );
  return {
    ...actual,
    publishedGlosses: { has: vi.fn(async () => false), load: vi.fn(async () => new Set<string>()) },
  };
});

const translateMock = vi.fn();
vi.mock("@/features/translation-pipeline", () => ({
  globalPipeline: { translate: (text: string) => translateMock(text) },
}));

// The stage renders landmarks to a canvas and is not what this test is about.
vi.mock("../components/SignStageViewer", () => ({
  SignStageViewer: () => <div data-testid="sign-stage" />,
}));

const { TypeToSignInterface } = await import("../TypeToSignInterface");

const planItem = (
  gloss: string, original: string, fallbackUsed: boolean,
): AnimationPlanItem => ({
  gloss, original, animationKey: gloss, fallbackUsed,
} as unknown as AnimationPlanItem);

const pipelineResult = (text: string, language: "en" | "tl", items: AnimationPlanItem[]) => ({
  originalText: text,
  normalized: { normalized: text.toLowerCase() },
  language: { language },
  metrics: { coverage: 1 },
  animationPlan: { items },
});

const progressPanel = (container: HTMLElement) =>
  container.querySelector('[aria-label="Translation progress"]');

/**
 * Waits are plain timers rather than `waitFor`, and the assertions below are
 * synchronous. `waitFor` polls inside `act()`, and those extra flushes are
 * enough to shake the stuck panel loose — a test built on it passes against the
 * broken code and proves nothing.
 */
const SETTLE_MS = 900;

/**
 * Types the phrase, clicks Translate, and hands back a container whose progress
 * panel has finished animating in. Assets are still held at that point.
 */
async function translateAndSettle(text: string) {
  const view = render(<TypeToSignInterface />);
  fireEvent.change(view.container.querySelector("textarea")!, { target: { value: text } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^translate$/i })); });
  await act(async () => { await delay(SETTLE_MS); });

  const panel = progressPanel(view.container);
  expect(panel).not.toBeNull();
  // Guards the precondition instead of trusting the timer: framer-motion parks a
  // settled element on its `animate` values, so this is what "the enter
  // animation is over" looks like. If a retuned animation outlasts SETTLE_MS,
  // this fails loudly rather than quietly ceasing to reproduce the bug.
  expect(panel!.getAttribute("style")).toContain("opacity: 1");
  return view;
}

/** Completes the translation the way production does: from a promise continuation. */
async function finishLoading() {
  await act(async () => { releaseAssets(); await delay(SETTLE_MS); });
}

function resultPanel(container: HTMLElement) {
  const heading = container.querySelector("#translation-heading");
  expect(heading, "result panel never appeared after the translation finished").not.toBeNull();
  return heading!.closest("section")!;
}

beforeEach(() => {
  translateMock.mockReset();
  assetGate = new Promise<void>((resolve) => { releaseAssets = resolve; });
});

describe("translation result panel", () => {
  it("appears once a published-sign translation finishes", async () => {
    translateMock.mockReturnValue(
      pipelineResult("Salamat", "tl", [planItem("THANK YOU", "Salamat", false)]),
    );

    const { container } = await translateAndSettle("Salamat");
    await finishLoading();

    const panel = resultPanel(container);

    // The checklist is gone once the result takes its place, rather than being
    // left on screen reading "Ready" underneath it.
    expect(progressPanel(container)).toBeNull();

    expect(within(panel).getByText("Salamat")).toBeTruthy();
    // The FSL gloss row — reachable nowhere else in the app.
    expect(within(panel).getByText("THANK YOU")).toBeTruthy();
    // Count and unit are separate elements, so this reads the panel's own text.
    expect(panel.textContent).toContain("1 sign ready to play");
  });

  it("appears for a fingerspelled translation, and names the source words spelled", async () => {
    // No published sign, so the word is spelled from the alphabet: 7 letters.
    translateMock.mockReturnValue(
      pipelineResult("Kamusta", "tl", [planItem("HOW ARE YOU", "Kamusta", true)]),
    );

    const { container } = await translateAndSettle("Kamusta");
    await finishLoading();

    const panel = resultPanel(container);

    expect(progressPanel(container)).toBeNull();
    expect(panel.textContent).toContain("7 signs ready to play");

    // The note is the only thing that tells the user why the animation spells a
    // word out, and it names what was actually spelled — the source, not the gloss.
    const note = within(panel).getByText(/Spelled letter by letter/).closest("p")!;
    expect(note.textContent).toContain("Kamusta");
    expect(note.textContent).not.toContain("HOW ARE YOU");
  });
});
