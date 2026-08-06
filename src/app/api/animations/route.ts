import { NextResponse } from "next/server";
import { listPublishedGlosses } from "@/lib/supabase/queries/animationAssets";
import { toErrorResponse } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The published vocabulary.
 *
 * Without this the public app had no way to ask what exists. Animation keys
 * came from a hardcoded 217-entry dictionary, so publishing a gloss that file
 * did not already name was inert: the word fingerspelled, the asset was never
 * requested, and the only way to add vocabulary was a code deploy.
 *
 * Deliberately just the gloss strings. The client needs to know *whether* to
 * ask for a gloss, and /api/animations/[gloss] answers what it is -- sending
 * asset bodies here would rebuild the multi-megabyte payload that route was
 * changed to avoid.
 *
 * Cached briefly. A publish should show up quickly, but this is hit on every
 * translation, so a short shared cache keeps a burst off the database without
 * making a newly published gloss wait meaningfully longer to appear.
 */
export async function GET() {
  try {
    const glosses = await listPublishedGlosses();
    return NextResponse.json(
      { glosses },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } },
    );
  } catch (error) {
    return toErrorResponse(error, "GET /api/animations");
  }
}
