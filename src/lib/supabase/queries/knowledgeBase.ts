import "server-only";
import { createSupabaseServerClient } from "../server";
import type { GestureKnowledgeBase, GestureConfusionPair } from "../types";

export const listKnowledgeBase = async (): Promise<GestureKnowledgeBase[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("gesture_knowledge_base").select("*").order("label");
  if (error) throw new Error(`listKnowledgeBase: ${error.message}`);
  return data ?? [];
};

export const getKnowledgeBaseEntry = async (label: string): Promise<GestureKnowledgeBase | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("gesture_knowledge_base").select("*").eq("label", label).single();
  if (error && error.code !== "PGRST116") throw new Error(`getKnowledgeBaseEntry: ${error.message}`);
  return data;
};

export const upsertKnowledgeBaseEntry = async (input: {
  label: string;
  display_name?: string;
  category?: "alphabet" | "phrase";
  description?: string | null;
  usage_explanation?: string | null;
  reference_video_url?: string | null;
  difficulty_level?: number;
  frequency_of_use?: number;
  common_mistakes?: string | null;
  related_gestures?: string[];
  suggested_replies?: string[];
}): Promise<GestureKnowledgeBase> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("gesture_knowledge_base").upsert(input as any).select().single();
  if (error) throw new Error(`upsertKnowledgeBaseEntry: ${error.message}`);
  return data;
};

export const getConfidenceAnalytics = async (daysBack = 30) => {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();
  const { data: logs } = await supabase.from("translation_logs").select("*").gte("created_at", since);
  const { data: pairs } = await supabase.from("gesture_confusion_pairs").select("*");

  const logList = logs ?? [];
  const gestMap: Record<string, { count: number; totalConf: number; confs: number[] }> = {};

  logList.forEach((l) => {
    if (!gestMap[l.gesture_label]) gestMap[l.gesture_label] = { count: 0, totalConf: 0, confs: [] };
    gestMap[l.gesture_label].count++;
    gestMap[l.gesture_label].totalConf += l.confidence ?? 0;
    gestMap[l.gesture_label].confs.push(l.confidence ?? 0);
  });

  const gestures = Object.entries(gestMap).map(([label, data]) => ({
    label,
    count: data.count,
    avgConfidence: data.count > 0 ? data.totalConf / data.count : 0,
    confidenceDistribution: {
      high: data.confs.filter((c) => c >= 0.7).length,
      medium: data.confs.filter((c) => c >= 0.5 && c < 0.7).length,
      low: data.confs.filter((c) => c < 0.5).length,
    },
  }));

  const sortedByConf = [...gestures].sort((a, b) => b.avgConfidence - a.avgConfidence);
  const highest = sortedByConf.slice(0, 10);
  const lowest = sortedByConf.filter((g) => g.count >= 3).reverse().slice(0, 10);

  return { total: gestures.length, highest, lowest, confusionPairs: pairs ?? [], allGestures: gestures };
};

export const getDatasetQuality = async () => {
  const supabase = await createSupabaseServerClient();
  const { data: gestures } = await supabase.from("gestures").select("label, status");
  const { data: captures } = await supabase.from("gesture_captures").select("label, status");
  const { data: review } = await supabase.from("review_queue").select("id, status");

  const captureMap: Record<string, { approved: number; rejected: number; pending: number }> = {};
  (captures ?? []).forEach((c) => {
    if (!captureMap[c.label]) captureMap[c.label] = { approved: 0, rejected: 0, pending: 0 };
    if (c.status === "approved") captureMap[c.label].approved++;
    else if (c.status === "rejected") captureMap[c.label].rejected++;
    else captureMap[c.label].pending++;
  });

  const gestureList = (gestures ?? []).map((g) => ({
    label: g.label,
    samples: captureMap[g.label]?.approved ?? 0,
    approved: captureMap[g.label]?.approved ?? 0,
    rejected: captureMap[g.label]?.rejected ?? 0,
    pending: captureMap[g.label]?.pending ?? 0,
    status: g.status,
  }));

  const belowThreshold = gestureList.filter((g) => g.samples < 10);
  const missing = gestureList.filter((g) => g.samples === 0);

  return {
    totalGestures: gestureList.length,
    totalCaptures: captures?.length ?? 0,
    pendingReview: (review ?? []).filter((r) => r.status === "pending").length,
    approvedCaptures: (captures ?? []).filter((c) => c.status === "approved").length,
    gestureList,
    belowThreshold,
    belowThresholdCount: belowThreshold.length,
    missingCount: missing.length,
    missingGestures: missing.map((g) => g.label),
    classImbalance: gestureList.sort((a, b) => a.samples - b.samples).slice(0, 10),
  };
};

