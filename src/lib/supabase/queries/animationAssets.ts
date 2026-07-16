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

export async function getPublishedAnimationAsset(gloss: string): Promise<GestureAnimationAsset | null> {
  const supabase = createSupabaseServiceClient();
  const { data: asset, error: assetError } = await supabase
    .from("animation_assets")
    .select("published_version_id")
    .eq("gloss", gloss.toUpperCase())
    .maybeSingle();

  if (assetError || !asset?.published_version_id) return null;

  const { data: version, error: versionError } = await supabase
    .from("animation_asset_versions")
    .select("status, landmark_json_path")
    .eq("id", asset.published_version_id)
    .maybeSingle();

  if (versionError || version?.status !== "published" || !version.landmark_json_path) return null;

  const { data: file, error: downloadError } = await supabase.storage
    .from("animation-landmarks")
    .download(version.landmark_json_path);

  if (downloadError || !file) return null;
  return resolvePublishedAnimationAsset({
    findVersion: async () => ({ status: version.status, json: await file.text() }),
  }, gloss);
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