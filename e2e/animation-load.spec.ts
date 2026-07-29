import { expect, test } from "@playwright/test";

/**
 * The animation path must never quietly substitute something else.
 *
 * This exists because /api/animations/A once returned
 * `x-animation-source: local-development` under the preloader's concurrent
 * load. In development that is invisible -- the local directory answers and
 * the page looks fine. In production the local directory is not deployed, so
 * the same condition is a 404, the client fingerspells, and the user sees
 * "the animation sometimes doesn't play".
 *
 * These assertions are written against PRODUCTION behaviour, not the
 * forgiving development path. A test that can only pass in the environment
 * where the bug is invisible is not coverage: the invariant is "a published
 * asset is served from the database, always", so any local-development
 * response fails the suite wherever it runs.
 *
 * Run against a production server (`npm run build && npm run start`) to
 * exercise the real path. Against `npm run dev` these still hold -- they just
 * fail loudly the moment the fallback is used, which is the point.
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/** The exact list from src/lib/commonAssetsPreload.ts. */
const PRELOAD_GLOSSES = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  "HELLO", "THANK_YOU", "GOOD_MORNING", "GOOD_AFTERNOON", "GOOD_EVENING",
  "KAMUSTA", "SALAMAT", "PAALAM", "OO", "HINDI", "PLEASE", "SORRY",
];

test.describe("animation asset delivery", () => {
  // 38 concurrent requests move ~82MB; the burst takes ~11s against a warm
  // production server and considerably longer against a cold dev one.
  test.describe.configure({ timeout: 240_000 });

  test("no published asset is ever served from the local fallback", async ({ page }) => {
    await page.goto(`${BASE}/`);

    // Run the burst inside the page rather than through Playwright's request
    // context. Two reasons: the browser is where preloadCommonAssets() actually
    // runs, so its connection limits are the ones that matter; and reading
    // headers without buffering 38 x 3MB of bodies is the difference between
    // an 11s test and one that dies holding ~82MB.
    const responses = await page.evaluate(async (glosses: string[]) => {
      return Promise.all(
        glosses.map(async (gloss) => {
          const res = await fetch(`/api/animations/${encodeURIComponent(gloss)}`);
          // Release the body without materialising it.
          await res.body?.cancel();
          return {
            gloss,
            status: res.status,
            source: res.headers.get("x-animation-source"),
            stage: res.headers.get("x-animation-failure-stage"),
          };
        }),
      );
    }, PRELOAD_GLOSSES);

    // The tripwire. `local-development-failed` means a published asset existed
    // and could not be fetched; `local-development-absent` means dev is
    // serving something production cannot. Neither may pass silently.
    const fellBack = responses.filter((r) => (r.source ?? "").startsWith("local-development"));
    expect(
      fellBack.map((r) => `${r.gloss} -> ${r.source}`),
      "these were served from the local directory, which is not deployed",
    ).toEqual([]);

    // 503 is the honest signal added alongside this test: the asset exists but
    // the lookup failed. It must not appear under normal preload load.
    const failed = responses.filter((r) => r.status === 503);
    expect(
      failed.map((r) => `${r.gloss} -> stage=${r.stage}`),
      "lookup failures under concurrent preload",
    ).toEqual([]);

    // Every letter must resolve from the database. A-Z is the fingerspelling
    // alphabet, which is the fallback for every unknown word -- if a letter is
    // missing there is nothing beneath it to degrade to.
    const letters = responses.filter((r) => r.gloss.length === 1);
    const badLetters = letters.filter((r) => r.status !== 200 || r.source !== "published");
    expect(
      badLetters.map((r) => `${r.gloss} -> ${r.status} ${r.source}`),
      "every letter must be served from the database",
    ).toEqual([]);
    expect(letters).toHaveLength(26);
  });

  test("an unpublished gloss is a 404, distinct from a failure", async ({ request }) => {
    // Never a 5xx and never a fallback: this gloss genuinely does not exist,
    // and the client is correct to fingerspell it.
    const res = await request.get(`${BASE}/api/animations/DEFINITELY_NOT_A_GLOSS`);
    expect(res.status()).toBe(404);
    expect(res.headers()["x-animation-source"] ?? null).not.toBe("lookup-failed");
    expect(res.headers()["cache-control"]).toContain("no-store");
  });
});
