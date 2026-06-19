// Queries for the feedback and model_metrics_daily tables.

import "server-only";
import { createSupabaseServerClient } from "../server";
import type { FeedbackRow, ModelMetricsDailyRow } from "../types";

export const insertFeedback = async (input: {
  user_id: string | null;
  session_id?: string | null;
  gesture_label: string;
  rating: FeedbackRow["rating"];
  comment?: string | null;
}): Promise<FeedbackRow> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("feedback")
    .insert({
      user_id: input.user_id as string,
      session_id: input.session_id ?? null,
      gesture_label: input.gesture_label,
      rating: input.rating,
      comment: input.comment ?? null
    })
    .select()
    .single();
  if (error) throw new Error(`insertFeedback: ${error.message}`);
  return data;
};

export const listOwnFeedback = async (limit = 50): Promise<FeedbackRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listOwnFeedback: ${error.message}`);
  return data ?? [];
};

export const listAllFeedback = async (limit = 200): Promise<FeedbackRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listAllFeedback: ${error.message}`);
  return data ?? [];
};

export const listModelMetricsDaily = async (
  daysBack = 30
): Promise<ModelMetricsDailyRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("model_metrics_daily")
    .select("day, total_predictions, low_confidence_count, unknown_count, avg_confidence, avg_inference_ms, failure_rate")
    .gte("day", new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .order("day", { ascending: true });
  if (error) throw new Error(`listModelMetricsDaily: ${error.message}`);
  return (data ?? []) as ModelMetricsDailyRow[];
};
