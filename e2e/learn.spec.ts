import { expect, test } from "@playwright/test";

/**
 * /learn — public route #4.
 *
 * The pixel assertion is the point, same as translate.spec.ts. This page
 * reuses the Text-to-Sign player, so "the canvas element exists" proves
 * nothing: the failure this project has actually shipped is a canvas that
 * mounts and stays blank. Selecting a letter has to paint.
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe("Learn FSL", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  async function paintedPixels(page: import("@playwright/test").Page) {
    return page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="learn-stage"] canvas');
      if (!(canvas instanceof HTMLCanvasElement)) return -1;
      const ctx = canvas.getContext("2d");
      if (!ctx) return -1;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) painted++;
      return painted;
    });
  }

  test("renders all three sections", async ({ page }) => {
    await page.goto(`${BASE}/learn`);

    await expect(page.getByTestId("section-alphabet")).toBeVisible({ timeout: 150_000 });
    await expect(page.getByTestId("section-phrases")).toBeVisible();
    await expect(page.getByTestId("section-tutorials")).toBeVisible();

    // 26 letters + 11 numbers, the exact set with a published animation.
    await expect(page.getByTestId("sign-A")).toBeVisible();
    await expect(page.getByTestId("sign-Z")).toBeVisible();
    await expect(page.getByTestId("sign-10")).toBeVisible();
  });

  test("selecting a letter actually paints the canvas", async ({ page }) => {
    await page.goto(`${BASE}/learn`);
    await expect(page.getByTestId("section-alphabet")).toBeVisible({ timeout: 150_000 });

    await page.getByTestId("sign-B").click();
    await expect(page.getByTestId("learn-stage")).toHaveAttribute("data-gloss", "B");

    // Waits for pixels rather than for the element: the asset is ~3MB and the
    // canvas mounts before the first frame is drawn.
    await expect
      .poll(async () => paintedPixels(page), { timeout: 150_000 })
      .toBeGreaterThan(0);
  });

  test("a number word plays the digit's animation", async ({ page }) => {
    await page.goto(`${BASE}/learn`);
    await expect(page.getByTestId("section-phrases")).toBeVisible({ timeout: 150_000 });

    // The model emits "THREE"; the published asset is "3". This mapping is the
    // only reason any multi-word label is playable at all -- 0 of 105 have
    // their own animation.
    const three = page.getByTestId("phrase-THREE");
    await expect(three).toBeVisible({ timeout: 150_000 });
    await three.click();

    await expect(page.getByTestId("learn-stage")).toHaveAttribute("data-gloss", "3");
    await expect.poll(async () => paintedPixels(page), { timeout: 150_000 }).toBeGreaterThan(0);
  });

  test("has no footer, and offers a way home and a way to try it", async ({ page }) => {
    await page.goto(`${BASE}/learn`);
    await expect(page.getByTestId("section-alphabet")).toBeVisible({ timeout: 150_000 });

    // The marketing footer is gone — /learn ends on its own call to action.
    await expect(page.locator("footer")).toHaveCount(0);

    // Getting home is the header's job now that the footer is not there.
    const home = page.getByRole("link", { name: /back to home/i });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute("href", "/");

    // The old template header carried landing-page anchors that resolve to
    // nothing off "/". They must not come back.
    for (const dead of ["#why-it-matters", "#how-it-works", "#principles"]) {
      await expect(page.locator(`a[href="${dead}"]`), `${dead} is a dead anchor here`).toHaveCount(0);
    }
  });

  test("the try-it call to action reaches /translate", async ({ page }) => {
    await page.goto(`${BASE}/learn`);
    const cta = page.getByTestId("learn-try-cta");
    await expect(cta).toBeVisible({ timeout: 150_000 });
    await expect(page.getByRole("heading", { name: /want to try it yourself/i })).toBeVisible();

    await cta.click();
    // Generous, because this is a Next <Link>: once hydrated the click is a
    // soft navigation, so the URL does not change until the RSC payload for
    // /translate arrives. Under a loaded dev server that outlasts the 5s
    // default, and the test failed with the URL still reading /learn -- a
    // report about throughput, not about the link.
    await expect(page).toHaveURL(new RegExp("/translate$"), { timeout: 120_000 });
    // Landed on the real translator, not a redirect stub.
    await expect(page.locator("#composer-input")).toBeVisible({ timeout: 150_000 });
  });

  test("playability follows the library, not a hardcoded rule", async ({ page, request }) => {
    // The page used to decide playability structurally — letters, digits and
    // number words — which was true only while the published set was exactly
    // A-Z and 0-10. Publishing THANK YOU made it false, and /learn went on
    // calling it unanimated while Text-to-Sign played it correctly.
    //
    // Driven from the same endpoint the page reads, so this keeps holding as
    // the library grows rather than pinning today's vocabulary.
    const res = await request.get(`${BASE}/api/animations`);
    expect(res.status()).toBe(200);
    const published: string[] = (await res.json()).glosses ?? [];

    const multiWord = published.filter((g) => g.length > 1 && !/^\d+$/.test(g));
    test.skip(multiWord.length === 0, "no multi-word gloss published yet");

    await page.goto(`${BASE}/learn`);
    await expect(page.getByTestId("section-phrases")).toBeVisible({ timeout: 150_000 });

    for (const gloss of multiWord) {
      await expect(
        page.getByTestId(`phrase-${gloss}`),
        `${gloss} is published but not offered as playable`,
      ).toBeVisible({ timeout: 30_000 });
    }

    // And it plays, rather than merely being listed.
    const first = multiWord[0];
    await page.getByTestId(`phrase-${first}`).click();
    await expect(page.getByTestId("learn-stage")).toHaveAttribute("data-gloss", first);
    await expect
      .poll(async () => paintedPixels(page), { timeout: 150_000 })
      .toBeGreaterThan(0);
  });

  test("search filters every section", async ({ page }) => {
    await page.goto(`${BASE}/learn`);
    await expect(page.getByTestId("section-alphabet")).toBeVisible({ timeout: 150_000 });

    const before = await page.getByTestId("tutorial-link").count();
    expect(before).toBeGreaterThan(0);

    // "wikipedia" appears in tutorial creators but in no letter or phrase.
    // Re-filled inside the poll on purpose. The search box is a controlled
    // React input, so a fill that lands before hydration sets the DOM value
    // and is then thrown away when React renders its own state -- the box
    // looks filled, nothing filters, and a one-shot fill never recovers.
    // Retrying the input is what makes this a test of the filter rather than
    // a test of how quickly the page hydrates.
    await expect
      .poll(async () => {
        await page.getByTestId("learn-search").fill("wikipedia");
        return page.getByTestId("sign-A").count();
      }, { timeout: 120_000 })
      .toBe(0);
    const after = await page.getByTestId("tutorial-link").count();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  test("every tutorial link points somewhere real", async ({ page, request }) => {
    await page.goto(`${BASE}/learn`);
    await expect(page.getByTestId("section-tutorials")).toBeVisible({ timeout: 150_000 });

    const links = page.getByTestId("tutorial-link");
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(10);

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      // Opening a third party in a new tab without rel=noopener hands them a
      // handle on window.opener.
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
      const href = await link.getAttribute("href");
      expect(href, "tutorial link must be absolute and https").toMatch(/^https:\/\//);
    }

    // Resolve one for real. Checking all ten on every run would make the suite
    // depend on ten third parties being up; link rot is handled by
    // `npm run verify:tutorials`, not by the e2e gate.
    const first = await links.first().getAttribute("href");
    const res = await request.get(first!, { maxRedirects: 5 });
    expect(res.status(), `${first}`).toBeLessThan(400);
  });
});
