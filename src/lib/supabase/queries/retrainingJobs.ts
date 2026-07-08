// Server-only queries for the retraining_jobs table.

import "server-only";
import { createSupabaseServiceClient } from "../service";
import type { RetrainingJob } from "../types";

export const createRetrainingJob = async (input: {
  trigger_reason: string;
  dataset_version_id?: string | null;
  model_version_id?: string | null;
  accuracy_before?: number | null;
  created_by?: string | null;
}): Promise<RetrainingJob> => {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("retraining_jobs")
    .insert({
      trigger_reason: input.trigger_reason,
      dataset_version_id: input.dataset_version_id ?? null,
      model_version_id: input.model_version_id ?? null,
      accuracy_before: input.accuracy_before ?? null,
      created_by: input.created_by ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`createRetrainingJob: ${error.message}`);
  return data;
};

export const updateRetrainingJob = async (
  id: string,
  updates: {
    status?: RetrainingJob["status"];
    accuracy_after?: number | null;
    started_at?: string | null;
    completed_at?: string | null;
    error_message?: string | null;
    metrics_snapshot?: Record<string, unknown> | null;
    model_version_id?: string | null;
  },
): Promise<RetrainingJob> => {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("retraining_jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateRetrainingJob: ${error.message}`);
  return data;
};

export const listRetrainingJobs = async (
  opts: {
    limit?: number;
    status?: RetrainingJob["status"];
  } = {},
): Promise<RetrainingJob[]> => {
  const supabase = createSupabaseServiceClient();
  const limit = opts.limit ?? 20;
  let query = supabase
    .from("retraining_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw new Error(`listRetrainingJobs: ${error.message}`);
  return data ?? [];
};

export const getRetrainingJobById = async (
  id: string,
): Promise<RetrainingJob | null> => {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("retraining_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getRetrainingJobById: ${error.message}`);
  return data ?? null;
};

export const getLatestRetrainingJob = async (): Promise<RetrainingJob | null> => {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("retraining_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestRetrainingJob: ${error.message}`);
  return data ?? null;
};
