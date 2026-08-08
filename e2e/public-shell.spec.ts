import { expect, test } from "@playwright/test";
import { PUBLIC_NAV } from "../src/components/layout/publicNav";

/**
 * Every public route renders the same shell, from the layout.
 *
 * There used to be one Header and one Footer, but each was a route SWITCH:
 * /translate got a bespoke inline header, "/" got LandingNav, and everything
 * else fell through to a default nobody maintained. /learn and /evaluation
 * rendered that default -- a different palette, nav links pointing at
 * landing-page anchors that do not exist on those pages, and no active state
 * anywhere. Nothing was duplicated per page; one component was quietly three
 * designs, and the fallback was the one that rotted.
 *
 * These assertions are about the shell being SHARED, not about how it looks:
 * exactly one header and one footer, the same nav on every route, and the
 * correct item marked current. A future page that grows its own chrome, or a
 * fifth route added to PUBLIC_NAV without a page behind it, fails here.
 */

// 127.0.0.1, not localhost: Playwright's APIRequestContext resolves
// "localhost" to ::1, while the dev server binds IPv4 only, so request.get()
// fails with ECONNREFUSED where page.goto() silently falls back.
// Overridable so the suite can run against a clean server when another
// process holds port 3000.
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:3000";

test.describe("public shell", () => {
  for (const link of PUBLIC_NAV) {
    test(`${link.href} renders the shared shell exactly once`, async ({ page }) => {
      await page.goto(`${BASE}${link.href}`, { waitUntil: "domcontentloaded" });

      // Scoped to direct children of the shell: pages legitimately use <header>
      // for their own title blocks (/learn does), and counting those would make
      // this fail for the wrong reason.
      const siteHeader = page.locator("body > div > header");
      const siteFooter = page.locator("body > div > footer");

      await expect(siteHeader, `${link.href} should render exactly one site header`).toHaveCount(1);
      await expect(siteFooter, `${link.href} should render exactly one site footer`).toHaveCount(1);

      // The footer is the thing /learn and /evaluation kept losing to the
      // stale branch, so assert it is really the shared one.
      await expect(siteFooter).toContainText("Senyalita FSL Thesis Project");
    });

    test(`${link.href} highlights its own nav item and no other`, async ({ page }) => {
      await page.goto(`${BASE}${link.href}`, { waitUntil: "domcontentloaded" });

      const current = page.locator('nav[aria-label="Primary"] a[aria-current="page"]').first();
      await expect(current, `${link.href} has no active nav item`).toHaveAttribute("href", link.href);

      // "/" must not match every route: a naive startsWith would mark Home
      // active everywhere.
      const activeCount = await page
        .locator('nav[aria-label="Primary"]:visible a[aria-current="page"]')
        .count();
      expect(activeCount, `${link.href} marked more than one nav item current`).toBe(1);
    });
  }

  test("every nav entry resolves to a real page", async ({ request }) => {
    for (const link of PUBLIC_NAV) {
      const res = await request.get(`${BASE}${link.href}`, { failOnStatusCode: false });
      expect(res.status(), `${link.href} is in the nav but returns ${res.status()}`).toBeLessThan(400);
    }
  });

  test("the footer no longer links to the admin, which 404s in production", async ({ page }) => {
    await page.goto(`${BASE}/learn`, { waitUntil: "domcontentloaded" });
    const adminLinks = page.locator('body > div > footer a[href*="/admin"]');
    await expect(adminLinks, "public footer must not link to the local-only admin").toHaveCount(0);
  });

  test("mobile gets a working menu rather than a nav that just disappears", async ({ page }) => {
    // The old default header was `hidden md:flex` with no replacement, so
    // /learn and /evaluation had no navigation at all on a phone.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/learn`, { waitUntil: "networkidle" });

    const toggle = page.getByRole("button", { name: /open menu/i });
    await expect(toggle, "no mobile menu button").toBeVisible();

    await toggle.click();
    const mobileNav = page.locator("#public-shell-mobile-nav");
    await expect(mobileNav).toBeVisible();
    for (const link of PUBLIC_NAV) {
      await expect(mobileNav.locator(`a[href="${link.href}"]`)).toHaveCount(1);
    }
  });

  test("the header does not overflow the viewport on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/", "/translate", "/learn", "/evaluation"]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} scrolls horizontally on mobile by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test("/translate keeps its mode toggle and camera control in the shared header", async ({ page }) => {
    // The controls moved out of the site header into the page. If the portal
    // slot breaks, they vanish silently and the camera becomes unreachable.
    await page.goto(`${BASE}/translate`, { waitUntil: "networkidle" });
    const actions = page.locator("#public-shell-actions");
    // Anchored: an unanchored /Sign/ matches "Type → Sign" as well as
    // "Sign → Text" and resolves to two elements.
    const typeToSign = actions.getByRole("button", { name: /^Type/ });
    const signToText = actions.getByRole("button", { name: /^Sign/ });
    await expect(typeToSign).toBeVisible();
    await expect(signToText).toBeVisible();

    await signToText.click();
    await expect(
      actions.getByRole("button", { name: /camera|Start|Stop/i }).first(),
      "camera control missing after switching to Sign to Text",
    ).toBeVisible();
  });
});
