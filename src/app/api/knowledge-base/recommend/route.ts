import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const label = url.searchParams.get("label");
  const userId = url.searchParams.get("userId");

  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: knowledge } = await supabase
    .from("gesture_knowledge_base")
    .select("*")
    .eq("label", label)
    .single();

  if (!knowledge) {
    const fallback = { related: ["HELLO", "THANK YOU", "YES", "NO", "PLEASE"], difficulty: 3 };
    return NextResponse.json(fallback);
  }

  const { data: confusion } = await supabase
    .from("gesture_confusion_pairs")
    .select("*")
    .eq("gesture_label", label)
    .order("count", { ascending: false });

  const topConfusions = (confusion ?? []).slice(0, 5).map((c) => ({
    label: c.confused_with,
    count: c.count,
  }));

  return NextResponse.json({
    display_name: knowledge.display_name,
    description: knowledge.description,
    usage_explanation: knowledge.usage_explanation,
    difficulty_level: knowledge.difficulty_level,
    frequency_of_use: knowledge.frequency_of_use,
    common_mistakes: knowledge.common_mistakes,
    related_gestures: knowledge.related_gestures ?? [],
    suggested_replies: knowledge.suggested_replies ?? [],
    reference_video_url: knowledge.reference_video_url,
    top_confusions: topConfusions,
  });
}
