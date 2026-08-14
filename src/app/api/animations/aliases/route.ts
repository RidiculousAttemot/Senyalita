import { NextResponse } from "next/server";
import { listAllAliases } from "@/lib/supabase/queries/animationAliases";
import { toErrorResponse } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin-managed word→sign mappings, for the public matcher.
 *
 * This route is the entire "no rebuild" property. The source dictionary is
 * bundled at build time, so a word added there needs a deploy before anyone
 * can type it. These are read at runtime from the shared database, which means
 * adding a phrase in the local admin reaches the deployed site immediately --
 * the local console and production are talking to the same Postgres.
 *
 * Phrase and gloss only. The gloss is what /api/animations/[gloss] is asked
 * for; the alias never becomes the key, or playback requests something that
 * does not exist and silently fingerspells.
 *
 * CACHING. 30 seconds, shared, matching /api/animations. The matcher asks once
 * per page load and caches in memory for the session, so this is really a
 * ceiling on how long a newly added phrase takes to appear for someone who
 * already has the page open -- one reload, plus at most the cache window. The
 * admin invalidates its own client cache on save so the person adding the word
 * sees it immediately.
 */
export async function GET() {
  try {
    const aliases = await listAllAliases();
    return NextResponse.json(
      { aliases },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } },
    );
  } catch (error) {
    return toErrorResponse(error, "GET /api/animations/aliases");
  }
}
