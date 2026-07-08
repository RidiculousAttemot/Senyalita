import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const FEEDBACK_DIR = path.join(process.cwd(), "datasets", "feedback");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const { predicted_label, corrected_label, confidence, source, features } = body;

    if (!predicted_label || !corrected_label) {
      return NextResponse.json({ error: "predicted_label and corrected_label are required" }, { status: 400 });
    }

    // Save to Supabase for review
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

    // Save features to feedback dataset for retraining
    if (features && Array.isArray(features) && features.length > 0) {
      ensureDir(FEEDBACK_DIR);
      const entry = {
        label: corrected_label.toUpperCase(),
        timestamp: new Date().toISOString(),
        sequence: features,
        sequenceLength: Math.floor(features.length / 126),
        featureDimension: 126,
        source: "user-correction",
      };
      fs.appendFileSync(
        path.join(FEEDBACK_DIR, "corrections.jsonl"),
        JSON.stringify(entry) + "\n"
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Correction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
