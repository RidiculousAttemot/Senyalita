import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { toErrorResponse } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LANDMARK_BUCKET = "animation-landmarks";
const THUMBNAIL_URL_TTL_SECONDS = 3600;

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

    // One signed URL per thumbnail, all in flight together rather than one
    // request at a time — the list can be 100+ assets.
    const thumbnailPaths = [...new Set(allVersions.map((v) => v.thumbnail_path).filter((p): p is string => Boolean(p)))];
    const thumbnailUrls = new Map<string, string>();
    if (thumbnailPaths.length > 0) {
      const signed = await Promise.all(
        thumbnailPaths.map(async (thumbnailPath) => {
          const { data } = await supabase.storage
            .from(LANDMARK_BUCKET)
            .createSignedUrl(thumbnailPath, THUMBNAIL_URL_TTL_SECONDS);
          return [thumbnailPath, data?.signedUrl ?? null] as const;
        }),
      );
      for (const [thumbnailPath, url] of signed) if (url) thumbnailUrls.set(thumbnailPath, url);
    }

    const projectVersion = (v: (typeof allVersions)[number]) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      fps: v.fps,
      totalFrames: v.total_frames,
      durationMs: v.duration_ms,
      qualityScore: v.quality_score,
      landmarkJsonPath: v.landmark_json_path,
      language: v.language,
      storageBytes: v.storage_bytes,
      thumbnailUrl: v.thumbnail_path ? thumbnailUrls.get(v.thumbnail_path) ?? null : null,
      approvedBy: v.approved_by,
      approvedAt: v.approved_at,
      createdBy: v.created_by,
      createdAt: v.created_at,
      publishedAt: v.status === "published" ? v.updated_at : null,
    });

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
        publishedVersion: currentPublished ? projectVersion(currentPublished) : null,
        latestVersion: latest ? projectVersion(latest) : null,
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
