import "server-only";
import { createSupabaseServerClient } from "../server";
import type { TelemetryEvent, ReviewQueueItem } from "../types";

export const insertTelemetryEvent = async (input: {
  event_type: TelemetryEvent["event_type"];
  event_data?: Record<string, unknown>;
  user_id?: string | null;
  session_id?: string | null;
  gesture_label?: string | null;
  confidence?: number | null;
}): Promise<void> => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("telemetry_events").insert(input);
  if (error) console.error("insertTelemetryEvent:", error.message);
};

export const listTelemetryEvents = async (
  eventType?: TelemetryEvent["event_type"],
  limit = 100,
  daysBack?: number,
): Promise<TelemetryEvent[]> => {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("telemetry_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (eventType) query = query.eq("event_type", eventType);
  if (daysBack !== undefined) {
    query = query.gte("created_at", new Date(Date.now() - daysBack * 86400000).toISOString());
  }
  const { data, error } = await query;
  if (error) throw new Error(`listTelemetryEvents: ${error.message}`);
  return data ?? [];
};

export const getTelemetrySummary = async (
  daysBack = 30,
): Promise<{
  recognitionSuccess: number;
  recognitionFailure: number;
  lowConfidence: number;
  aiReplyUsed: number;
  conversationCompleted: number;
  sessionAbandoned: number;
  topGestures: Array<{ gesture_label: string; count: number }>;
  topReplies: Array<{ gesture_label: string; count: number }>;
  translationsStarted: number;
  translationsCompleted: number;
  translationsFailed: number;
  modelLoaded: number;
  modelPredictions: number;
  adminLogins: number;
  retrainingStarted: number;
  retrainingCompleted: number;
}> => {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  const { data: events } = await supabase
    .from("telemetry_events")
    .select("*")
    .gte("created_at", since);

  const list = events ?? [];
  const countByType = (type: string) =>
    list.filter((e) => e.event_type === type).length;

  const recognitionSuccess = countByType("recognition_success");
  const recognitionFailure = countByType("recognition_failure");
  const lowConfidence = countByType("low_confidence");
  const aiReplyUsed = countByType("ai_reply_used");
  const conversationCompleted = countByType("conversation_completed");
  const sessionAbandoned = countByType("session_abandoned");
  const translationsStarted = countByType("translation_started");
  const translationsCompleted = countByType("translation_completed");
  const translationsFailed = countByType("translation_failed");
  const modelLoaded = countByType("model_loaded");
  const modelPredictions = countByType("model_prediction");
  const adminLogins = countByType("admin_login");
  const retrainingStarted = countByType("retraining_started");
  const retrainingCompleted = countByType("retraining_completed");

  const gestureCounts: Record<string, number> = {};
  list
    .filter((e) => e.event_type === "gesture_used" && e.gesture_label)
    .forEach((e) => {
      const label = e.gesture_label!;
      gestureCounts[label] = (gestureCounts[label] ?? 0) + 1;
    });
  const topGestures = Object.entries(gestureCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([gesture_label, count]) => ({ gesture_label, count }));

  const replyCounts: Record<string, number> = {};
  list
    .filter((e) => e.event_type === "reply_used" && e.gesture_label)
    .forEach((e) => {
      const label = e.gesture_label!;
      replyCounts[label] = (replyCounts[label] ?? 0) + 1;
    });
  const topReplies = Object.entries(replyCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([gesture_label, count]) => ({ gesture_label, count }));

  return {
    recognitionSuccess,
    recognitionFailure,
    lowConfidence,
    aiReplyUsed,
    conversationCompleted,
    sessionAbandoned,
    topGestures,
    topReplies,
    translationsStarted,
    translationsCompleted,
    translationsFailed,
    modelLoaded,
    modelPredictions,
    adminLogins,
    retrainingStarted,
    retrainingCompleted,
  };
};

export const listReviewQueue = async (
  status?: ReviewQueueItem["status"],
  limit = 50,
): Promise<ReviewQueueItem[]> => {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("review_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`listReviewQueue: ${error.message}`);
  return data ?? [];
};

export const updateReviewQueueItem = async (
  id: string,
  updates: {
    status?: ReviewQueueItem["status"];
    corrected_label?: string | null;
    reviewed_by?: string;
    review_notes?: string | null;
  },
): Promise<void> => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("review_queue")
    .update({ ...updates, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`updateReviewQueueItem: ${error.message}`);
};

export const countTelemetryByType = async (
  eventType: TelemetryEvent["event_type"],
  daysBack = 30,
): Promise<number> => {
  try {
    const supabase = await createSupabaseServerClient();
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();
    const { count, error } = await supabase
      .from("telemetry_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", eventType)
      .gte("created_at", since);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
};
