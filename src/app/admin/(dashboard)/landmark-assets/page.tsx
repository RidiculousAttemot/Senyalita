import { LandmarkAssetManager } from "@/components/admin/LandmarkAssetManager";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { listAnimationAssets } from "@/lib/supabase/queries/animationAssets";
import type { AnimationAssetWorkspaceRow } from "@/lib/supabase/queries/animationAssets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LandmarkAssetsPage() {
  await requireAdmin();
  let assets: AnimationAssetWorkspaceRow[] = [];
  try { assets = await listAnimationAssets(); } catch { }
  return <LandmarkAssetManager initialAssets={assets} />;
}