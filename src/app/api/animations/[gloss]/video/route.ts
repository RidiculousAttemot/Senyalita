import { NextResponse } from "next/server";
import { getPublishedSourceVideoSignedUrl } from "@/lib/supabase/queries/animationAssets";
import { toErrorResponse } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The recording a sign was extracted from, for Human / Split / Overlay.
 *
 * These modes drew nothing. The published asset JSON carries
 * `video: "/api/videos/<gloss>/<file>"` -- a filesystem route reading
 * datasets/raw/user_videos, which deployments exclude, so it 404s in production
 * for every asset. That string is written at publish time, so all 38 published
 * assets carry the dead path and rewriting them would not help the next one.
 *
 * The recordings were never missing: every published version has a
 * source_video_path and all 38 objects exist, 10-16 MB each. Only the reference
 * was wrong. This route resolves from source_video_path instead, so the field
 * baked into old assets stops mattering.
 *
 * A sibling of /api/animations/[gloss] rather than a change to it: that route
 * redirects to Storage and never holds the JSON body, so it has no opportunity
 * to rewrite the field as it passes.
 *
 * Redirects rather than proxying, for the same reason the landmark route does.
 * These are 10-16 MB files -- streaming them through the function would put the
 * whole payload through it on every request, and a fingerspelled word means one
 * per letter.
 */
export async function GET(_request: Request, { params }: { params: { gloss: string } }) {
  try {
    const gloss = decodeURIComponent(params.gloss);
    const resolution = await getPublishedSourceVideoSignedUrl(gloss);

    if (resolution.outcome === "failed") {
      // Infrastructure failure, not a missing recording. Reporting it as 404
      // would tell the player to give up permanently on something that should
      // be retried -- the same conflation the landmark route had to fix.
      return NextResponse.json(
        { error: "Recording temporarily unavailable." },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "X-Video-Source": "lookup-failed",
            "X-Video-Failure-Stage": resolution.stage,
          },
        },
      );
    }

    if (resolution.outcome === "absent") {
      // Published, but with no recording. Legitimate: landmarks are what
      // playback needs, and Skeleton still works. Never cached, because
      // publishing a source video is exactly what changes this answer.
      return NextResponse.json(
        { error: "No recording available for this sign." },
        { status: 404, headers: { "Cache-Control": "no-store", "X-Video-Source": "absent" } },
      );
    }

    // 307 with a cache window well inside the signature's 600s lifetime, so a
    // burst reuses one signature without ever handing out an expired one.
    return NextResponse.redirect(resolution.url, {
      status: 307,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "X-Video-Source": "published",
      },
    });
  } catch (error) {
    return toErrorResponse(error, `GET /api/animations/${params.gloss}/video`);
  }
}
