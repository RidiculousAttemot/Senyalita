import { expect, test } from "@playwright/test";

/**
 * The breakdown panel has to actually appear, and name the source words.
 *
 * It is gated behind `stage === "done"` and swapped in by an AnimatePresence
 * with mode="wait", so the progress checklist has to finish its exit animation
 * before the result mounts. Exit animations run on requestAnimationFrame,
 * which a browser suspends for a page that is not compositing.
 *
 * That last sentence is why this file exists. The panel was reported missing
 * after being inspected through an automation surface that was not painting
 * frames: rAF never fired, the checklist never finished exiting, and the result
 * never mounted -- so the DOM genuinely showed no panel while the application
 * was working correctly. Unit tests could not have settled it either way; the
 * hook reaches "done" in both paths regardless.
 *
 * So the assertion is only meaningful in a real, compositing browser, and any
 * future "the panel is gone" report should be reproduced here before it is
 * believed. `#translation-heading` discriminates: it exists only inside
 * TranslationResult, and it was observably absent under the non-compositing
 * surface.
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Retries for the same reason camera-recognition.spec.ts does, and for nothing
 * to do with the panel: /translate hydrates behind ~38 asset requests, and
 * webkit sharing bandwidth with two other browsers has exceeded even a 120s
 * hydration wait. Measured — the same two cases pass on webkit run alone, on
 * all three browsers run alone, and against production; they fail only when the
 * whole suite competes for the same downloads.
 */
test.describe.configure({ mode: "serial", timeout: 240_000, retries: 2 });

/**
 * Mirrors the helper in translate.spec.ts: the button stays disabled until
 * React registers the change, so clicking early just retries until timeout.
 *
 * The enabled-wait is generous because it is really a wait for hydration. At
 * 15s this passed when webkit ran alone and failed when three browsers
 * competed for the same downloads — a flake that says nothing about the panel
 * under test.
 */
async function submit(page: import("@playwright/test").Page, text: string) {
  const input = page.locator("#composer-input");
  await expect(input).toBeVisible({ timeout: 150_000 });
  await input.fill(text);
  const button = page.getByRole("button", { name: /^translate$/i });
  await expect(button).toBeEnabled({ timeout: 120_000 });
  await button.click();
}

test.describe("translation breakdown", () => {
  test("the FSL gloss row appears after a translation completes", async ({ page }) => {
    await page.goto(`${BASE}/translate`);

    await submit(page, "salamat");

    // The panel, not merely the clip: the stage can show a sign while the
    // breakdown is still absent, which is exactly the reported symptom.
    const panel = page.locator("#translation-heading");
    await expect(panel).toBeVisible({ timeout: 180_000 });

    // The gloss row is the part that was missing from the screenshot.
    const glossRow = page.locator("text=FSL gloss").locator("..");
    await expect(glossRow).toContainText("THANK YOU");

    // And the progress checklist must be gone, not stacked above it.
    await expect(page.locator('[aria-label="Translation progress"]')).toHaveCount(0);
  });

  test("a fingerspelled phrase names the source words, not the gloss", async ({ page }) => {
    await page.goto(`${BASE}/translate`);

    await submit(page, "Kamusta ka?");

    await expect(page.locator("#translation-heading")).toBeVisible({ timeout: 180_000 });

    // "Spelled letter by letter: kamusta ka", never "HOW ARE YOU".
    const spelled = page.locator("text=Spelled letter by letter");
    await expect(spelled).toBeVisible();
    await expect(spelled.locator("..")).toContainText("kamusta ka");
    await expect(spelled.locator("..")).not.toContainText("HOW ARE YOU");
  });
});
