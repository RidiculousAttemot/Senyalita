import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvField(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvLine(values: unknown[]): string {
  return values.map(csvField).join(",") + "\n";
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createSupabaseServerClient();

    const { data: convSessions } = await supabase
      .from("conversation_sessions")
      .select("id, user_id, started_at, ended_at, status, total_messages, communication_success");

    const { data: convMessages } = await supabase
      .from("conversation_messages")
      .select("session_id, sender_type, gesture_label, translated_text, confidence, is_selected_reply, created_at");

    const { data: feedback } = await supabase
      .from("feedback")
      .select("user_id, gesture_label, rating, feedback_category, created_at");

    const { data: corrections } = await (supabase
      .from("prediction_corrections") as any)
      .select("predicted_label, corrected_label, confidence, source, created_at");

    const { data: trainingSamples } = await (supabase
      .from("training_samples") as any)
      .select("original_prediction, corrected_label, confidence, source, approved_at");

    const { data: logs } = await (supabase
      .from("translation_logs") as any)
      .select("gesture_label, confidence, inference_time_ms, recognition_source, created_at");

    const sessions = convSessions ?? [];
    const messages = convMessages ?? [];
    const feedbackList = feedback ?? [];
    const correctionsList = (corrections as any[]) ?? [];
    const trainingList = (trainingSamples as any[]) ?? [];
    const logList = (logs as any[]) ?? [];
    const achievementList: any[] = [];

    const totalConversations = sessions.length;
    const totalMessages = messages.length;
    const totalFeedback = feedbackList.length;
    const feedbackCorrect = feedbackList.filter((f) => f.rating === "correct").length;
    const feedbackAccuracy = totalFeedback > 0 ? feedbackCorrect / totalFeedback : 0;
    const totalCorrections = correctionsList.length;
    const totalTrainingSamples = trainingList.length;
    const totalRecognitions = logList.length;
    const avgConfidence = totalRecognitions > 0
      ? logList.reduce((s: number, l: any) => s + (l.confidence ?? 0), 0) / totalRecognitions
      : 0;
    const avgLatency = totalRecognitions > 0
      ? logList.reduce((s: number, l: any) => s + (l.inference_time_ms ?? 0), 0) / totalRecognitions
      : 0;
    const totalAchievements = achievementList.length;
    const distinctUsers = new Set([
      ...sessions.map((s) => s.user_id),
      ...feedbackList.map((f) => f.user_id),
      ...achievementList.map((a) => a.user_id),
    ]).size;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `thesis-research-package-${dateStr}.csv`;
    let csv = "";

    csv += "=== CONVERSATIONS ===\n";
    csv += csvLine(["session_id", "user_id", "started_at", "ended_at", "status", "messages", "success"]);
    for (const r of sessions) {
      csv += csvLine([r.id, r.user_id, r.started_at, r.ended_at, r.status, r.total_messages, r.communication_success]);
    }

    csv += "\n=== MESSAGES ===\n";
    csv += csvLine(["session_id", "sender_type", "gesture_label", "text", "confidence", "is_selected_reply", "created_at"]);
    for (const r of messages) {
      csv += csvLine([r.session_id, r.sender_type, r.gesture_label, r.translated_text, r.confidence, r.is_selected_reply, r.created_at]);
    }

    csv += "\n=== FEEDBACK ===\n";
    csv += csvLine(["user_id", "gesture_label", "rating", "category", "created_at"]);
    for (const r of feedbackList) {
      csv += csvLine([r.user_id, r.gesture_label, r.rating, r.feedback_category, r.created_at]);
    }

    csv += "\n=== CORRECTIONS ===\n";
    csv += csvLine(["predicted_label", "corrected_label", "confidence", "source", "created_at"]);
    for (const r of correctionsList) {
      csv += csvLine([r.predicted_label, r.corrected_label, r.confidence, r.source, r.created_at]);
    }

    csv += "\n=== TRAINING SAMPLES ===\n";
    csv += csvLine(["original", "prediction", "corrected_label", "source", "approved_at"]);
    for (const r of trainingList) {
      csv += csvLine([r.original_prediction, r.original_prediction, r.corrected_label, r.source, r.approved_at]);
    }

    csv += "\n=== RECOGNITIONS ===\n";
    csv += csvLine(["gesture_label", "confidence", "latency_ms", "source", "created_at"]);
    for (const r of logList) {
      csv += csvLine([r.gesture_label, r.confidence, r.inference_time_ms, r.recognition_source, r.created_at]);
    }

    csv += "\n=== ACHIEVEMENTS ===\n";
    csv += csvLine(["user_id", "achievement_key", "title", "category", "unlocked_at"]);
    for (const r of achievementList) {
      csv += csvLine([r.user_id, r.achievement_key, r.title, r.category, r.unlocked_at]);
    }

    csv += "\n=== SUMMARY METRICS ===\n";
    csv += csvLine(["metric", "value"]);
    csv += csvLine(["Total Conversations", totalConversations]);
    csv += csvLine(["Total Messages", totalMessages]);
    csv += csvLine(["Total Feedback", totalFeedback]);
    csv += csvLine(["Feedback Accuracy Rate", feedbackAccuracy.toFixed(4)]);
    csv += csvLine(["Total Corrections", totalCorrections]);
    csv += csvLine(["Total Training Samples", totalTrainingSamples]);
    csv += csvLine(["Total Recognitions", totalRecognitions]);
    csv += csvLine(["Avg Confidence", avgConfidence.toFixed(4)]);
    csv += csvLine(["Avg Latency (ms)", avgLatency.toFixed(2)]);
    csv += csvLine(["Total Achievements Unlocked", totalAchievements]);
    csv += csvLine(["Total Users (distinct)", distinctUsers]);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
}
