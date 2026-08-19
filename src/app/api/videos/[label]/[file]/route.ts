import { NextResponse } from "next/server";
import { resolveSourceVideoUrl } from "@/server/services/datasetCatalog";
import { toErrorResponse } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * A published sign's source recording.
 *
 * Resolves from source_video_path and 307s to a signed Storage URL.
 *
 * The [file] segment is VESTIGIAL. Resolution is by label, so any filename in
 * that position returns the same object -- /A/source and /A/source.mp4 both
 * work. Nothing has ever used it to select among takes.
 *
 * HISTORICAL, because the stale version of this comment outlived the fix and
 * misled two readers -- one of whom built a redundant route on the strength of
 * it. This route USED to read datasets/raw/user_videos off the filesystem, which
 * .vercelignore excludes, so it 404d in production. Fixed in dfa3f981. Do not
 * reintroduce a filesystem read here.
 *
 * As of 2026-08-18 only A has a recording: the rest were deleted to free 490MB
 * for the 91-sign batch. See SYSTEM_DOCUMENTATION.md 1.1.
 */
export async function GET(
  _request: Request,
  { params }: { params: { label: string; file: string } },
) {
  try {
    const resolution = await resolveSourceVideoUrl(
      decodeURIComponent(params.label),
      decodeURIComponent(params.file),
    );

    if (resolution.outcome === "failed") {
      return NextResponse.json(
        { error: "Source video temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "1" } },
      );
    }

    if (resolution.outcome === "absent") {
      return NextResponse.json(
        { error: "Video unavailable." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    // 307, not 308: a permanent redirect would be cached by the browser
    // against a URL that expires, and replayed after it died.
    return NextResponse.redirect(resolution.url, {
      status: 307,
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  } catch (error) {
    return toErrorResponse(error, `GET /api/videos/${params.label}/${params.file}`);
  }
}
