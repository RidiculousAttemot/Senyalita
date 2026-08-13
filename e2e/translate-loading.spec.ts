import { test, expect, type Page } from "@playwright/test";

/**
 * The loader has to outlast the blank.
 *
 * It used to clear on `clips.length > 0` — the moment the first landmark JSON
 * resolved — and everything after that was invisible to it: the player
 * mounting, its engine and renderers being constructed, the first animation
 * frame, and in the modes that show the recording a multi-megabyte video
 * fetching and decoding. The stage rendered empty, with nothing over it.
 *
 * So this asserts on pixels rather than on state. This system has reported a
 * correct clip list and a correct duration while drawing nothing, which is
 * exactly the failure a state-based assertion cannot see.
 *
 * Set E2E_BASE_URL to run against a deployment.
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/** Non-transparent pixels on the stage canvas, sampled sparsely. */
const canvasInk = (page: Page) => page.evaluate(() => {
  const canvas = document.querySelector('[data-testid="sign-stage"] canvas') as HTMLCanvasElement | null;
  if (!canvas || !canvas.width) return { present: false, ink: 0 };
  const ctx = canvas.getContext("2d");
  if (!ctx) return { present: true, ink: 0 };
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let ink = 0;
  for (let i = 3; i < data.length; i += 4 * 37) if (data[i] !== 0) ink += 1;
  return { present: true, ink };
});

/**
 * The overlay, found by testid rather than by its wording.
 *
 * This matched text, and the text it matched was mostly wrong. The stage
 * cycles through "Preparing translation…", "Extracting landmarks…", "Loading
 * animation…" and "Almost ready…" every 900ms, and only the third matched —
 * so for roughly three seconds of every four the loader was covering the stage
 * and this reported it absent. The blank canvas underneath was then counted as
 * an uncovered blank, which is the exact defect this file exists to catch, so
 * the probe manufactured its own failures.
 *
 * Half the terms it did match ("Detecting language", "Normalizing", "Finding
 * glosses", "Generating animation") belong to the pipeline checklist in
 * TranslationResult, which is not inside the stage at all and never could have
 * matched here.
 */
const loaderVisible = (page: Page) =>
  page.locator('[data-testid="stage-loader"]').first().isVisible().catch(() => false);

const translate = async (page: Page, text: string) => {
  await page.goto(`${BASE}/translate`);
  await page.locator("textarea").first().fill(text);
  // Wait for hydration before clicking. The button is disabled until React
  // registers the fill, so clicking early retries against a disabled control
  // until the test times out — reported as "locator.click: Test timeout", which
  // says nothing about loading behaviour. /translate hydrates behind ~38 asset
  // requests, so webkit under a loaded server needs real room here.
  const button = page.getByRole("button", { name: /^Translate$/ });
  await expect(button).toBeEnabled({ timeout: 120_000 });
  await button.click();
};

/**
 * Walks the stage from submit until it has pixels, sampling both the loader and
 * the canvas together so a gap between them is observable.
 */
const observeUntilPainted = async (page: Page, timeoutMs: number) => {
  const startedAt = Date.now();
  let firstPaintMs: number | null = null;
  let blankUncoveredSamples = 0;
  let loaderEverSeen = false;
  let playingUnderLoaderSamples = 0;
  let previousInk: number | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const [loader, canvas] = await Promise.all([loaderVisible(page), canvasInk(page)]);
    if (loader) loaderEverSeen = true;
    // The sign advancing while the overlay still covers it: the viewer meets
    // it already in progress. A static opening pose under the loader is fine
    // and expected — a *changing* one is not.
    //
    // `previousInk > 0` is what makes that distinction real. Without it the
    // very arrival of the opening pose was counted: the stage is blank under
    // the loader, frame 0 is painted, and ink goes 0 -> 13254 while the
    // overlay is still up for the commit that takes it down. That is the
    // designed sequence, and flagging it contradicted the sentence above.
    // Measured: every failure this probe reported was previousInk=0.
    if (loader && previousInk !== null && previousInk > 0 && canvas.ink > 0 && canvas.ink !== previousInk) {
      playingUnderLoaderSamples += 1;
    }
    previousInk = canvas.ink;
    if (canvas.ink > 0 && !loader) { firstPaintMs = Date.now() - startedAt; break; }
    // The defect, stated directly: nothing drawn, and nothing covering it.
    if (!loader && canvas.present) blankUncoveredSamples += 1;
    await page.waitForTimeout(100);
  }
  return { firstPaintMs, blankUncoveredSamples, loaderEverSeen, playingUnderLoaderSamples };
};

test.describe("type-to-sign loading", () => {
  test.describe.configure({ retries: 1 });

  const cases: Array<{ name: string; text: string; budgetMs: number }> = [
    { name: "single letter", text: "A", budgetMs: 90_000 },
    { name: "published word", text: "HELLO", budgetMs: 120_000 },
    { name: "11-letter fingerspell", text: "PROGRAMMING", budgetMs: 180_000 },
  ];

  for (const { name, text, budgetMs } of cases) {
    test(`${name}: never shows an uncovered blank stage`, async ({ page }) => {
      test.setTimeout(budgetMs + 60_000);
      await translate(page, text);

      const { firstPaintMs, blankUncoveredSamples, loaderEverSeen, playingUnderLoaderSamples } =
        await observeUntilPainted(page, budgetMs);

      // eslint-disable-next-line no-console
      console.log(
        `  ${name.padEnd(22)} "${text}"  visible at ${firstPaintMs ?? "never"}ms`
        + `  uncovered-blank ${blankUncoveredSamples}`
        + `  playing-under-loader ${playingUnderLoaderSamples}`,
      );

      expect(
        playingUnderLoaderSamples,
        "the sign was already playing while the loader still covered it",
      ).toBe(0);

      // Deliberately not asserting that a loader was seen at all: on a warm
      // CDN cache the whole sequence can resolve inside one sampling interval,
      // and "too fast to show a spinner" is not a failure.
      void loaderEverSeen;
      expect(firstPaintMs, "the stage never drew anything").not.toBeNull();
      // The requirement: the loader stays up until something is painted.
      expect(
        blankUncoveredSamples,
        `stage was blank with no loader over it for ~${blankUncoveredSamples * 100}ms`,
      ).toBe(0);
    });
  }

  test("a word with no published sign still fingerspells", async ({ page }) => {
    test.setTimeout(240_000);
    await translate(page, "PROGRAMMING");

    // Every character gets its own clip, so the counter proves the fallback
    // expanded rather than dropping the word.
    await expect(page.getByTestId("stage-counter"))
      .toHaveText(/of\s*11/i, { timeout: 180_000 });

    const { ink } = await canvasInk(page);
    expect(ink, "fingerspelled sequence rendered nothing").toBeGreaterThan(0);
  });
});
