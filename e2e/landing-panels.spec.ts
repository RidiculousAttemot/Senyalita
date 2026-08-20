import { test, expect, type Page } from "@playwright/test";

/**
 * Both landing panels must draw real recorded landmarks.
 *
 * Each of them once drew something else. The hero rendered a fabricated hand
 * rig that reported "96% match" -- a number the system had never produced. The
 * showcase computed a real gloss and then drew HandSkeleton beside it: 21
 * hardcoded coordinates, identical for every input, under a stage label reading
 * "Signing". Both are the visitor's first impression of the product, and in
 * both cases the picture was not the thing the copy claimed.
 *
 * Asserted in a browser because the failure is visual. Mounting the player
 * proves nothing -- the panel that shipped had a mounted component and a blank
 * stage. What is checked here is that a canvas exists and that the clip being
 * played has actually been trimmed to the sign.
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe.configure({ mode: "serial", timeout: 300_000 });

/** Non-transparent pixels as a fraction, for the first canvas on the page. */
async function paintedFraction(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!c) return -1;
    const ctx = c.getContext("2d");
    if (!ctx || !c.width || !c.height) return -1;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let on = 0;
    for (let p = 3; p < data.length; p += 4) if (data[p] !== 0) on++;
    return on / (data.length / 4);
  });
}

test("the showcase plays the sign the engine itself resolved", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

  const section = page.locator("#showcase");
  await section.scrollIntoViewIfNeeded();

  // The panel used to carry the literal ["KAMUSTA", "KA"]. The engine resolves
  // this phrase to a single HOW ARE YOU -- and neither KAMUSTA nor KA is a
  // published sign, while HOW ARE YOU is, so the literal advertised a result
  // the system would never produce.
  await expect(section.getByText("HOW ARE YOU", { exact: true })).toBeVisible({ timeout: 120_000 });

  // Nothing has been fetched yet: this panel sits behind a free-text box, so
  // the control is the only thing that spends megabytes.
  const play = section.getByRole("button", { name: /play how are you/i });
  await expect(play).toBeVisible();
  await play.click();

  await expect
    .poll(() => paintedFraction(page), { timeout: 180_000, message: "the showcase stage painted nothing" })
    .toBeGreaterThan(0);
});

test("the hero opens on the sign rather than the rest pose", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

  const hero = page.locator("#recognition");
  await hero.scrollIntoViewIfNeeded();

  /**
   * The caption reports the clip actually being played. KNOW is 134 frames on
   * the wire and stands still for its first 15, so an untrimmed clip reports
   * 134 and the panel's first impression is a figure standing still -- which is
   * what shipped, as "frame 4 of 134".
   *
   * Asserted as "fewer than the raw asset" rather than as a fixed 119, so
   * re-recording KNOW does not fail this for the wrong reason.
   */
  const caption = hero.locator("p", { hasText: /frame \d+ of \d+/ });
  await expect(caption).toBeVisible({ timeout: 180_000 });
  const total = Number(/of (\d+)/.exec(await caption.innerText())?.[1] ?? 0);
  expect(total).toBeGreaterThan(0);
  expect(total, "the clip should be trimmed to its active span").toBeLessThan(134);

  await expect.poll(() => paintedFraction(page), { timeout: 60_000 }).toBeGreaterThan(0);
});

test("neither panel claims a figure it cannot measure", async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const text = (await page.locator("body").innerText()).toLowerCase();
  // The literals these panels were built to remove.
  expect(text).not.toMatch(/\d+% match/);
  expect(text).not.toMatch(/step \d+ of \d+/);
});
