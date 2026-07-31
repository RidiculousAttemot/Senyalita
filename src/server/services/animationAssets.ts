import "server-only";
import fs from "fs/promises";
import path from "path";
import { getPublishedAnimationAsset } from "@/lib/supabase/queries/animationAssets";

/**
 * Resolves the landmark animation for a gloss.
 *
 * Two sources, in order:
 *
 *  1. The published Supabase asset — the only source that exists in
 *     production.
 *  2. A local extraction directory — a *development convenience* only.
 *
 * The local directory (`datasets/processed/user_holistic_assets`) holds ~933MB
 * of extracted landmark JSON that is excluded from git by
 * `.gitignore` ("datasets/processed/**\/*.json"), so it is never part of a
 * deployment. Before this was made explicit, the fallback silently made
 * development strictly more capable than production: ~38 glosses (A–Z, 0–9)
 * animated locally and quietly degraded to procedural fingerspelling once
 * deployed. Gating it behind an explicit flag keeps the convenience without
 * letting it hide that divergence.
 */

const DATASET_DIR = path.join(process.cwd(), "datasets", "processed", "user_holistic_assets");

/**
 * Local assets are opt-in. They default ON in development (so the existing
 * workflow is unchanged) and are unavailable in production regardless, since
 * the files are not deployed.
 */
function localFallbackEnabled(): boolean {
  const flag = process.env.ANIMATION_LOCAL_FALLBACK;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

async function readAssetFromDir(dir: string): Promise<unknown | null> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }
  const assetFile = entries.find((f) => f.endsWith("_asset.json"));
  if (!assetFile) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(dir, assetFile), "utf-8"));
  } catch {
    return null;
  }
}

async function findLocalAsset(gloss: string): Promise<unknown | null> {
  const normalized = gloss.toLowerCase();

  const exact = await readAssetFromDir(path.join(DATASET_DIR, normalized));
  if (exact) return exact;

  // Case-insensitive directory scan. Guarded: the previous implementation
  // called readdirSync unconditionally, which threw whenever DATASET_DIR was
  // absent — i.e. on every deployment — and was only masked by an outer catch.
  let dirEntries;
  try {
    dirEntries = await fs.readdir(DATASET_DIR, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of dirEntries) {
    if (!entry.isDirectory() || entry.name.toLowerCase() !== normalized) continue;
    const asset = await readAssetFromDir(path.join(DATASET_DIR, entry.name));
    if (asset) return asset;
  }
  return null;
}

export interface ResolvedAnimation {
  asset: unknown;
  /**
   * How the asset was obtained. The two `local-development-*` values record
   * WHY the published lookup was not used, which is the distinction that made
   * this bug invisible: a fallback because nothing is published is normal,
   * a fallback because the lookup failed is an incident.
   */
  source: "published" | "local-development-absent" | "local-development-failed";
}

/** A published asset exists but could not be retrieved. */
export class AnimationLookupFailure extends Error {
  constructor(
    readonly gloss: string,
    readonly stage: "asset" | "version" | "download" | "parse",
    message: string,
  ) {
    super(`animation lookup failed for "${gloss}" at stage "${stage}": ${message}`);
    this.name = "AnimationLookupFailure";
  }
}

export type AnimationResolution =
  | { outcome: "resolved"; resolved: ResolvedAnimation }
  | { outcome: "absent" }
  | { outcome: "failed"; failure: AnimationLookupFailure };

export async function resolveAnimationAsset(gloss: string): Promise<AnimationResolution> {
  const published = await getPublishedAnimationAsset(gloss);

  if (published.outcome === "found") {
    return { outcome: "resolved", resolved: { asset: published.asset, source: "published" } };
  }

  const failure =
    published.outcome === "failed"
      ? new AnimationLookupFailure(gloss, published.stage, published.message)
      : null;

  if (failure) {
    // The real diagnosis, at the point it is known. The previous message here
    // asserted "has no published Supabase asset" for every fallback, which was
    // a wrong diagnosis printed confidently -- worse than silence, because it
    // sent anyone reading the logs after the wrong problem.
    console.error(`[animations] ${failure.message}`);
  }

  if (!localFallbackEnabled()) {
    return failure ? { outcome: "failed", failure } : { outcome: "absent" };
  }

  const local = await findLocalAsset(gloss);
  if (!local) {
    return failure ? { outcome: "failed", failure } : { outcome: "absent" };
  }

  if (failure) {
    console.warn(
      `[animations] "${gloss}" is being served from the local development ` +
        "fallback because the published lookup FAILED, not because it is " +
        "unpublished. In production this request would have 404'd.",
    );
    return {
      outcome: "resolved",
      resolved: { asset: local, source: "local-development-failed" },
    };
  }

  console.warn(
    `[animations] "${gloss}" served from the local development fallback. ` +
      "It has no published Supabase asset and will fingerspell in production.",
  );
  return {
    outcome: "resolved",
    resolved: { asset: local, source: "local-development-absent" },
  };
}
