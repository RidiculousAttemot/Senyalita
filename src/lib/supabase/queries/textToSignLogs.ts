// Server-only queries for the text_to_sign_logs table.
// Logging failures never interrupt the caller.

import "server-only";
import { createSupabaseServiceClient } from "../service";
import type { TextToSignLog } from "../types";

export interface InsertTextToSignLogInput {
  input_text: string;
  translated_gloss?: string | null;
  confidence_score?: number | null;
  processing_time_ms?: number | null;
  unknown_token_count?: number;
  model_version?: string | null;
  user_id?: string | null;
  session_id?: string | null;
  source?: TextToSignLog["source"];
  success?: boolean;
  error_message?: string | null;
}

export const insertTextToSignLog = async (
  input: InsertTextToSignLogInput,
): Promise<void> => {
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("text_to_sign_logs").insert({
      input_text: input.input_text,
      translated_gloss: input.translated_gloss ?? null,
      confidence_score: input.confidence_score ?? null,
      processing_time_ms: input.processing_time_ms ?? null,
      unknown_token_count: input.unknown_token_count ?? 0,
      model_version: input.model_version ?? null,
      user_id: input.user_id ?? null,
      session_id: input.session_id ?? null,
      source: input.source ?? "web",
      success: input.success ?? true,
      error_message: input.error_message ?? null,
    });
    if (error) console.error("insertTextToSignLog:", error.message);
  } catch (err) {
    console.error("insertTextToSignLog: unexpected error", err);
  }
};

export interface ListTextToSignLogsOptions {
  limit?: number;
  offset?: number;
  since?: string;
  until?: string;
  success?: boolean;
}

export const listTextToSignLogs = async (
  opts: ListTextToSignLogsOptions = {},
): Promise<{ rows: TextToSignLog[]; total: number }> => {
  const supabase = createSupabaseServiceClient();
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  let query = supabase
    .from("text_to_sign_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (opts.since) query = query.gte("created_at", opts.since);
  if (opts.until) query = query.lte("created_at", opts.until);
  if (opts.success !== undefined) query = query.eq("success", opts.success);
  const { data, error, count } = await query;
  if (error) throw new Error(`listTextToSignLogs: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
};

export const getTextToSignLogsSummary = async (
  daysBack = 30,
): Promise<{
  totalTranslations: number;
  successfulTranslations: number;
  failedTranslations: number;
  avgConfidence: number | null;
  avgProcessingTimeMs: number | null;
  totalUnknownTokens: number;
}> => {
  try {
    const supabase = createSupabaseServiceClient();
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();
    const { data } = await supabase
      .from("text_to_sign_logs")
      .select("*")
      .gte("created_at", since);
    const list = data ?? [];
    const totalTranslations = list.length;
    const successfulTranslations = list.filter((r) => r.success).length;
    const failedTranslations = list.filter((r) => !r.success).length;
    const confidences = list
      .filter((r) => r.confidence_score !== null)
      .map((r) => r.confidence_score!);
    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : null;
    const times = list
      .filter((r) => r.processing_time_ms !== null)
      .map((r) => r.processing_time_ms!);
    const avgProcessingTimeMs =
      times.length > 0
        ? times.reduce((a, b) => a + b, 0) / times.length
        : null;
    const totalUnknownTokens = list.reduce(
      (sum, r) => sum + r.unknown_token_count,
      0,
    );
    return {
      totalTranslations,
      successfulTranslations,
      failedTranslations,
      avgConfidence,
      avgProcessingTimeMs,
      totalUnknownTokens,
    };
  } catch {
    return {
      totalTranslations: 0,
      successfulTranslations: 0,
      failedTranslations: 0,
      avgConfidence: null,
      avgProcessingTimeMs: null,
      totalUnknownTokens: 0,
    };
  }
};
