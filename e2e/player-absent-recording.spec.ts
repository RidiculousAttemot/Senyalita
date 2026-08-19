import { test, expect, type Page } from "@playwright/test";

/**
 * The skeleton must draw, and the recording path must stay alive underneath it.
 *
 * WHAT THIS SPEC USED TO BE. Five tests drove the Human / Split / Overlay
 * switcher: three checked that a sign with no recording still explained itself
 * and still painted, two checked that A -- the one sign that still has a
 * recording -- played its video. That switcher is gone from the public app.
 * Every source video except A's was deleted from Storage to fit the 91-sign
 * batch inside the free tier, so 129 of 130 signs answered all three modes with
 * "Recording unavailable", and offering three broken options was worse than
 * offering one that works.
 *
 * So the UI half of this file could not survive: it clicked controls that no
 * longer exist. Deleting the file outright was the other option and is the
 * wrong one, because the data path deliberately stayed behind --
 * /api/animations/[gloss]/video still serves, source_video_path is still
 * written, and the seeder still uploads. Nothing else would notice that rotting
 * until someone tried to re-enable the modes and found the route gone.
 *
 * The pixel assertions move to the one view that ships. The video assertions
 * become route assertions, which is where the contract now lives.
 */

const TARGET = process.env.E2E_BASE_URL ?? process.env.E2E_BASE ?? "http://localhost:3000";

/**
 * LONGANISA is the largest asset in the library (5.5MB), chosen deliberately:
 * the worst case is the one that breaks.
 */
const ABSENT_SIGN = "longanisa";

/**
 * A DELIBERATE FIXTURE, and still worth its ~11MB.
 *
 * A is the only sign whose recording survived the deletion, and it was
 * re-uploaded on purpose. Its job has changed rather than ended: it used to
 * prove the Human view played a video, and now it is the only fixture that can
 * prove the video route still works at all. Deleting it would reclaim 11MB and
 * leave the kept-alive data path with nothing testing it.
 *
 * If you are reclaiming storage: still leave this one.
 */
const RECORDED_SIGN = "a";

/** Fraction of non-transparent pixels across every canvas on the page. */
async function paintedFraction(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")];
    let painted = 0;
    let total = 0;
    for (const c of canvases) {
      const ctx = c.getContext("2d");
      if (!ctx || !c.width || !c.height) continue;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      total += data.length / 4;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) painted++;
    }
    return total === 0 ? 0 : painted / total;
  });
}

/**
 * Translates a phrase and waits until the clip has genuinely resolved over the
 * network. Observable, so it needs no timer.
 */
async function translate(page: Page, phrase: string) {
  await page.goto(`${TARGET}/translate`, { waitUntil: "domcontentloaded" });

  const assetResolved = page.waitForResponse(
    (r) => /\/api\/animations\/[^/]+$/.test(r.url()) && r.status() < 400,
    { timeout: 90_000 },
  );

  await page.locator("textarea, input[type=text]").first().fill(phrase);
  await page.getByRole("button", { name: /^Translate$/i }).click();
  await assetResolved;
}

test.describe("player: the skeleton is the view", () => {
  test("a sign with no recording still paints", async ({ page }) => {
    await translate(page, ABSENT_SIGN);

    // WHY PIXELS. Two other routes passed while the pane was blank: the API
    // returned correct metadata, and the bundle contained the right strings.
    // Neither distinguishes "rendered" from "mounted".
    await expect
      .poll(() => paintedFraction(page), { timeout: 90_000, message: "the stage painted nothing" })
      .toBeGreaterThan(0);
  });

  test("a sign with a recording paints the same way, from landmarks", async ({ page }) => {
    // The point of keeping this case: having a recording must not change what
    // the public app draws. It draws the skeleton either way now.
    await translate(page, RECORDED_SIGN);

    await expect
      .poll(() => paintedFraction(page), { timeout: 90_000, message: "the stage painted nothing" })
      .toBeGreaterThan(0);
  });

  test("no view-mode switcher is left stranded", async ({ page }) => {
    await translate(page, ABSENT_SIGN);

    for (const mode of ["Human", "Split", "Overlay"]) {
      await expect(
        page.locator("button, [role=tab], [role=radio]")
          .filter({ hasText: new RegExp(`^\\s*${mode}\\s*$`, "i") }),
        `${mode} is still offered, but nothing behind it works`,
      ).toHaveCount(0);
    }
  });

  test("the dead 'Recording unavailable' surface is gone", async ({ page }) => {
    // It was reachable on 129 of 130 signs. With no way to select a video mode
    // it should now be unreachable, not merely unlikely.
    await translate(page, ABSENT_SIGN);
    await expect(page.getByText(/Recording unavailable/i)).toHaveCount(0);
  });
});

/**
 * The data path the UI removal deliberately left in place.
 *
 * These are the assertions that would have caught the route being deleted as
 * "unused" once nothing on screen called it.
 */
test.describe("recordings: the route stays alive", () => {
  test("a sign that has a recording still serves it", async ({ request }) => {
    const response = await request.get(`${TARGET}/api/animations/${RECORDED_SIGN}/video`);
    expect(response.status(), "the one surviving recording must still serve").toBe(200);
    expect(response.headers()["content-type"]).toMatch(/video\//);
  });

  test("a sign with no recording 404s rather than erroring", async ({ request }) => {
    const response = await request.get(`${TARGET}/api/animations/${ABSENT_SIGN}/video`, {
      failOnStatusCode: false,
    });
    // 404 is the honest answer for a deleted source, and it is what the player
    // would key off if the modes were ever restored.
    expect(response.status()).toBe(404);
  });
});
