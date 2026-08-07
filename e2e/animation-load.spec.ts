import { expect, test } from "@playwright/test";
import { COMMON_WORDS } from "../src/lib/commonAssetsPreload";

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

/**
 * Imported rather than copied, so the burst is always the burst the app
 * actually fires. A hardcoded duplicate would have kept testing the twelve
 * unpublished phrases after they were removed from the real list.
 */
const PRELOAD_GLOSSES = COMMON_WORDS;

test.describe("animation asset delivery", () => {
  // 38 concurrent requests move ~82MB; the burst takes ~11s against a warm
  // production server and considerably longer against a cold dev one.
  test.describe.configure({ timeout: 240_000 });

  test("no published asset is ever served from the local fallback", async ({ request }) => {
    // Originally this ran in-page, because reading headers through Playwright's
    // request context meant buffering 38 x 3MB of bodies — 82MB, and a timeout.
    // The route now 307s to a signed Storage URL instead of proxying the JSON,
    // so with maxRedirects: 0 each response is a bodyless redirect. The burst
    // costs almost nothing and the headers are readable directly.
    //
    // X-Animation-Source lives on that redirect. Following it reads Storage's
    // headers, where the field does not exist — which is what made the in-page
    // version start reporting `undefined` for every gloss.
    const responses = await Promise.all(
      PRELOAD_GLOSSES.map(async (gloss) => {
        const res = await request.get(`${BASE}/api/animations/${encodeURIComponent(gloss)}`, {
          maxRedirects: 0,
        });
        return {
          gloss,
          status: res.status(),
          source: res.headers()["x-animation-source"] ?? null,
          stage: res.headers()["x-animation-failure-stage"] ?? null,
        };
      }),
    );

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
    // 307, not 200: a published asset is now a redirect to signed Storage.
    const badLetters = letters.filter((r) => r.status !== 307 || r.source !== "published");
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
