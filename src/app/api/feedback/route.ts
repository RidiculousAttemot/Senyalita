import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertFeedback } from "@/lib/supabase/queries/feedback";
import type { FeedbackRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = async (req: NextRequest) => {
  try {
    const body = (await req.json()) as {
      session_id?: string | null;
      gesture_label?: string;
      rating?: FeedbackRow["rating"];
      comment?: string | null;
    };
    if (
      !body.gesture_label ||
      (body.rating !== "correct" && body.rating !== "incorrect")
    ) {
      return NextResponse.json(
        { error: "gesture_label and a valid rating are required" },
        { status: 400 }
      );
    }
    const row = await insertFeedback({
      user_id: null,
      session_id: body.session_id ?? null,
      gesture_label: body.gesture_label,
      rating: body.rating,
      comment: body.comment ?? null
    });
    return NextResponse.json({ feedback: row }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
};
