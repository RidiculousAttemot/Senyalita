import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { validateAsset } from "../smartValidator";
import type { GestureAnimationAsset } from "@/features/sign-animation/types";

/**
 * The publish gate must not reject the library it already serves.
 *
 * PublishTab now refuses to publish a "fail" verdict, which makes every
 * threshold load-bearing. Two of them were calibrated against nothing:
 *
 *   movement  fail 5   -- "A" measures 4. A fingerspelled letter is a static
 *                         handshape; the wrist is supposed to stay put.
 *   jitter    fail 50  -- published assets measure 43-53. The line sat inside
 *                         the recording setup's own noise floor.
 *
 * Both would have blocked signs Text-to-Sign has been serving correctly. This
 * runs the real assets through the gate so a future threshold change cannot
 * quietly make the existing library unpublishable.
 */
const DIR = path.join(process.cwd(), "datasets", "processed", "user_holistic_assets");
const SAMPLE = ["a", "b", "c", "1", "5", "10"];

describe("published library passes the publish gate", () => {
  it.skipIf(!existsSync(DIR))("no real asset is rejected outright", () => {
    const rejected: string[] = [];
    for (const gloss of SAMPLE) {
      const dir = path.join(DIR, gloss);
      if (!existsSync(dir)) continue;
      const file = readdirSync(dir).find((f) => f.endsWith("_asset.json"));
      if (!file) continue;

      const asset = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as GestureAnimationAsset;
      const result = validateAsset(asset);
      if (result.verdict === "fail") {
        const failed = Object.entries(result.checks)
          .filter(([, c]) => c.status === "fail")
          .map(([n, c]) => `${n}=${c.value}`);
        rejected.push(`${gloss} (${failed.join(", ")})`);
      }
    }

    expect(rejected, `these are published and working, but the gate rejects them:\n  ${rejected.join("\n  ")}`)
      .toEqual([]);
  });
});
