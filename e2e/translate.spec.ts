import { expect, test } from "@playwright/test";

/**
 * End-to-end coverage for the two supported workflows.
 *
 * The pixel assertion is the point of this file. Text-to-Sign can report a
 * correct clip list, duration and frame count while drawing nothing at all —
 * that exact failure shipped once, because the fingerspelling fallback built
 * synthetic assets the landmark renderer skips. Asserting on the DOM alone
 * would not have caught it, so these tests read the canvas back and require
 * actual painted pixels.
 *
 * Playback is driven by requestAnimationFrame, which browsers suspend for a
 * page that is not compositing. These must therefore run in a real browser
 * context (Playwright's headless Chromium composites; a hidden/background tab
 * does not).
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Mounting /translate fires preloadCommonAssets(), which requests ~38 assets
 * (A-Z, 0-9 and common phrases) before anything the test does. Several of
 * those 404 by design — a phrase with no published sign is what triggers
 * fingerspelling. Against a cold dev server that is easily more than the
 * default 30s, so these tests get their own budget rather than racing it.
 *
 * The budget is set from a measurement, not a guess. A single published
 * letter asset is ~3MB and is served from Supabase storage:
 *
 *     GET /api/animations/A -> 200, 3,011,400 bytes, 19.9s   (~150 KB/s)
 *
 * Fingerspelling "CAB" loads three of those in sequence while the preloader
 * competes for the same connection, so a cold first test can legitimately
 * need well over a minute before the canvas mounts. The old 90s budget and
 * 60s canvas wait failed on a cold cache and passed on a warm one — a flake
 * that says nothing about the code under test. Widened so the assertion is
 * about whether pixels get painted, not about download throughput.
 */
test.describe.configure({ mode: "serial", timeout: 240_000 });

/** Painted-pixel count plus a cheap content hash, so two distinct poses that
 *  happen to light the same number of pixels are still distinguishable. */
async function canvasFingerprint(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return { painted: -1, hash: "no-canvas" };
    const ctx = canvas.getContext("2d");
    if (!ctx) return { painted: -1, hash: "no-context" };
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0;
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] !== 0) {
        painted++;
        // FNV-style rolling hash over the lit pixels' positions and colour.
        hash = ((hash * 31) ^ (i + data[i] + data[i + 1] * 3 + data[i + 2] * 7)) >>> 0;
      }
    }
    return { painted, hash: String(hash) };
  });
}

/** Counts pixels with a non-zero alpha channel — i.e. anything actually drawn. */
async function paintedPixels(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return -1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return -1;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) painted++;
    return painted;
  });
}

async function translate(page: import("@playwright/test").Page, text: string) {
  await page.goto(`${BASE}/translate`);
  const input = page.locator("#composer-input");
  await expect(input).toBeVisible({ timeout: 150_000 });
  await input.fill(text);

  // The button is disabled until React registers the change; clicking a
  // disabled button just retries until timeout with a misleading message.
  const button = page.getByRole("button", { name: /^translate$/i });
  await expect(button).toBeEnabled({ timeout: 15_000 });
  await button.click();

  // The canvas only mounts once the first clip has downloaded (~3MB each),
  // and the preloader is competing for the same connection.
  await expect(page.locator("canvas")).toBeVisible({ timeout: 150_000 });
}

test.describe("Text-to-Sign", () => {
  test("fingerspells an unknown word with the published alphabet", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (r) => {
      const m = r.url().match(/\/api\/animations\/(.+)$/);
      if (m) requested.push(decodeURIComponent(m[1]));
    });

    // "CAB" has no published sign, so each character is spelled from the
    // published alphabet rather than synthesised.
    await translate(page, "CAB");
    await page.waitForTimeout(6000);

    expect(requested).toContain("CAB");
    for (const letter of ["C", "A", "B"]) {
      expect(requested, `expected the ${letter} animation to be fetched`).toContain(letter);
    }

    // Renders, rather than merely reporting a duration.
    expect(await paintedPixels(page)).toBeGreaterThan(0);
  });

  test("plays a published sign directly", async ({ page }) => {
    await translate(page, "A");
    await page.waitForTimeout(5000);
    expect(await paintedPixels(page)).toBeGreaterThan(0);
  });

  test("playback advances rather than sitting on one frame", async ({ page }) => {
    await translate(page, "AB");
    await page.waitForTimeout(2000);
    const first = await canvasFingerprint(page);
    await page.waitForTimeout(2500);
    const second = await canvasFingerprint(page);

    expect(first.painted).toBeGreaterThan(0);
    // Compare the pixels themselves, not how many are lit: two different poses
    // can light the same number of pixels, which made a count-based assertion
    // fail spuriously.
    expect(second.hash).not.toBe(first.hash);
  });
});

test.describe("routing", () => {
  test("public surface is only / and /translate", async ({ page }) => {
    for (const path of ["/conversation", "/learn", "/evaluation", "/presentation", "/history"]) {
      const res = await page.goto(`${BASE}${path}`);
      expect(res?.status(), `${path} should be gone`).toBe(404);
    }
  });

  test("legacy paths redirect to /translate", async ({ page }) => {
    for (const path of ["/type-to-sign", "/sign-to-text"]) {
      await page.goto(`${BASE}${path}`);
      await expect(page).toHaveURL(new RegExp("/translate$"));
    }
  });

  test("admin API is guarded", async ({ request }) => {
    for (const path of ["/api/admin/health", "/api/assets/dataset", "/api/admin/animation-assets"]) {
      const res = await request.get(`${BASE}${path}`);
      expect(res.status(), `${path} should require auth`).toBe(401);
    }
  });

  test("published animations are served from the database", async ({ request }) => {
    const res = await request.get(`${BASE}/api/animations/A`);
    expect(res.status()).toBe(200);
    expect(res.headers()["x-animation-source"]).toBe("published");
  });
});

test.describe("Sign-to-Text", () => {
  /**
   * The camera itself cannot be exercised headlessly, so this covers
   * everything up to the capture boundary: the tab mounts, the on-device
   * model is reachable, and the word-building UI is present.
   */
  test("mounts and can reach the on-device model", async ({ page, request }) => {
    await page.goto(`${BASE}/translate`);
    await page.getByRole("button", { name: /sign\s*→\s*text/i }).click();

    // Wait on panel content, not the header's own "Start camera" button --
    // that one appears the instant the mode flips, so asserting on it passes
    // while SignToTextInterface (a next/dynamic import) is still compiling.
    await expect(page.getByRole("heading", { name: /spelled letters/i }))
      .toBeVisible({ timeout: 150_000 });
    await expect(page.getByRole("heading", { name: /transcript/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /supported characters/i })).toBeVisible();

    // Recognition is on-device: these must be served, not proxied.
    for (const file of ["model.json", "labels.json", "weights.bin"]) {
      const res = await request.get(`${BASE}/models/fsl_unified/bilstm_tfjs/${file}`);
      expect(res.status(), `${file} must be reachable`).toBe(200);
    }
  });

  test("model exposes the full alphabet", async ({ request }) => {
    const res = await request.get(`${BASE}/models/fsl_unified/bilstm_tfjs/labels.json`);
    const body = await res.json();
    const labels: string[] = Array.isArray(body) ? body : body.labels;
    const single = labels.filter((l) => /^[a-z0-9]$/i.test(l));
    // 26 letters must all be present; the model also carries phrase classes,
    // which the alphabet-scoped UI simply does not surface.
    for (const letter of "abcdefghijklmnopqrstuvwxyz") {
      expect(single.map((s) => s.toLowerCase())).toContain(letter);
    }
  });
});
