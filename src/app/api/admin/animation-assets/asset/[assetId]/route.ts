import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { toErrorResponse, NotFoundError } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LANDMARK_BUCKET = "animation-landmarks";
const SOURCE_BUCKET = "animation-source-videos";

/**
 * Permanently removes an animation asset and every version under it.
 *
 * Distinct from "archive": archiving a version is reversible and keeps the
 * row (and the ones before it) around, which is what Text-to-Sign versioning
 * relies on. Delete is the escape hatch for a genuine mistake (wrong gloss,
 * test upload) and removes the storage objects too, so it is not undoable.
 *
 * Nested under a static `asset/` segment (rather than a sibling of
 * `[versionId]`) because Next.js does not allow two different dynamic slug
 * names at the same route level.
 */
export async function DELETE(_request: Request, { params }: { params: { assetId: string } }) {
  try {
    await requireAdmin();
    const supabase = createSupabaseServiceClient();

    const { data: versions, error: versionsError } = await supabase
      .from("animation_asset_versions")
      .select("source_video_path, landmark_json_path, thumbnail_path")
      .eq("asset_id", params.assetId);
    if (versionsError) throw new Error(versionsError.message);
    if (!versions) throw new NotFoundError("Animation asset not found.");

    const sourcePaths = versions.map((v) => v.source_video_path).filter((p): p is string => Boolean(p));
    const landmarkPaths = versions
      .flatMap((v) => [v.landmark_json_path, v.thumbnail_path])
      .filter((p): p is string => Boolean(p));

    // Storage cleanup is best-effort: a stray object left behind is a cost to
    // clean up later, but blocking the delete on it would leave the asset
    // half-removed (gone from the library, still occupying storage) with no
    // way back in through the UI.
    if (sourcePaths.length > 0) {
      const { error } = await supabase.storage.from(SOURCE_BUCKET).remove(sourcePaths);
      if (error) console.error(`[animation-assets] source video cleanup failed for asset ${params.assetId}:`, error.message);
    }
    if (landmarkPaths.length > 0) {
      const { error } = await supabase.storage.from(LANDMARK_BUCKET).remove(landmarkPaths);
      if (error) console.error(`[animation-assets] landmark cleanup failed for asset ${params.assetId}:`, error.message);
    }

    // Cascades to animation_asset_versions -> animation_asset_reviews /
    // animation_processing_jobs (all `on delete cascade` per 0035).
    const { error: deleteError } = await supabase.from("animation_assets").delete().eq("id", params.assetId);
    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, `DELETE /api/admin/animation-assets/asset/${params.assetId}`);
  }
}
