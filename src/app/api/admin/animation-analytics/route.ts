import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createSupabaseServerClient();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: gestures } = await supabase
      .from("gestures")
      .select("label, status");

    const { data: logs } = await supabase
      .from("translation_logs")
      .select("gesture_label, created_at")
      .gte("created_at", thirtyDaysAgo);

    const { data: sessions } = await supabase
      .from("translation_sessions")
      .select("id, created_at")
      .gte("created_at", thirtyDaysAgo);

    const { data: conversations } = await supabase
      .from("conversation_sessions")
      .select("total_messages, communication_success")
      .gte("created_at", thirtyDaysAgo);

    const { data: feedback } = await supabase
      .from("feedback")
      .select("gesture_label, rating")
      .gte("created_at", thirtyDaysAgo);

    const logList = logs ?? [];
    const gestureList = gestures ?? [];

    const gestureUsageCount: Record<string, number> = {};
    for (const l of logList) {
      gestureUsageCount[l.gesture_label] = (gestureUsageCount[l.gesture_label] ?? 0) + 1;
    }

    const topGestures = Object.entries(gestureUsageCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([label, count]) => ({ label, count }));

    const totalConversations = conversations?.length ?? 0;
    const totalMessages = conversations?.reduce((s, c) => s + (c.total_messages ?? 0), 0) ?? 0;
    const successfulConversations = conversations?.filter((c) => c.communication_success === true).length ?? 0;

    const feedbackList = feedback ?? [];
    const correctFeedback = feedbackList.filter((f) => f.rating === "correct").length;
    const incorrectFeedback = feedbackList.filter((f) => f.rating !== "correct").length;

    return NextResponse.json({
      totalGestures: gestureList.length,
      totalSessions: sessions?.length ?? 0,
      totalPredictions30d: logList.length,
      topGestures,
      conversations: {
        total: totalConversations,
        totalMessages,
        successRate: totalConversations > 0 ? successfulConversations / totalConversations : 0,
      },
      feedback: {
        total: feedbackList.length,
        correct: correctFeedback,
        incorrect: incorrectFeedback,
        accuracy: feedbackList.length > 0 ? correctFeedback / feedbackList.length : 0,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
}
