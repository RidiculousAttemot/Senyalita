import { test, expect, type Page } from "@playwright/test";

/**
 * What a screen reader is told while the camera runs.
 *
 * The camera status pill was itself `aria-live="polite"` while rendering the FPS
 * counter and the cam/det/CPU diagnostics -- every one of which is written from
 * inside the per-frame detection loop. So the announcement was not missing, it
 * was continuous: a stream of changing numbers for as long as the camera ran.
 * That is worse than silence, because it makes the page unusable rather than
 * merely quiet.
 *
 * This matters more here than in most products. The stated primary users are
 * Deaf and Hard-of-Hearing, `DEAF BLIND` is one of the system's own sign
 * classes, and a Deafblind user reaches this interface through a screen reader
 * driving a braille display.
 *
 * Driven with Chromium's fake capture device so the camera actually starts and
 * the live regions carry real runtime content. Asserting the source would not
 * have caught this: the pill's markup looked reasonable, and the defect only
 * exists once values begin updating.
 */

// Defaults to 3000 like every other spec in this suite. It used to default to
// 3400 -- the port of the local production-build harness it was written
// against -- so running it without that harness up failed with
// ERR_CONNECTION_REFUSED, which reads like a broken page rather than a missing
// server. Set E2E_BASE_URL to point it elsewhere.
const TARGET = process.env.PLAYER_E2E_TARGET ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  permissions: ["camera"],
});

test.setTimeout(120_000);

/** Every live region's text, as a screen reader would receive it. */
async function liveRegions(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[aria-live]")].map((e) => ({
      live: e.getAttribute("aria-live"),
      text: (e.textContent || "").trim(),
    })),
  );
}

/** Settled camera states -- anything the status label can rest on. */
const SETTLED = /^(Live|No hand|Camera error)$/i;

async function startCamera(page: Page) {
  await page.goto(`${TARGET}/translate`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Sign\s*→\s*Text/i }).click();

  // Scoped to the tab panel, NOT .last(). The header carries a button of the
  // same name, and before the panel mounts it is the only match -- so .last()
  // resolved to the header control and clicked that instead. toBeEnabled()
  // passed instantly on it, and the failure surfaced 90s later as "the camera
  // never started", which is a long way from the actual cause.
  const panel = page.locator('[id$="-content-sign-to-text"]');
  const start = panel.getByRole("button", { name: /Start camera/i });
  await expect(start).toBeEnabled({ timeout: 30_000 });
  await start.click();

  // Wait on the state itself rather than a timer: the detector downloads and
  // initialises before any status beyond "Starting" is reachable.
  await expect
    .poll(async () => (await liveRegions(page)).some((r) => SETTLED.test(r.text)), {
      timeout: 90_000,
      message: "camera never reached a settled state",
    })
    .toBe(true);
}

test.describe("camera state announcements", () => {
  test("no live region carries the FPS or diagnostic counters", async ({ page }) => {
    await startCamera(page);
    const noisy = (await liveRegions(page)).filter((r) => /\bFPS\b|\bcam \d|\bdet \d|\bCPU\b/i.test(r.text));
    expect(
      noisy.map((r) => r.text),
      "these update inside the per-frame loop, so a live region re-announces them continuously",
    ).toEqual([]);
  });

  test("camera state itself is announced", async ({ page }) => {
    await startCamera(page);
    const regions = await liveRegions(page);
    expect(
      regions.some((r) => r.live === "polite" && SETTLED.test(r.text)),
      `expected a settled status label in a polite region; got ${JSON.stringify(regions.map((r) => r.text))}`,
    ).toBe(true);
  });
});
