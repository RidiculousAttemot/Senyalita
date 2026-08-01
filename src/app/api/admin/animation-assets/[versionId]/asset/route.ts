import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { toErrorResponse, NotFoundError } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LANDMARK_BUCKET = "animation-landmarks";
const SOURCE_BUCKET = "animation-source-videos";
const SIGNED_URL_TTL_SECONDS = 600;

/**
 * Admin-only asset preview: the parsed landmark JSON plus a signed URL for
 * the source recording, for any version regardless of status (draft, ready,
 * approved, published, archived). Unlike the public `/api/animations/[gloss]`
 * route, this is not gated on "published" — an admin needs to preview a
 * version before deciding whether to approve it.
 */
export async function GET(_request: Request, { params }: { params: { versionId: string } }) {
  try {
    await requireAdmin();
    const supabase = createSupabaseServiceClient();

    const { data: version, error: versionError } = await supabase
      .from("animation_asset_versions")
      .select("landmark_json_path, source_video_path")
      .eq("id", params.versionId)
      .maybeSingle();
    if (versionError) throw new Error(versionError.message);
    if (!version || !version.landmark_json_path) throw new NotFoundError("No animation is available for this version yet.");

    const { data: file, error: downloadError } = await supabase.storage
      .from(LANDMARK_BUCKET)
      .download(version.landmark_json_path);
    if (downloadError) throw new Error(downloadError.message);

    const asset = JSON.parse(await file.text());

    let videoUrl: string | null = null;
    if (version.source_video_path) {
      const { data: signed } = await supabase.storage
        .from(SOURCE_BUCKET)
        .createSignedUrl(version.source_video_path, SIGNED_URL_TTL_SECONDS);
      videoUrl = signed?.signedUrl ?? null;
    }

    return NextResponse.json({ asset, videoUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error, `GET /api/admin/animation-assets/${params.versionId}/asset`);
  }
}
