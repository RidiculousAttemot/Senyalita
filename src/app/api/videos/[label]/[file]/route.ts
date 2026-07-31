import { NextResponse } from "next/server";
import { resolveSourceVideoUrl } from "@/server/services/datasetCatalog";
import { toErrorResponse } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Serves the original human recording paired with a published landmark asset.
 *
 * Previously this read the raw file off the local filesystem
 * (datasets/raw/user_videos). `datasets` is excluded from deployments by
 * .vercelignore, so the directory exists in development and nowhere else:
 * every request 404'd in production while the same request worked locally,
 * and the Human/Split/Overlay panes rendered as a silent blank box.
 *
 * It now mirrors /api/animations/[gloss]: resolve the version's
 * source_video_path, hand back a short-lived signed Storage URL, and 307.
 * The browser fetches the video straight from Storage's CDN — no bytes
 * through the function, no Range plumbing to keep alive.
 *
 * The status codes keep absent and failed distinct. A 404 means "no
 * published source video" (e.g. a webcam asset never recorded one); a 503
 * means the lookup infrastructure broke and the request should be retried,
 * not treated as a missing recording.
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
