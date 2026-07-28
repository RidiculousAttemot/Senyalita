import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { ADMIN_NAVIGATION } from "../src/lib/admin/navigation";

/**
 * Every /admin link a user can reach must resolve to a route that exists.
 *
 * This bug class has now appeared twice. Once when the nav still listed
 * /admin/models after the page was deleted, and once when the dashboard's
 * "Continue a workflow" grid still linked /admin/training, /admin/collection,
 * /admin/analytics, /admin/models and /admin/audits. Neither is visible to
 * typecheck, lint or the build: an href is just a string, and Next.js resolves
 * it at request time.
 *
 * Two assertions, because a nav-only check would have missed the second bug:
 *
 *   1. Every ADMIN_NAVIGATION href resolves.
 *   2. Every /admin/... literal in any file TRANSITIVELY IMPORTED by an admin
 *      page or layout resolves.
 *
 * (2) walks the real import graph rather than grepping all of src/, so
 * orphaned components (AiInsightsView, TrainingCenterView, ModelRegistryView,
 * CollectionOverviewView, ModelComparisonView — all rendered by zero pages and
 * all still carrying dead links) do not fail the suite. They are unreachable,
 * so they cannot 404 anyone. When the follow-up sweep deletes them this test
 * keeps passing unchanged; if anything ever renders one again, its dead links
 * enter the graph and this test fails immediately.
 *
 * NOTE ON SCOPE. This proves a route exists, not that it is in the repository.
 * /admin/models existed on disk the whole time it was 404ing in production —
 * it was .gitignore'd. Only src/lib/__tests__/ignoredSource.test.ts catches
 * that, and this test is deliberately not a substitute for it.
 */

// package.json sets "type": "module", so __dirname does not exist here.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = path.join(REPO_ROOT, "src", "app");
const SRC_DIR = path.join(REPO_ROOT, "src");

/** Route groups — "(dashboard)" — are organisational and contribute no URL segment. */
const toUrlPath = (relativeDir: string): string =>
  "/" +
  relativeDir
    .split(path.sep)
    .filter((segment) => segment && !/^\(.*\)$/.test(segment))
    .join("/");

function walk(dir: string, onFile: (absolutePath: string) => void): void {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) walk(absolute, onFile);
    else onFile(absolute);
  }
}

/** Every URL the App Router can actually serve, from page.tsx and route.ts files. */
function collectRoutes(): Set<string> {
  const routes = new Set<string>();
  walk(APP_DIR, (absolute) => {
    const name = path.basename(absolute);
    if (!/^(page|route)\.(tsx?|jsx?)$/.test(name)) return;
    routes.add(toUrlPath(path.relative(APP_DIR, path.dirname(absolute))));
  });
  return routes;
}

/** Matches a concrete href against a route, honouring [id] and [...slug] segments. */
function routeExists(href: string, routes: Set<string>): boolean {
  if (routes.has(href)) return true;
  const hrefSegments = href.split("/").filter(Boolean);
  return [...routes].some((route) => {
    const routeSegments = route.split("/").filter(Boolean);
    const catchAll = routeSegments.some((s) => s.startsWith("[..."));
    if (!catchAll && routeSegments.length !== hrefSegments.length) return false;
    return routeSegments.every((segment, index) => {
      if (segment.startsWith("[...")) return true;
      if (segment.startsWith("[")) return hrefSegments[index] !== undefined;
      return segment === hrefSegments[index];
    });
  });
}

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

function resolveImport(specifier: string, importerFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(SRC_DIR, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(importerFile), specifier);
  else return null; // bare package specifier

  for (const candidate of [
    ...EXTENSIONS.map((extension) => base + extension),
    ...EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* not this candidate */
    }
  }
  return null;
}

/** Files reachable from any admin page or layout, following @/ and relative imports. */
function collectReachableFromAdmin(): string[] {
  const queue: string[] = [];
  walk(path.join(APP_DIR, "admin"), (absolute) => {
    if (/^(page|layout|route|template|error|loading|not-found)\.tsx?$/.test(path.basename(absolute))) {
      queue.push(absolute);
    }
  });

  const seen = new Set<string>();
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, "utf8");
    const specifiers = [
      ...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g),
    ].map((match) => match[1]);

    for (const specifier of specifiers) {
      const resolved = resolveImport(specifier, file);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return [...seen];
}

/** "/admin/" and "/admin/x/anything" style prefixes/fixtures are not navigable hrefs. */
const isNavigableHref = (href: string) => href !== "/admin/" && !href.endsWith("/");

test.describe("admin navigation integrity", () => {
  // The browser case walks six routes; against a cold dev server each is a
  // first-time compile, which blows the 30s default several times over.
  test.describe.configure({ timeout: 180_000 });

  test("every nav entry points at a route that exists", () => {
    const routes = collectRoutes();
    const items = ADMIN_NAVIGATION.flatMap((section) => section.items);

    expect(items.length, "the admin nav is empty — the menu module is probably broken").toBeGreaterThan(0);

    const dead = items
      .filter((item) => item.href && !routeExists(item.href, routes))
      .map((item) => `${item.label} -> ${item.href}`);

    expect(dead, `Nav entries with no matching page.tsx:\n  ${dead.join("\n  ")}`).toEqual([]);
  });

  test("no reachable admin component links a deleted page", () => {
    const routes = collectRoutes();
    const reachable = collectReachableFromAdmin();

    expect(
      reachable.length,
      "import-graph walk found nothing — the resolver is broken, not the app",
    ).toBeGreaterThan(10);

    const dead: string[] = [];
    for (const file of reachable) {
      if (file.includes("__tests__")) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/["'`](\/admin[a-zA-Z0-9/_-]*)["'`]/g)) {
        const href = match[1];
        if (!isNavigableHref(href)) continue;
        if (routeExists(href, routes)) continue;
        const line = source.slice(0, match.index).split("\n").length;
        dead.push(`${path.relative(REPO_ROOT, file).replace(/\\/g, "/")}:${line} -> ${href}`);
      }
    }

    expect(dead, `Links to routes that do not exist:\n  ${dead.join("\n  ")}`).toEqual([]);
  });

  test("the server serves every nav route behind the auth redirect", async ({ page }) => {
    // Middleware redirects unauthenticated admin requests to /admin/login
    // BEFORE routing, so this cannot tell a live route from a deleted one —
    // that is what the two tests above are for. What it does prove is that the
    // running server has these routes compiled and guarded, rather than
    // erroring or leaking the page.
    // Warm up first: the login page is the redirect target for all six, so
    // paying its compile cost once keeps the loop off the timeout.
    await page.goto("http://localhost:3000/admin/login", { waitUntil: "domcontentloaded" });

    for (const item of ADMIN_NAVIGATION.flatMap((section) => section.items)) {
      if (!item.href) continue;
      const response = await page.goto(`http://localhost:3000${item.href}`, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${item.href} returned ${response?.status()}`).toBeLessThan(400);
      expect(new URL(page.url()).pathname, `${item.href} did not land on the login page`).toBe(
        "/admin/login",
      );
    }
  });
});
