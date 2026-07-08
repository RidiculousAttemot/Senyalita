import { NextRequest, NextResponse } from "next/server";
import { insertTextToSignLog } from "@/lib/supabase/queries/textToSignLogs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = async (req: NextRequest) => {
  try {
    const body = (await req.json()) as {
      input_text?: string;
      translated_gloss?: string | null;
      confidence_score?: number | null;
      processing_time_ms?: number | null;
      unknown_token_count?: number;
      model_version?: string | null;
      session_id?: string | null;
      source?: "web" | "api" | "mobile";
      success?: boolean;
      error_message?: string | null;
    };

    if (!body.input_text) {
      return NextResponse.json(
        { error: "input_text is required" },
        { status: 400 },
      );
    }

    await insertTextToSignLog({
      input_text: body.input_text,
      translated_gloss: body.translated_gloss ?? null,
      confidence_score: body.confidence_score ?? null,
      processing_time_ms: body.processing_time_ms ?? null,
      unknown_token_count: body.unknown_token_count ?? 0,
      model_version: body.model_version ?? null,
      session_id: body.session_id ?? null,
      source: body.source ?? "web",
      success: body.success ?? true,
      error_message: body.error_message ?? null,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ success: true }, { status: 201 });
  }
};
