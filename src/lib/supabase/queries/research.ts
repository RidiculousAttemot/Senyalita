import "server-only";
import { createSupabaseServerClient } from "../server";

type ResearchExportData = {
  exportDate: string;
  anonymizedLandmarkCount: number;
  anonymizedCorrectionCount: number;
  totalLogs: number;
  conversationCount: number;
  stats: {
    totalRecognitions: number;
    avgConfidence: number;
    totalSessions: number;
    totalConversations: number;
    gestureDistribution: Array<{ label: string; count: number }>;
  };
};

export const buildResearchDataset = async (
  daysBack = 365
): Promise<ResearchExportData> => {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  const { data: logs } = await supabase
    .from("translation_logs")
    .select("gesture_label, confidence, created_at")
    .gte("created_at", since);

  const { data: reviewItems } = await supabase
    .from("review_queue")
    .select("gesture_label, confidence, original_prediction, corrected_label, status, created_at")
    .gte("created_at", since);

  const { data: convSessions } = await supabase
    .from("conversation_sessions")
    .select("id, started_at, total_messages, communication_success, created_at")
    .gte("created_at", since);

  const logList = logs ?? [];
  const totalLogs = logList.length;
  const avgConfidence = totalLogs > 0
    ? logList.reduce((s, l) => s + (l.confidence ?? 0), 0) / totalLogs
    : 0;

  const gestureCounts: Record<string, number> = {};
  logList.forEach((l) => {
    if (l.gesture_label) gestureCounts[l.gesture_label] = (gestureCounts[l.gesture_label] ?? 0) + 1;
  });
  const gestureDistribution = Object.entries(gestureCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 50)
    .map(([label, count]) => ({ label, count }));

  return {
    exportDate: new Date().toISOString(),
    anonymizedLandmarkCount: (reviewItems ?? []).length,
    anonymizedCorrectionCount: (reviewItems ?? []).filter((r) => r.corrected_label).length,
    totalLogs,
    conversationCount: convSessions?.length ?? 0,
    stats: {
      totalRecognitions: totalLogs,
      avgConfidence,
      totalSessions: totalLogs,
      totalConversations: convSessions?.length ?? 0,
      gestureDistribution,
    },
  };
};

export const generateResearchExportJson = async (
  daysBack = 365
): Promise<object> => {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  const { data: logs } = await supabase
    .from("translation_logs")
    .select("gesture_label, confidence, inference_time_ms, created_at")
    .gte("created_at", since)
    .limit(10000);

  const { data: reviewItems } = await supabase
    .from("review_queue")
    .select("gesture_label, confidence, source, original_prediction, corrected_label, status, created_at")
    .gte("created_at", since);

  const { data: convSessions } = await supabase
    .from("conversation_sessions")
    .select("started_at, total_messages, communication_success, created_at")
    .gte("created_at", since);

  const { data: feedback } = await supabase
    .from("feedback")
    .select("gesture_label, rating, comment, created_at")
    .gte("created_at", since);

  return {
    exportDate: new Date().toISOString(),
    datasetType: "research_export",
    description: "Anonymized research dataset — no personal identifiable information included",
    metadata: {
      totalLogs: logs?.length ?? 0,
      totalReviewItems: reviewItems?.length ?? 0,
      totalConversations: convSessions?.length ?? 0,
      totalFeedback: feedback?.length ?? 0,
      dateRange: { from: since, to: new Date().toISOString() },
    },
    recognitionLogs: logs,
    corrections: reviewItems,
    conversations: convSessions,
    feedback,
  };
};
