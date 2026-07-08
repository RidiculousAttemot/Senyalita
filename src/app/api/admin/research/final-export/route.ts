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

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const supabase = await createSupabaseServerClient();

    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "csv";
    const daysBack = parseInt(url.searchParams.get("days") ?? "365", 10);
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    // Fetch all data
    const [
      { data: convSessions },
      { data: convMessages },
      { data: feedback },
      { data: corrections },
      { data: trainingSamples },
      { data: logs },
      { data: telemetry },
      { data: gestures },
      { data: difficultyData },
      { data: signerProfiles },
    ] = await Promise.all([
      supabase.from("conversation_sessions").select("id, user_id, started_at, ended_at, status, total_messages, communication_success").gte("created_at", since),
      supabase.from("conversation_messages").select("session_id, sender_type, gesture_label, translated_text, confidence, is_selected_reply, created_at").gte("created_at", since),
      supabase.from("feedback").select("user_id, gesture_label, rating, feedback_category, created_at").gte("created_at", since),
      (supabase.from("prediction_corrections") as any).select("*").gte("created_at", since),
      (supabase.from("training_samples") as any).select("*").gte("created_at", since),
      (supabase.from("translation_logs") as any).select("*").gte("created_at", since),
      (supabase.from("telemetry_events") as any).select("*").gte("created_at", since),
      supabase.from("gestures").select("label, status"),
      supabase.from("gesture_difficulty_tracking").select("*"),
      supabase.from("signer_profiles").select("*"),
    ]);

    const sessions = convSessions ?? [];
    const messages = convMessages ?? [];
    const feedbackList = feedback ?? [];
    const correctionsList = (corrections as any[]) ?? [];
    const trainingList = (trainingSamples as any[]) ?? [];
    const logList = (logs as any[]) ?? [];
    const telemetryList = (telemetry as any[]) ?? [];
    const gestureList = gestures ?? [];
    const difficultyList = (difficultyData as any[]) ?? [];
    const signerList = signerProfiles ?? [];

    // Compute metrics
    const totalConversations = sessions.length;
    const totalMessages = messages.length;
    const totalFeedback = feedbackList.length;
    const feedbackCorrect = feedbackList.filter((f) => f.rating === "correct").length;
    const feedbackAccuracy = totalFeedback > 0 ? feedbackCorrect / totalFeedback : 0;
    const totalCorrections = correctionsList.length;
    const totalTrainingSamples = trainingList.length;
    const totalRecognitions = logList.length;
    const avgConfidence = totalRecognitions > 0
      ? logList.reduce((s, l) => s + (l.confidence ?? 0), 0) / totalRecognitions
      : 0;
    const avgLatency = totalRecognitions > 0
      ? logList.reduce((s, l) => s + (l.inference_time_ms ?? 0), 0) / totalRecognitions
      : 0;

    const distinctUsers = new Set([
      ...sessions.map((s) => s.user_id),
      ...feedbackList.map((f) => f.user_id),
    ]).size;

    const successfulConversations = sessions.filter((s) => s.communication_success === true).length;
    const successRate = totalConversations > 0 ? successfulConversations / totalConversations : 0;

    const gestureRecognitionCounts: Record<string, number> = {};
    for (const l of logList) {
      const label = l.gesture_label ?? "unknown";
      gestureRecognitionCounts[label] = (gestureRecognitionCounts[label] ?? 0) + 1;
    }
    const gestureDistribution = Object.entries(gestureRecognitionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50)
      .map(([label, count]) => ({ label, count }));

    // Confusion matrix
    const confusionPairs: Record<string, { from: string; to: string; count: number }> = {};
    for (const c of correctionsList) {
      if (c.predicted_label && c.corrected_label && c.predicted_label !== c.corrected_label) {
        const key = `${c.predicted_label}->${c.corrected_label}`;
        if (!confusionPairs[key]) {
          confusionPairs[key] = { from: c.predicted_label, to: c.corrected_label, count: 0 };
        }
        confusionPairs[key].count++;
      }
    }
    const confusionMatrix = Object.values(confusionPairs).sort((a, b) => b.count - a.count).slice(0, 30);

    // Accessibility metrics
    const lowConfCount = logList.filter((l) => (l.confidence ?? 0) < 0.5).length;
    const highConfCount = logList.filter((l) => (l.confidence ?? 0) >= 0.7).length;
    const stallCount = sessions.filter((s) => (s.total_messages ?? 0) <= 2).length;

    const accessibilityMetrics = {
      totalSessions: sessions.length,
      avgConfidence,
      highConfRate: totalRecognitions > 0 ? highConfCount / totalRecognitions : 0,
      lowConfRate: totalRecognitions > 0 ? lowConfCount / totalRecognitions : 0,
      avgLatencyMs: avgLatency,
      conversationSuccessRate: successRate,
      stallRate: totalConversations > 0 ? stallCount / totalConversations : 0,
      feedbackAccuracy,
      distinctSigners: signerList.length,
      gestureCoverage: gestureList.length,
    };

    // Dataset growth
    const datasetGrowth = {
      totalSamples: totalTrainingSamples,
      totalCorrections,
      totalGestures: gestureList.length,
      totalRecognitions,
      totalConversations,
      totalFeedback,
    };

    if (format === "json") {
      return NextResponse.json({
        exportDate: new Date().toISOString(),
        format: "research-export-v2",
        description: "Comprehensive research dataset — no PII included",
        dateRange: { from: since, to: new Date().toISOString() },
        summary: {
          totalConversations,
          totalMessages,
          totalFeedback,
          feedbackAccuracy,
          totalCorrections,
          totalTrainingSamples,
          totalRecognitions,
          avgConfidence,
          avgLatency,
          distinctUsers,
          successRate,
        },
        recognitionStats: {
          totalLogs: totalRecognitions,
          avgConfidence,
          avgLatencyMs: avgLatency,
          gestureDistribution,
          lowConfidenceRate: totalRecognitions > 0 ? lowConfCount / totalRecognitions : 0,
          highConfidenceRate: totalRecognitions > 0 ? highConfCount / totalRecognitions : 0,
        },
        translationStats: {
          totalGestures: gestureList.length,
          gestureStatusBreakdown: Object.entries(
            gestureList.reduce<Record<string, number>>((acc, g) => {
              acc[g.status ?? "unknown"] = (acc[g.status ?? "unknown"] ?? 0) + 1;
              return acc;
            }, {})
          ).map(([status, count]) => ({ status, count })),
        },
        conversationStats: {
          totalSessions: sessions.length,
          totalMessages,
          successRate,
          avgMessagesPerConversation: totalConversations > 0 ? totalMessages / totalConversations : 0,
        },
        animationStats: {
          // Placeholder — animation tracking happens client-side
          trackedAnimations: 0,
          note: "Animation tracking data is stored client-side and not available server-side",
        },
        accessibilityMetrics,
        datasetGrowth,
        confusionMatrix,
        feedback: feedbackList.map((f) => ({
          gesture: f.gesture_label,
          rating: f.rating,
          category: f.feedback_category,
          date: f.created_at,
        })),
      });
    }

    // CSV format (default)
    const filename = `research-package-v2-${dateStr}.csv`;
    let csv = "";

    csv += "=== SUMMARY METRICS ===\n";
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
    csv += csvLine(["Distinct Users", distinctUsers]);
    csv += csvLine(["Success Rate", successRate.toFixed(4)]);
    csv += csvLine(["Total Gestures", gestureList.length]);
    csv += "\n";

    csv += "=== ACCESSIBILITY METRICS ===\n";
    csv += csvLine(["metric", "value"]);
    for (const [key, value] of Object.entries(accessibilityMetrics)) {
      csv += csvLine([key, typeof value === "number" ? value.toFixed(4) : String(value)]);
    }
    csv += "\n";

    csv += "=== DATASET GROWTH ===\n";
    csv += csvLine(["metric", "value"]);
    for (const [key, value] of Object.entries(datasetGrowth)) {
      csv += csvLine([key, value]);
    }
    csv += "\n";

    csv += "=== CONFUSION MATRIX ===\n";
    csv += csvLine(["from_label", "to_label", "count"]);
    for (const pair of confusionMatrix) {
      csv += csvLine([pair.from, pair.to, pair.count]);
    }
    csv += "\n";

    csv += "=== GESTURE DISTRIBUTION ===\n";
    csv += csvLine(["gesture_label", "recognition_count"]);
    for (const g of gestureDistribution) {
      csv += csvLine([g.label, g.count]);
    }
    csv += "\n";

    csv += "=== CONVERSATIONS ===\n";
    csv += csvLine(["session_id", "user_id", "started_at", "ended_at", "status", "messages", "success"]);
    for (const r of sessions) {
      csv += csvLine([r.id, r.user_id, r.started_at, r.ended_at, r.status, r.total_messages, r.communication_success]);
    }
    csv += "\n";

    csv += "=== MESSAGES ===\n";
    csv += csvLine(["session_id", "sender_type", "gesture_label", "text", "confidence", "is_selected_reply", "created_at"]);
    for (const r of messages) {
      csv += csvLine([r.session_id, r.sender_type, r.gesture_label, r.translated_text, r.confidence, r.is_selected_reply, r.created_at]);
    }
    csv += "\n";

    csv += "=== FEEDBACK ===\n";
    csv += csvLine(["user_id", "gesture_label", "rating", "category", "created_at"]);
    for (const r of feedbackList) {
      csv += csvLine([r.user_id, r.gesture_label, r.rating, r.feedback_category, r.created_at]);
    }
    csv += "\n";

    csv += "=== CORRECTIONS ===\n";
    csv += csvLine(["predicted_label", "corrected_label", "confidence", "source", "created_at"]);
    for (const r of correctionsList) {
      csv += csvLine([r.predicted_label, r.corrected_label, r.confidence, r.source, r.created_at]);
    }
    csv += "\n";

    csv += "=== TRAINING SAMPLES ===\n";
    csv += csvLine(["original_prediction", "corrected_label", "source", "approved_at"]);
    for (const r of trainingList) {
      csv += csvLine([r.original_prediction, r.corrected_label, r.source, r.approved_at]);
    }
    csv += "\n";

    csv += "=== RECOGNITIONS ===\n";
    csv += csvLine(["gesture_label", "confidence", "latency_ms", "source", "created_at"]);
    for (const r of logList) {
      csv += csvLine([r.gesture_label, r.confidence, r.inference_time_ms, r.recognition_source, r.created_at]);
    }

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
