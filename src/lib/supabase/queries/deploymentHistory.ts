// Server-only queries for the deployment_history table.

import "server-only";
import { createSupabaseServiceClient } from "../service";
import type { DeploymentHistory } from "../types";

export const createDeployment = async (input: {
  model_version_id: string;
  environment: DeploymentHistory["environment"];
  status?: DeploymentHistory["status"];
  deployed_by?: string | null;
  notes?: string | null;
}): Promise<DeploymentHistory> => {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("deployment_history")
    .insert({
      model_version_id: input.model_version_id,
      environment: input.environment,
      status: input.status ?? "pending",
      deployed_by: input.deployed_by ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`createDeployment: ${error.message}`);
  return data;
};

export const updateDeploymentStatus = async (
  id: string,
  updates: {
    status?: DeploymentHistory["status"];
    deployed_at?: string | null;
    rollback_at?: string | null;
    rollback_reason?: string | null;
    validation_status?: string | null;
    notes?: string | null;
  },
): Promise<DeploymentHistory> => {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("deployment_history")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateDeploymentStatus: ${error.message}`);
  return data;
};

export const listDeployments = async (
  opts: {
    limit?: number;
    environment?: DeploymentHistory["environment"];
    status?: DeploymentHistory["status"];
    modelVersionId?: string;
  } = {},
): Promise<DeploymentHistory[]> => {
  const supabase = createSupabaseServiceClient();
  const limit = opts.limit ?? 20;
  let query = supabase
    .from("deployment_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.environment) query = query.eq("environment", opts.environment);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.modelVersionId) query = query.eq("model_version_id", opts.modelVersionId);
  const { data, error } = await query;
  if (error) throw new Error(`listDeployments: ${error.message}`);
  return data ?? [];
};

export const getActiveDeployment = async (
  environment: DeploymentHistory["environment"],
): Promise<DeploymentHistory | null> => {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("deployment_history")
    .select("*")
    .eq("environment", environment)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`getActiveDeployment: ${error.message}`);
  return data ?? null;
};

export const rollbackDeployment = async (
  id: string,
  reason: string,
): Promise<DeploymentHistory> => {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("deployment_history")
    .update({
      status: "rolled_back",
      rollback_at: new Date().toISOString(),
      rollback_reason: reason,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`rollbackDeployment: ${error.message}`);
  return data;
};
