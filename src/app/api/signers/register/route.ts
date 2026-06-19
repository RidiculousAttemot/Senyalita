import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SignerBody = {
  signer_id: string;
  age_range?: string;
  handedness?: string;
  signing_experience?: string;
  region?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SignerBody;

    if (!body.signer_id) {
      return NextResponse.json({ error: "signer_id is required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("signer_profiles")
      .upsert({
        signer_id: body.signer_id,
        age_range: body.age_range ?? null,
        handedness: body.handedness ?? null,
        signing_experience: body.signing_experience ?? null,
        region: body.region ?? null,
        last_active_at: new Date().toISOString(),
      }, { onConflict: "signer_id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ signer: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
