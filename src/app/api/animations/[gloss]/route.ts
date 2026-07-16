import { NextResponse } from "next/server";
import { getPublishedAnimationAsset } from "@/lib/supabase/queries/animationAssets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { gloss: string } }) {
  try {
    const asset = await getPublishedAnimationAsset(decodeURIComponent(params.gloss));
    if (!asset) return NextResponse.json({ error: "Animation unavailable." }, { status: 404 });

    return NextResponse.json(asset, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  } catch {
    return NextResponse.json({ error: "Animation unavailable." }, { status: 404 });
  }
}