export const getFeedbackInsights = async (daysBack = 30) => {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();
  const { data: feedback } = await supabase.from("feedback").select("*").gte("created_at", since);
  const { data: logs } = await supabase.from("translation_logs").select("*").gte("created_at", since);

  const fbList = feedback ?? [];
  const incorrect = fbList.filter((f) => f.rating === "incorrect");
  const correct = fbList.filter((f) => f.rating === "correct");

  const gestureFailCount: Record<string, number> = {};
  incorrect.forEach((f) => { gestureFailCount[f.gesture_label] = (gestureFailCount[f.gesture_label] ?? 0) + 1; });
  const misunderstood = Object.entries(gestureFailCount).sort(([, a], [, b]) => b - a).slice(0, 15).map(([label, count]) => ({ label, count }));

  const recentComments = fbList.filter((f) => f.comment).map((f) => ({ gesture: f.gesture_label, rating: f.rating, comment: f.comment! })).slice(0, 20);

  return {
    totalFeedback: fbList.length,
    correctCount: correct.length,
    incorrectCount: incorrect.length,
    accuracyRate: fbList.length > 0 ? correct.length / fbList.length : 0,
    misunderstood,
    recentComments,
  };
};

// Removed: getUserAnalytics, upsertUserAnalytics, upsertLearningProgress
// These used the user_analytics and user_learning_progress tables
// which were removed in Phase 27 for privacy-first anonymous access.

export const getRecommendedGestures = async (difficultLabel: string): Promise<string[]> => {
  const supabase = await createSupabaseServerClient();
  const { data: kb } = await supabase.from("gesture_knowledge_base").select("*").eq("label", difficultLabel).single();
  if (kb?.related_gestures?.length) return kb.related_gestures;
  return ["HELLO", "THANK YOU", "YES", "NO", "PLEASE"];
};

export const getExecutiveMetrics = async (daysBack = 30) => {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  const { data: logs } = await supabase.from("translation_logs").select("*").gte("created_at", since);
  const { data: sessions } = await supabase.from("conversation_sessions").select("*").gte("created_at", since);
  const { data: feedback } = await supabase.from("feedback").select("*").gte("created_at", since);
  const { data: telemetry } = await supabase.from("telemetry_events").select("*").gte("created_at", since);

  const logList = logs ?? [];
  const sessList = sessions ?? [];
  const fbList = feedback ?? [];
  const telList = telemetry ?? [];

  const avgLatency = logList.length > 0 ? logList.reduce((s, l) => s + (l.inference_time_ms ?? 0), 0) / logList.length : 0;
  const modelFailures = telList.filter((t) => t.event_type === "recognition_failure").length;
  const convSuccess = sessList.filter((s) => s.communication_success === true).length;
  const convTotal = sessList.filter((s) => s.status === "ended").length;
  const aiReplyEvents = telList.filter((t) => t.event_type === "ai_reply_used").length;

  const gestureFreq: Record<string, number> = {};
  logList.forEach((l) => { gestureFreq[l.gesture_label] = (gestureFreq[l.gesture_label] ?? 0) + 1; });
  const topGestures = Object.entries(gestureFreq).sort(([, a], [, b]) => b - a).slice(0, 10).map(([label, count]) => ({ label, count }));

  const uniqueUsers = new Set(logList.map((l) => l.user_id).filter(Boolean)).size;
  const retentionRate = logList.length > 0 && daysBack > 7 ? logList.filter((l) => new Date(l.created_at) > new Date(Date.now() - 7 * 86400000)).length / logList.length : 0;

  return {
    totalRecognitions: logList.length,
    avgLatencyMs: avgLatency,
    modelFailures,
    conversationSuccessRate: convTotal > 0 ? convSuccess / convTotal : 0,
    aiReplyAcceptanceRate: aiReplyEvents > 0 && logList.length > 0 ? Math.min(logList.filter((l) => l.selected_reply).length / aiReplyEvents, 1) : 0,
    feedbackAccuracy: fbList.length > 0 ? fbList.filter((f) => f.rating === "correct").length / fbList.length : 0,
    topGestures,
    uniqueUsers,
    retentionRate,
    totalConversations: sessList.length,
    totalFeedback: fbList.length,
  };
};
