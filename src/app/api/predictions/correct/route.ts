import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const { predicted_label, corrected_label, confidence, source } = body;

    if (!predicted_label || !corrected_label) {
      return NextResponse.json({ error: "predicted_label and corrected_label are required" }, { status: 400 });
    }

    await supabase.from("prediction_corrections").insert({
      user_id: null as unknown as string,
      predicted_label: predicted_label.toUpperCase(),
      corrected_label: corrected_label.toUpperCase(),
      confidence: confidence ?? null,
      source: source ?? "unknown",
    });

    await supabase.from("review_queue").insert({
      gesture_label: corrected_label.toUpperCase(),
      original_prediction: predicted_label.toUpperCase(),
      confidence: confidence ?? 0.5,
      source: "user_correction",
      status: "pending",
      landmarks_data: {},
    }).maybeSingle();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Correction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
