import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * The admin must not exist on the deployed site.
 *
 * It is a content-authoring tool, not a runtime dependency -- published assets
 * are served from Supabase, so publishing from localhost reaches production
 * immediately. The deployed build therefore carries no authoring UI and, more
 * importantly, none of the routes behind it: /api/admin/* is where the
 * service-role client lives, so gating the pages alone would leave the actual
 * privilege reachable and only hide the door to it.
 *
 * ROUTES ARE ENUMERATED FROM DISK, NOT LISTED HERE. A hardcoded list would
 * pass forever while a newly added route shipped exposed, which is exactly the
 * failure this is meant to prevent. Adding src/app/api/admin/foo/route.ts
 * automatically adds an assertion for /api/admin/foo.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = path.join(REPO_ROOT, "src", "app");

// E2E_BASE_URL is the name the other six specs read; this one read E2E_BASE,
// which nothing sets. Pointing the suite at a non-default port therefore moved
// every spec except this one, and this one quietly kept asking port 3000 --
// where, if nothing is listening, every admin route "is not reachable" and the
// failure reads as a broken admin gate rather than a wrong host. The whole
// point of this file is to prove the admin still works locally, so testing the
// wrong host silently is the one way it can be worse than useless.
//
// E2E_BASE stays as a fallback so an existing invocation does not break.
// 127.0.0.1 for the same IPv6 reason as e2e/public-shell.spec.ts.
const LOCAL = process.env.E2E_BASE_URL ?? process.env.E2E_BASE ?? "http://127.0.0.1:3000";
const PRODUCTION = process.env.PRODUCTION_URL ?? "https://signlangvisual.vercel.app";

/** Route groups -- "(dashboard)" -- are organisational and contribute no URL segment. */
const toUrlPath = (relativeDir: string): string =>
  "/" +
  relativeDir
    .split(path.sep)
    .filter((segment) => segment && !/^\(.*\)$/.test(segment))
    .join("/");

function collectRoutes(startDir: string, marker: "page.tsx" | "route.ts"): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(dir, entry);
      if (statSync(absolute).isDirectory()) walk(absolute);
      else if (entry === marker) found.push(toUrlPath(path.relative(APP_DIR, dir)));
    }
  };
  walk(startDir);
  return [...new Set(found)].sort();
}

/** Dynamic segments cannot be fetched as literals; a concrete id stands in. */
const concrete = (route: string) => route.replace(/\[[^\]]+\]/g, "00000000-0000-0000-0000-000000000000");

const ADMIN_PAGES = collectRoutes(path.join(APP_DIR, "admin"), "page.tsx");
const ADMIN_APIS = collectRoutes(path.join(APP_DIR, "api", "admin"), "route.ts");
const ALL = [...ADMIN_PAGES, ...ADMIN_APIS];

test.describe("admin surface is enumerable", () => {
  test("finds both the pages and the privileged API routes", () => {
    // Guards the guard. If the walk silently returned nothing, every
    // assertion below would vacuously pass against an exposed admin.
    expect(ADMIN_PAGES.length, "no admin pages discovered -- the walk is broken").toBeGreaterThan(0);
    expect(ADMIN_APIS.length, "no admin API routes discovered -- the walk is broken").toBeGreaterThan(0);
    expect(ADMIN_PAGES).toContain("/admin/login");
    expect(ADMIN_APIS).toContain("/api/admin/animation-assets");
  });
});

test.describe("production: the admin does not exist", () => {
  for (const route of ALL) {
    test(`${route} returns 404`, async ({ request }) => {
      const response = await request.get(`${PRODUCTION}${concrete(route)}`, {
        maxRedirects: 0,
        failOnStatusCode: false,
      });

      // 404 specifically, not merely "not 200". A 307 to /admin/login would
      // advertise that an admin panel exists and point at its door; a 401
      // would confirm the route is real and just needs credentials.
      expect(
        response.status(),
        `${route} must 404 in production, got ${response.status()}`,
      ).toBe(404);
    });
  }

  test("POST to a privileged route is refused too", async ({ request }) => {
    // GET-only coverage would miss a route whose privilege lives on POST --
    // which is true of every mutating admin route in this app.
    for (const route of ADMIN_APIS) {
      const response = await request.post(`${PRODUCTION}${concrete(route)}`, {
        data: {},
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      expect(response.status(), `POST ${route} must 404 in production`).toBe(404);
    }
  });
});

test.describe("local: the admin is reachable", () => {
  // The premise of gating production is that local authoring still works.
  // Without this, the gate could be "working" because the admin is broken
  // everywhere, which is a different and much worse outcome.
  test("admin routes are not 404 when ADMIN_ENABLED is set", async ({ request }) => {
    const statuses: Record<string, number> = {};
    for (const route of ALL) {
      const response = await request.get(`${LOCAL}${concrete(route)}`, {
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      statuses[route] = response.status();
    }

    const gatedLocally = Object.entries(statuses).filter(([, status]) => status === 404);
    expect(
      gatedLocally,
      `these should be reachable locally (is ADMIN_ENABLED=true in .env.local?): ${gatedLocally
        .map(([r]) => r)
        .join(", ")}`,
    ).toEqual([]);
  });
});
