import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { toErrorResponse } from "@/server/http/errors";
import {
  createAlias,
  deleteAlias,
  listAliasesForAsset,
  listClaimedPhrases,
  reorderAliases,
  setCanonicalAlias,
} from "@/lib/supabase/queries/animationAliases";
import { prepareAliasPhrase } from "@/lib/aliases/normalisePhrase";
import { detectAliasConflicts, isRefusal } from "@/lib/aliases/conflicts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The words that play one animation.
 *
 * Validation lives here rather than only in the UI. The admin is the only
 * caller today, but a refusal that exists solely in a React component is a
 * suggestion, and the constraint being protected -- one phrase, one sign -- is
 * the thing that keeps the matcher unambiguous.
 */

const LANGUAGES = new Set(["en", "tl"]);

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const assetId = new URL(request.url).searchParams.get("assetId");
    if (!assetId) return NextResponse.json({ error: "Which animation's words?" }, { status: 400 });
    const aliases = await listAliasesForAsset(assetId);
    return NextResponse.json({ aliases });
  } catch (err) {
    return toErrorResponse(err, "GET /api/admin/aliases");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      assetId?: string;
      phrase?: string;
      language?: string;
      isCanonical?: boolean;
    };

    if (!body.assetId) {
      return NextResponse.json({ error: "Which animation should this phrase play?" }, { status: 400 });
    }

    if (!body.language || !LANGUAGES.has(body.language)) {
      return NextResponse.json({ error: "Choose a language for this phrase (English or Filipino)." }, { status: 400 });
    }

    // Normalised through the real tokeniser, so what is stored is what the
    // matcher will look up. "kumusta ka" becomes "kamusta ka" here.
    const prepared = prepareAliasPhrase(body.phrase ?? "");
    if (!prepared.ok) return NextResponse.json({ error: prepared.reason }, { status: 400 });

    const supabase = createSupabaseServiceClient();
    const { data: asset, error: assetError } = await supabase
      .from("animation_assets")
      .select("gloss")
      .eq("id", body.assetId)
      .maybeSingle();
    if (assetError) throw new Error(assetError.message);
    if (!asset) return NextResponse.json({ error: "That animation no longer exists." }, { status: 404 });

    const gloss = (asset as { gloss: string }).gloss;
    const conflicts = detectAliasConflicts({
      phrase: prepared.value.phrase,
      gloss,
      claimed: await listClaimedPhrases(),
    });

    if (isRefusal(conflicts)) {
      return NextResponse.json(
        { error: conflicts.find((c) => c.severity === "refuse")!.message, conflicts },
        { status: 409 },
      );
    }

    // Warnings do not block, but they are returned so the admin can show them
    // rather than the save appearing to have no consequences.
    const alias = await createAlias({
      assetId: body.assetId,
      phrase: prepared.value.phrase,
      language: body.language as "en" | "tl",
      isCanonical: body.isCanonical === true,
    });

    return NextResponse.json({ alias, conflicts, normalisedFrom: body.phrase ?? "" });
  } catch (err) {
    return toErrorResponse(err, "POST /api/admin/aliases");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const aliasId = searchParams.get("aliasId");
    if (!aliasId) return NextResponse.json({ error: "Which phrase should be removed?" }, { status: 400 });

    await deleteAlias(aliasId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err, "DELETE /api/admin/aliases");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json()) as { aliasId?: string; order?: string[] };

    if (Array.isArray(body.order)) {
      await reorderAliases(body.order);
      return NextResponse.json({ ok: true });
    }
    if (body.aliasId) {
      await setCanonicalAlias(body.aliasId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  } catch (err) {
    return toErrorResponse(err, "PATCH /api/admin/aliases");
  }
}
