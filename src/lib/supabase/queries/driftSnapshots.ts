// Server-only queries for the drift_snapshots table.

import "server-only";
import { createSupabaseServiceClient } from "../service";
import type { DriftSnapshot } from "../types";

export const insertDriftSnapshot = async (input: {
  model_version: string;
  total_samples?: number;
  class_accuracy?: Record<string, number>;
  overall_accuracy?: number | null;
  drift_score?: number | null;
  distribution_shift?: Record<string, unknown> | null;
  low_confidence_rate?: number | null;
  unknown_rate?: number | null;
  notes?: string | null;
}): Promise<DriftSnapshot> => {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("drift_snapshots")
    .insert({
      model_version: input.model_version,
      total_samples: input.total_samples ?? 0,
      class_accuracy: input.class_accuracy ?? {},
      overall_accuracy: input.overall_accuracy ?? null,
      drift_score: input.drift_score ?? null,
      distribution_shift: input.distribution_shift ?? null,
      low_confidence_rate: input.low_confidence_rate ?? null,
      unknown_rate: input.unknown_rate ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`insertDriftSnapshot: ${error.message}`);
  return data;
};

export const listDriftSnapshots = async (
  opts: {
    limit?: number;
    modelVersion?: string;
    daysBack?: number;
  } = {},
): Promise<DriftSnapshot[]> => {
  const supabase = createSupabaseServiceClient();
  const limit = opts.limit ?? 30;
  let query = supabase
    .from("drift_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(limit);
  if (opts.modelVersion) query = query.eq("model_version", opts.modelVersion);
  if (opts.daysBack) {
    const since = new Date(Date.now() - opts.daysBack * 86400000)
      .toISOString()
      .slice(0, 10);
    query = query.gte("snapshot_date", since);
  }
  const { data, error } = await query;
  if (error) throw new Error(`listDriftSnapshots: ${error.message}`);
  return data ?? [];
};

export const getLatestDriftSnapshot = async (): Promise<DriftSnapshot | null> => {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("drift_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestDriftSnapshot: ${error.message}`);
  return data ?? null;
};
