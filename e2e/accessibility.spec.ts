import { expect, test, type Page } from "@playwright/test";

/**
 * The accessibility controls have to actually change the page.
 *
 * The landing page advertised contrast and text size before either existed:
 * its toggles were local useState beside the line "These controls are real."
 * For a product whose stated audience is Deaf and Hard-of-Hearing users, that
 * is the one claim worth holding to evidence rather than to a unit test of the
 * provider's internal state.
 *
 * Asserted on computed styles in a real browser, because the settings are
 * applied as attributes on <html> and read by CSS — nothing in React's state
 * proves a pixel changed. Automation surfaces that are not compositing report
 * stale computed styles after an attribute change, so this must run here.
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe.configure({ mode: "serial", timeout: 240_000, retries: 2 });

const openMenu = async (page: Page) => {
  const trigger = page.getByTestId("accessibility-trigger");
  await expect(trigger).toBeVisible({ timeout: 150_000 });
  await trigger.click();
  await expect(page.getByTestId("accessibility-panel")).toBeVisible();
};

const rootFontSize = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

const mutedColour = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector("header .text-senyalita-muted");
    return el ? getComputedStyle(el).color : null;
  });

test.describe("accessibility settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/translate`);
    await page.evaluate(() => localStorage.removeItem("senyalita:accessibility"));
    await page.reload();
  });

  test("text size changes the page, not just the stored value", async ({ page }) => {
    expect(await rootFontSize(page)).toBe("16px");

    await openMenu(page);
    await page.getByTestId("accessibility-size-larger").click();

    // 125% of the 16px root. If the setting only lived in React state this
    // would still read 16px.
    await expect.poll(() => rootFontSize(page)).toBe("20px");
  });

  test("high contrast darkens muted text while the page is open", async ({ page }) => {
    const before = await mutedColour(page);
    expect(before).toBe("rgb(100, 116, 139)");

    await openMenu(page);
    await page.getByTestId("accessibility-contrast").click();

    await expect
      .poll(() => mutedColour(page), { message: "muted text should darken immediately, not only after a reload" })
      .toBe("rgb(11, 18, 32)");
  });

  test("turning contrast back off restores the original colour", async ({ page }) => {
    await openMenu(page);
    await page.getByTestId("accessibility-contrast").click();
    await expect.poll(() => mutedColour(page)).toBe("rgb(11, 18, 32)");

    await page.getByTestId("accessibility-contrast").click();
    await expect.poll(() => mutedColour(page)).toBe("rgb(100, 116, 139)");
  });

  test("the choice survives a reload with no flash of the default", async ({ page }) => {
    await openMenu(page);
    await page.getByTestId("accessibility-contrast").click();
    await page.getByTestId("accessibility-size-large").click();

    await page.reload();

    // Set by the inline boot script before first paint, so this is true on the
    // very first frame rather than after hydration.
    expect(await page.getAttribute("html", "data-contrast")).toBe("high");
    expect(await page.getAttribute("html", "data-text-size")).toBe("large");
    expect(await rootFontSize(page)).toBe("18px");
  });

  test("high contrast never makes text less readable than it was", async ({ page }) => {
    /**
     * The regression this exists for: the first version of the rule darkened
     * muted text everywhere, including the landing page's dark sections, which
     * put #0B1220 on #0F172A — 1.05:1, invisible. Turning the accessibility
     * setting on made those screens unreadable. Scoping it by descendant
     * selector then broke the inverse case, a white card nested inside a dark
     * section.
     *
     * So this measures the real thing: computed colour against the nearest
     * painted background, on both grounds, with the setting on.
     */
    await page.goto(`${BASE}/`);
    await page.evaluate(() => {
      localStorage.setItem("senyalita:accessibility", JSON.stringify({ highContrast: true, textSize: "default" }));
    });
    await page.reload();
    await page.locator("#accessibility").scrollIntoViewIfNeeded();

    const ratios = await page.evaluate(() => {
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (rgb: number[]) => {
        const [r, g, b] = rgb.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ground = (el: Element): number[] => {
        let node: Element | null = el;
        while (node) {
          const bg = getComputedStyle(node).backgroundColor;
          const parts = parse(bg);
          const alpha = Number((bg.match(/[\d.]+/g) ?? [])[3] ?? 1);
          if (parts.length === 3 && alpha > 0.6) return parts;
          node = node.parentElement;
        }
        return [255, 255, 255];
      };
      const ratio = (el: Element) => {
        const [a, b] = [lum(parse(getComputedStyle(el).color)), lum(ground(el))].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      };

      const section = document.querySelector("#accessibility")!;
      // Body copy directly on the dark section ground.
      const onDark = section.querySelector("p.text-slate-400")!;
      // The sample card: a white panel nested inside that dark section.
      const onLight = section.querySelector(".bg-white p")!;
      return { onDark: ratio(onDark), onLight: ratio(onLight) };
    });

    expect(ratios.onDark, "text on the dark section must stay readable").toBeGreaterThanOrEqual(4.5);
    expect(ratios.onLight, "text on a light card inside it must stay readable").toBeGreaterThanOrEqual(4.5);
  });

  test("the landing page's own controls change the real setting", async ({ page }) => {
    // This is where the claim was made. The section carried two controls and
    // the line "These controls are real" while being local useState that moved
    // one sample card. If they ever drift back to a private copy, the page
    // goes back to advertising something it does not do.
    await page.goto(`${BASE}/`);
    await page.locator("#accessibility").scrollIntoViewIfNeeded();

    const contrast = page.locator('#accessibility [role="switch"]');
    await expect(contrast).toBeVisible({ timeout: 150_000 });
    await contrast.click();

    await expect.poll(() => page.getAttribute("html", "data-contrast")).toBe("high");

    await page.locator("#accessibility").getByRole("button", { name: "Larger", exact: true }).click();
    await expect.poll(() => rootFontSize(page)).toBe("20px");

    // And it is the same setting, not a page-local one: it survives to another page.
    await page.goto(`${BASE}/translate`);
    expect(await page.getAttribute("html", "data-contrast")).toBe("high");
    expect(await rootFontSize(page)).toBe("20px");
  });

  test("the setting applies on other pages too", async ({ page }) => {
    await openMenu(page);
    await page.getByTestId("accessibility-size-larger").click();
    await expect.poll(() => rootFontSize(page)).toBe("20px");

    // The control lives in the shared header, and the attributes are on <html>,
    // so a preference set in the translator has to hold on /learn as well.
    await page.goto(`${BASE}/learn`);
    expect(await rootFontSize(page)).toBe("20px");
    await expect(page.getByTestId("accessibility-trigger")).toBeVisible({ timeout: 150_000 });
  });
});
