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
  limit = 100
): Promise<TelemetryEvent[]> => {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("telemetry_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (eventType) query = query.eq("event_type", eventType);
  const { data, error } = await query;
  if (error) throw new Error(`listTelemetryEvents: ${error.message}`);
  return data ?? [];
};

export const getTelemetrySummary = async (
  daysBack = 30
): Promise<{
  recognitionSuccess: number;
  recognitionFailure: number;
  lowConfidence: number;
  aiReplyUsed: number;
  conversationCompleted: number;
  sessionAbandoned: number;
  topGestures: Array<{ gesture_label: string; count: number }>;
  topReplies: Array<{ gesture_label: string; count: number }>;
}> => {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  const { data: events } = await supabase
    .from("telemetry_events")
    .select("*")
    .gte("created_at", since);

  const list = events ?? [];
  const recognitionSuccess = list.filter((e) => e.event_type === "recognition_success").length;
  const recognitionFailure = list.filter((e) => e.event_type === "recognition_failure").length;
  const lowConfidence = list.filter((e) => e.event_type === "low_confidence").length;
  const aiReplyUsed = list.filter((e) => e.event_type === "ai_reply_used").length;
  const conversationCompleted = list.filter((e) => e.event_type === "conversation_completed").length;
  const sessionAbandoned = list.filter((e) => e.event_type === "session_abandoned").length;

  const gestureCounts: Record<string, number> = {};
  list.filter((e) => e.event_type === "gesture_used" && e.gesture_label).forEach((e) => {
    const label = e.gesture_label!;
    gestureCounts[label] = (gestureCounts[label] ?? 0) + 1;
  });
  const topGestures = Object.entries(gestureCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([gesture_label, count]) => ({ gesture_label, count }));

  const replyCounts: Record<string, number> = {};
  list.filter((e) => e.event_type === "reply_used" && e.gesture_label).forEach((e) => {
    const label = e.gesture_label!;
    replyCounts[label] = (replyCounts[label] ?? 0) + 1;
  });
  const topReplies = Object.entries(replyCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([gesture_label, count]) => ({ gesture_label, count }));

  return { recognitionSuccess, recognitionFailure, lowConfidence, aiReplyUsed, conversationCompleted, sessionAbandoned, topGestures, topReplies };
};

export const listReviewQueue = async (
  status?: ReviewQueueItem["status"],
  limit = 50
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
  }
): Promise<void> => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("review_queue")
    .update({ ...updates, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`updateReviewQueueItem: ${error.message}`);
};
