// Server-only analytics query. Wraps the SQL function get_admin_analytics().

import "server-only";
import { isOptionalRelationUnavailable } from "@/lib/admin/dashboard";
import { createSupabaseServerClient } from "../server";
import type { AdminAnalytics, ModelMetricsDailyRow } from "../types";

export const fetchAdminAnalytics = async (daysBack = 30): Promise<AdminAnalytics> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_admin_analytics", { p_days_back: daysBack });
  if (error) throw new Error(`fetchAdminAnalytics: ${error.message}`);
  return data;
};

export const fetchModelMetricsDaily = async (daysBack = 30): Promise<ModelMetricsDailyRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_model_metrics_daily", { p_days_back: daysBack });
  if (error && isOptionalRelationUnavailable(error, "model_metrics_daily")) return [];
  if (error) throw new Error(`fetchModelMetricsDaily: ${error.message}`);
  return (data ?? []) as ModelMetricsDailyRow[];
};
