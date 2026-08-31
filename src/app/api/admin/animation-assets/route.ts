import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { toErrorResponse } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Renames a gloss.
 *
 * The gloss is the only key the public resolver looks an asset up by, so this
 * is a live change: a published asset renamed here stops answering under its
 * old name on the next request. Rejecting an existing gloss keeps that from
 * silently detaching whichever asset already owned the name -- the column is
 * unique, so the alternative is a constraint error mid-request.
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json()) as { assetId?: string; gloss?: string };
    const gloss = typeof body.gloss === "string" ? body.gloss.trim().toUpperCase().replace(/\s+/g, " ") : "";

    if (!body.assetId || !gloss) {
      return NextResponse.json({ error: "An asset and a new gloss are required." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: clash, error: clashError } = await supabase
      .from("animation_assets")
      .select("id")
      .eq("gloss", gloss)
      .neq("id", body.assetId)
      .maybeSingle();
    if (clashError) throw new Error(clashError.message);
    if (clash) {
      return NextResponse.json({ error: `"${gloss}" is already used by another asset.` }, { status: 409 });
    }

    const { error: renameError } = await supabase
      .from("animation_assets")
      .update({ gloss })
      .eq("id", body.assetId);
    if (renameError) throw new Error(renameError.message);

    return NextResponse.json({ ok: true, gloss });
  } catch (err) {
    return toErrorResponse(err, "PATCH /api/admin/animation-assets");
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createSupabaseServiceClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toUpperCase() ?? "";
    const status = searchParams.get("status") ?? "";
    const sort = searchParams.get("sort") ?? "recent";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(10, parseInt(searchParams.get("limit") ?? "25", 10)));
    const offset = (page - 1) * limit;

    // Build base query with sorting
    let query = supabase
      .from("animation_assets")
      .select("id, gloss, published_version_id, created_at, updated_at", { count: "exact" });

    // Apply filters
    if (search) {
      query = query.ilike("gloss", `%${search}%`);
    }

    // Apply sorting
    if (sort === "gloss") {
      query = query.order("gloss", { ascending: true });
    } else if (sort === "published") {
      query = query.order("published_version_id", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    // Apply pagination
    const { data: assets, error: assetsError, count: totalCount } = await query.range(offset, offset + limit - 1);

    if (assetsError) throw new Error(assetsError.message);

    // For displayed assets, fetch their versions efficiently
    const assetIds = assets.map((a) => a.id);
    const { data: allVersions, error: versionsError } = await supabase
      .from("animation_asset_versions")
      .select("id, asset_id, version, status, fps, total_frames, duration_ms, quality_score, landmark_json_path, approved_by, approved_at, created_at, created_by")
      .in("asset_id", assetIds)
      .order("version", { ascending: false });

    if (versionsError) throw new Error(versionsError.message);

    // Count reviews per version more efficiently
    const { data: reviewCounts, error: reviewsError } = await supabase
      .from("animation_asset_reviews")
      .select("version_id", { count: "exact", head: true })
      .in("version_id", allVersions.map((v) => v.id));

    if (reviewsError) throw new Error(reviewsError.message);

    const result = assets.map((asset) => {
      const versions = allVersions.filter((v) => v.asset_id === asset.id);
      const currentPublished = versions.find((v) => v.status === "published");
      const latest = versions[0] ?? null;
      const versionIds = versions.map((v) => v.id);

      return {
        id: asset.id,
        gloss: asset.gloss,
        publishedVersionId: asset.published_version_id,
        createdAt: asset.created_at,
        updatedAt: asset.updated_at,
        publishedVersion: currentPublished
          ? {
              id: currentPublished.id,
              version: currentPublished.version,
              fps: currentPublished.fps,
              totalFrames: currentPublished.total_frames,
              durationMs: currentPublished.duration_ms,
              qualityScore: currentPublished.quality_score,
              landmarkJsonPath: currentPublished.landmark_json_path,
              status: currentPublished.status,
              approvedBy: currentPublished.approved_by,
              approvedAt: currentPublished.approved_at,
              createdBy: currentPublished.created_by,
            }
          : null,
        latestVersion: latest
          ? {
              id: latest.id,
              version: latest.version,
              status: latest.status,
              fps: latest.fps,
              totalFrames: latest.total_frames,
              durationMs: latest.duration_ms,
              qualityScore: latest.quality_score,
              createdAt: latest.created_at,
              createdBy: latest.created_by,
            }
          : null,
        status: latest?.status ?? "pending",
        versionCount: versions.length,
        reviewCount: versionIds.length,
      };
    });

    return NextResponse.json({
      assets: result,
      total: totalCount ?? result.length,
      page,
      limit,
      hasMore: offset + limit < (totalCount ?? 0),
    });
  } catch (err) {
    return toErrorResponse(err, "GET /api/admin/animation-assets");
  }
}
