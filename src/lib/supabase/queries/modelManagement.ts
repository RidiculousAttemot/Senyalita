import "server-only";
import { createSupabaseServerClient } from "../server";
import type { ModelVersion } from "../types";

export const listModelVersions = async (): Promise<ModelVersion[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("model_versions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listModelVersions: ${error.message}`);
  return data ?? [];
};

export const getActiveModel = async (): Promise<ModelVersion | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("model_versions")
    .select("*")
    .eq("is_active", true)
    .single();
  if (error && error.code !== "PGRST116") throw new Error(`getActiveModel: ${error.message}`);
  return data;
};

export const activateModel = async (versionId: string): Promise<void> => {
  const supabase = await createSupabaseServerClient();
  const { error: deactivateAll } = await supabase
    .from("model_versions")
    .update({ is_active: false })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deactivateAll) throw new Error(`activateModel.deactivateAll: ${deactivateAll.message}`);

  const { error: activate } = await supabase
    .from("model_versions")
    .update({ is_active: true })
    .eq("id", versionId);
  if (activate) throw new Error(`activateModel.activate: ${activate.message}`);
};

export const createModelVersion = async (input: {
  version: string;
  accuracy?: number | null;
  dataset_size?: number | null;
  num_classes?: number;
  architecture?: string;
  notes?: string | null;
}): Promise<ModelVersion> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("model_versions")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(`createModelVersion: ${error.message}`);
  return data;
};
