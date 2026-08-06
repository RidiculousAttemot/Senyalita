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
    const category = searchParams.get("category") ?? "";
    const language = searchParams.get("language") ?? "";
    const difficulty = searchParams.get("difficulty") ?? "";
    const sort = searchParams.get("sort") ?? "recent";

    const { data: assets, error: assetsError } = await supabase
      .from("animation_assets")
      .select("id, gloss, published_version_id, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (assetsError) throw new Error(assetsError.message);

    const { data: allVersions, error: versionsError } = await supabase
      .from("animation_asset_versions")
      .select("*")
      .order("version", { ascending: false });

    if (versionsError) throw new Error(versionsError.message);

    const { data: reviews, error: reviewsError } = await supabase
      .from("animation_asset_reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (reviewsError) throw new Error(reviewsError.message);

    let result = assets.map((asset) => {
      const versions = allVersions.filter((v) => v.asset_id === asset.id);
      const currentPublished = versions.find((v) => v.status === "published");
      const latest = versions[0] ?? null;
      const assetReviews = reviews.filter((r) => versions.some((v) => v.id === r.version_id));

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
        reviewCount: assetReviews.length,
      };
    });

    if (search) {
      result = result.filter((a) => a.gloss.includes(search));
    }
    if (status) {
      result = result.filter((a) => a.status === status);
    }

    if (sort === "recent") {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === "published") {
      result.sort((a, b) => {
        const aPub = a.publishedVersion?.approvedAt ?? "";
        const bPub = b.publishedVersion?.approvedAt ?? "";
        return bPub.localeCompare(aPub);
      });
    } else if (sort === "gloss") {
      result.sort((a, b) => a.gloss.localeCompare(b.gloss));
    }

    return NextResponse.json({ assets: result, total: result.length });
  } catch (err) {
    return toErrorResponse(err, "GET /api/admin/animation-assets");
  }
}
