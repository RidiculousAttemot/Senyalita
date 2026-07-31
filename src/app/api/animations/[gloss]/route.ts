import { NextResponse } from "next/server";
import { resolveAnimationUrl } from "@/server/services/animationAssets";
import { toErrorResponse } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Serves the landmark animation for a gloss.
 *
 * This route used to download the ~3MB object from Storage, parse it, and
 * re-serialise it back out — roughly 90ms of CPU and 3MB of function bandwidth
 * per request. Spelling a five-letter word pushed 15MB through the function,
 * and measured against production a single letter took 1.56s to first byte.
 *
 * It now redirects to a short-lived signed Storage URL. The bytes go straight
 * from Storage's CDN to the browser: no download into the function, no parse,
 * no re-serialise, and no function-timeout exposure on a large object.
 *
 * X-Animation-Source stays on the *redirect*, not on the final response, so
 * anything asserting it must use `redirect: "manual"`. That header is the only
 * thing distinguishing a published asset from the local development fallback,
 * and losing that distinction is what hid a six-week bug before.
 */
export async function GET(_request: Request, { params }: { params: { gloss: string } }) {
  try {
    const gloss = decodeURIComponent(params.gloss);
    const resolution = await resolveAnimationUrl(gloss);

    // A failed lookup is not a missing asset. Reporting infrastructure failure
    // as 404 is what let this hide: the client treats 404 as "unpublished",
    // fingerspells, and nothing anywhere records that a published asset was
    // unreachable. 503 says the asset exists and the request should be retried.
    if (resolution.outcome === "failed") {
      return NextResponse.json(
        { error: "Animation temporarily unavailable." },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": "1",
            "X-Animation-Source": "lookup-failed",
            "X-Animation-Failure-Stage": resolution.failure.stage,
          },
        },
      );
    }

    if (resolution.outcome === "absent") {
      // Never cache a miss. A 404 here means "no published asset yet", which is
      // exactly the state that changes when an admin publishes. Caching it is
      // what made a freshly published gloss keep 404ing for the cache lifetime.
      return NextResponse.json(
        { error: "Animation unavailable." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (resolution.outcome === "inline") {
      // Development fallback only: a local file has no Storage object to sign.
      return NextResponse.json(resolution.asset, {
        headers: {
          "Cache-Control": "no-store",
          "X-Animation-Source": resolution.source,
        },
      });
    }

    // 307, not 308: a permanent redirect would be cached by the browser against
    // a URL that expires in ten minutes, and would keep being replayed after it
    // died. The redirect is cacheable for well under the signature's lifetime,
    // so a burst on one gloss reuses a signature without ever handing out one
    // that is about to expire.
    return NextResponse.redirect(resolution.url, {
      status: 307,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "X-Animation-Source": resolution.source,
      },
    });
  } catch (error) {
    return toErrorResponse(error, `GET /api/animations/${params.gloss}`);
  }
}
