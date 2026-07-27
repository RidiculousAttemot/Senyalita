import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CollectionBody = {
  label: string;
  signer_id?: string;
  landmarks?: Record<string, unknown>;
  confidence?: number;
  session_id?: string;
  environment?: string;
  lighting?: string;
  camera_angle?: string;
  background?: string;
  hand_dominance?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CollectionBody;

    if (!body.label) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Insert into review_queue for admin validation
    const { data: reviewItem, error: reviewError } = await supabase
      .from("review_queue")
      .insert({
        gesture_label: body.label.toUpperCase(),
        landmarks_data: body.landmarks ?? {},
        confidence: body.confidence ?? 1.0,
        source: "admin_flag",
        original_prediction: body.label.toUpperCase(),
        session_id: body.session_id ?? null,
      })
      .select()
      .single();

    if (reviewError) {
      // Log the driver message server-side; return a generic one. Postgres
      // errors name tables, columns and constraints — internal schema detail
      // that an unauthenticated caller should not receive.
      console.error("[api] POST /api/collection review insert failed:", reviewError);
      return NextResponse.json({ error: "Unable to record this submission." }, { status: 500 });
    }

    // Record session diversity metadata if provided
    if (body.signer_id || body.lighting || body.camera_angle || body.background || body.hand_dominance) {
      const { error: divError } = await supabase
        .from("session_diversity_metadata")
        .insert({
          session_id: body.session_id ?? reviewItem.id,
          signer_id: body.signer_id ?? null,
          lighting: body.lighting ?? null,
          camera_angle: body.camera_angle ?? null,
          background: body.background ?? null,
          hand_dominance: body.hand_dominance ?? null,
          environment: body.environment ?? null,
        });

      if (divError) {
        console.warn("Failed to record diversity metadata:", divError.message);
      }
    }

    // Upsert signer profile if signer_id provided
    if (body.signer_id) {
      await supabase.from("signer_profiles").upsert(
        { signer_id: body.signer_id },
        { onConflict: "signer_id", ignoreDuplicates: false }
      );
    }

    return NextResponse.json({
      success: true,
      review_id: reviewItem?.id ?? null,
      label: body.label.toUpperCase(),
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: campaigns } = await supabase
      .from("review_queue")
      .select("gesture_label, count", { count: "exact" })
      .eq("source", "admin_flag")
      .order("gesture_label");

    const { data: diversity } = await supabase
      .from("session_diversity_metadata")
      .select("*");

    const { data: profiles } = await supabase
      .from("signer_profiles")
      .select("*");

    return NextResponse.json({
      collection_count: campaigns?.length ?? 0,
      diversity_sessions: diversity?.length ?? 0,
      registered_signers: profiles?.length ?? 0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
