import "server-only";

import type { GestureAnimationAsset } from "@/features/sign-animation/types";
import { createSupabaseServiceClient } from "../service";
import type { AnimationAsset, AnimationAssetVersion } from "@/lib/animationAssets";

type PublishedVersionResult = {
  status: string;
  json: string | null;
};

export interface PublishedAnimationAssetRepository {
  findVersion: () => Promise<PublishedVersionResult | null>;
}

export async function resolvePublishedAnimationAsset(
  repository: PublishedAnimationAssetRepository,
  _gloss: string,
): Promise<GestureAnimationAsset | null> {
  const version = await repository.findVersion();
  if (version?.status !== "published" || !version.json) return null;

  try {
    return JSON.parse(version.json) as GestureAnimationAsset;
  } catch {
    return null;
  }
}

/**
 * The outcome of a published-asset lookup.
 *
 * Previously every branch of this function returned `null`, so "this gloss was
 * never published" and "the database or storage call failed" were the same
 * value. Callers could not tell them apart, so a transient infrastructure
 * failure was reported to the user as a missing animation — and in
 * development it silently fell through to the local directory, which meant
 * the failure was invisible on the machine where it was most likely to be
 * noticed.
 *
 * `absent` is a fact about the data. `failed` is a fact about the
 * infrastructure. They are not the same and must not share a representation.
 */
export type PublishedAssetLookup =
  | { outcome: "found"; asset: GestureAnimationAsset }
  | { outcome: "absent" }
  | { outcome: "failed"; stage: "asset" | "version" | "download" | "parse"; message: string };

export async function getPublishedAnimationAsset(gloss: string): Promise<PublishedAssetLookup> {
  const supabase = createSupabaseServiceClient();
  const { data: asset, error: assetError } = await supabase
    .from("animation_assets")
    .select("published_version_id")
    .eq("gloss", gloss.toUpperCase())
    .maybeSingle();

  if (assetError) return { outcome: "failed", stage: "asset", message: assetError.message };
  if (!asset?.published_version_id) return { outcome: "absent" };

  const { data: version, error: versionError } = await supabase
    .from("animation_asset_versions")
    .select("status, landmark_json_path")
    .eq("id", asset.published_version_id)
    .maybeSingle();

  if (versionError) return { outcome: "failed", stage: "version", message: versionError.message };
  if (version?.status !== "published" || !version.landmark_json_path) return { outcome: "absent" };

  // This is the 3MB download, and the one that fails under concurrent load.
  const { data: file, error: downloadError } = await supabase.storage
    .from("animation-landmarks")
    .download(version.landmark_json_path);

  if (downloadError) {
    return { outcome: "failed", stage: "download", message: downloadError.message };
  }
  if (!file) {
    return { outcome: "failed", stage: "download", message: "storage returned no body and no error" };
  }

  const parsed = await resolvePublishedAnimationAsset({
    findVersion: async () => ({ status: version.status, json: await file.text() }),
  }, gloss);

  // The row says published and storage returned bytes, so unparseable content
  // is a corrupt object, not an absent one.
  if (!parsed) {
    return { outcome: "failed", stage: "parse", message: "published landmark JSON could not be parsed" };
  }
  return { outcome: "found", asset: parsed };
}

export type AnimationAssetWorkspaceRow = AnimationAsset & { versions: AnimationAssetVersion[] };

export async function listAnimationAssets(): Promise<AnimationAssetWorkspaceRow[]> {
  const supabase = createSupabaseServiceClient();
  const [{ data: assets, error: assetsError }, { data: versions, error: versionsError }] = await Promise.all([
    supabase.from("animation_assets").select("*").order("gloss"),
    supabase.from("animation_asset_versions").select("*").order("version", { ascending: false }),
  ]);
  if (assetsError || versionsError) throw new Error(assetsError?.message ?? versionsError?.message ?? "Unable to load landmark assets.");
  return (assets ?? []).map((asset) => ({ ...asset, versions: (versions ?? []).filter((version) => version.asset_id === asset.id) }));
}