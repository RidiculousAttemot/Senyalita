import { expect, test } from "@playwright/test";

/**
 * The two things /translate lacked for a room demo.
 *
 * Both are measured rather than asserted structurally: a class name proves
 * nothing about what a panel can actually read from three metres, so these
 * compare computed pixel values before and after.
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe("projector affordances", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  /** Translate a single published letter so the stage has a clip to show. */
  async function stageOneSign(page: import("@playwright/test").Page) {
    await page.goto(`${BASE}/translate`);
    const input = page.locator("#composer-input");
    await expect(input).toBeVisible({ timeout: 150_000 });

    // Retry the fill until React registers it. The composer is a controlled
    // input: filling it before hydration sets the DOM value, which React then
    // discards when it attaches — the field looks filled, state stays empty,
    // and the Translate button never enables. Re-filling is the reliable
    // signal; waiting on a React fiber key is not, because that property does
    // not survive a production build.
    const button = page.getByRole("button", { name: /^translate$/i });
    await expect
      .poll(
        async () => {
          await input.fill("A");
          return button.isEnabled();
        },
        { timeout: 150_000, intervals: [250, 500, 1000] },
      )
      .toBe(true);

    await button.click();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 150_000 });
  }

  test("presentation mode enlarges the gloss the audience reads", async ({ page }) => {
    await stageOneSign(page);

    const gloss = page.getByTestId("stage-gloss");
    await expect(gloss).toBeVisible();

    const fontSize = async () =>
      parseFloat(await gloss.evaluate((el) => getComputedStyle(el).fontSize));

    const windowed = await fontSize();
    await page.getByRole("button", { name: /^presentation mode$/i }).click();
    const presenting = await fontSize();

    // The windowed size is text-xl (20px), which is the size that prompted
    // this: legible at a laptop, not from the back of a room.
    expect(windowed).toBeLessThanOrEqual(24);
    expect(presenting).toBeGreaterThan(windowed * 1.5);

    // And it goes back, so the control is a toggle rather than a one-way door.
    await page.getByRole("button", { name: /^exit presentation mode$/i }).click();
    expect(await fontSize()).toBeCloseTo(windowed, 0);
  });

  test("fullscreen grows the canvas instead of just blacking out the page", async ({ page }) => {
    // A viewport TALLER than the stage's largest fixed height (xl:h-[720px]).
    // At Playwright's 1280x720 default this test is worthless: the old fixed
    // height is 720, the viewport is 720, so every "did it grow" threshold
    // passes on the broken build. Verified — the earlier version of this test
    // passed against a deliberately reverted stage. The bug is only visible on
    // a screen bigger than the box, which is the projector case anyway.
    await page.setViewportSize({ width: 1600, height: 1000 });

    await stageOneSign(page);

    const canvas = page.locator("canvas").first();
    const before = await canvas.evaluate((el: HTMLCanvasElement) => el.height);
    // Sanity: windowed really is the capped height, not already full-bleed.
    expect(before).toBeLessThanOrEqual(760);

    await page.getByRole("button", { name: /^fullscreen$/i }).click();
    await expect(page.getByTestId("sign-stage")).toHaveAttribute("data-fullscreen", "true", {
      timeout: 10_000,
    });

    // The ResizeObserver re-measures the surface, which the canvas follows.
    // The assertion is against the VIEWPORT, not against `before`: the stage
    // used to keep its 720px cap in fullscreen, so a relative check was
    // satisfied by incidental width changes while a third of the screen went
    // unused.
    // PROPORTIONAL TO THE REPORTED VIEWPORT, not to the requested one.
    //
    // This asserted against 1000 * 0.85 because setViewportSize was asked for
    // 1000. What a browser actually reports in fullscreen is its own business:
    // webkit came back with 768, so the canvas filled its viewport completely
    // and still failed an assertion that had hardcoded someone else's height.
    // The property under test is "the canvas fills the screen", which is a
    // ratio, so measure it as one.
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    await expect
      .poll(async () => canvas.evaluate((el: HTMLCanvasElement) => el.height), { timeout: 10_000 })
      .toBeGreaterThan(viewportHeight * 0.85);
  });
});
