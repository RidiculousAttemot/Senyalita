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

const loaderVisible = (page: Page) =>
  page.locator('[data-testid="sign-stage"]').getByText(/Loading|Detecting language|Normalizing|Finding glosses|Generating animation/i)
    .first().isVisible().catch(() => false);

const translate = async (page: Page, text: string) => {
  await page.goto(`${BASE}/translate`);
  await page.locator("textarea").first().fill(text);
  await page.getByRole("button", { name: /^Translate$/ }).click();
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

  while (Date.now() - startedAt < timeoutMs) {
    const [loader, canvas] = await Promise.all([loaderVisible(page), canvasInk(page)]);
    if (loader) loaderEverSeen = true;
    if (canvas.ink > 0) { firstPaintMs = Date.now() - startedAt; break; }
    // The defect, stated directly: nothing drawn, and nothing covering it.
    if (!loader && canvas.present) blankUncoveredSamples += 1;
    await page.waitForTimeout(100);
  }
  return { firstPaintMs, blankUncoveredSamples, loaderEverSeen };
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

      const { firstPaintMs, blankUncoveredSamples, loaderEverSeen } =
        await observeUntilPainted(page, budgetMs);

      // eslint-disable-next-line no-console
      console.log(
        `  ${name.padEnd(22)} "${text}"  first paint ${firstPaintMs ?? "never"}ms`
        + `  uncovered-blank samples ${blankUncoveredSamples}`,
      );

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
