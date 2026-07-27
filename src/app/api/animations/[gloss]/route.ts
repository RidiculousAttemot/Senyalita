import { NextResponse } from "next/server";
import { resolveAnimationAsset } from "@/server/services/animationAssets";
import { toErrorResponse } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { gloss: string } }) {
  try {
    const gloss = decodeURIComponent(params.gloss);
    const resolved = await resolveAnimationAsset(gloss);

    if (!resolved) {
      // Never cache a miss. A 404 here means "no published asset yet", which
      // is exactly the state that changes when an admin publishes. Caching it
      // is what made a freshly published gloss keep 404ing for the cache
      // lifetime — the resolver was already correct, the CDN was not.
      return NextResponse.json(
        { error: "Animation unavailable." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(resolved.asset, {
      headers: {
        // Hits are safe to cache: publishing creates a new version rather than
        // mutating one. s-maxage is kept short and paired with
        // stale-while-revalidate so a republish propagates within a minute
        // while the CDN still absorbs the load — these payloads are ~3MB.
        "Cache-Control": "public, max-age=300, s-maxage=60, stale-while-revalidate=600",
        // Lets the client and any log tell a published asset apart from a
        // local development one without inspecting the payload.
        "X-Animation-Source": resolved.source,
      },
    });
  } catch (error) {
    return toErrorResponse(error, `GET /api/animations/${params.gloss}`);
  }
}
