// Typed query helpers for translation_sessions and translation_logs.
// The camera page uses these (via the server client) to start a session,
// append logs, and finalise the session on stop.

import "server-only";
import { createSupabaseServerClient } from "../server";
import type { TranslationLog, TranslationSession } from "../types";

export interface StartSessionInput {
  id?: string;
  source?: TranslationSession["source"];
  startedAt?: string;
  endedAt?: string;
  durationMs?: number | null;
}

export const startSession = async (input: StartSessionInput = {}): Promise<TranslationSession> => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { data, error } = await supabase
    .from("translation_sessions")
    .insert({
      id: input.id,
      user_id: user.id,
      source: input.source ?? "web",
      started_at: input.startedAt ?? new Date().toISOString(),
      ended_at: input.endedAt ?? null,
      duration_ms: input.durationMs ?? null
    })
    .select()
    .single();
  if (error) throw new Error(`startSession: ${error.message}`);
  return data;
};

export const ensureSession = async (
  clientSessionId: string,
  startedAt?: string
): Promise<TranslationSession> => {
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("translation_sessions")
    .select("*")
    .eq("id", clientSessionId)
    .maybeSingle();
  if (existing) return existing;
  return startSession({ id: clientSessionId, startedAt });
};

export const endSession = async (sessionId: string): Promise<TranslationSession> => {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("translation_sessions")
    .select("started_at")
    .eq("id", sessionId)
    .single();
  if (fetchErr) throw new Error(`endSession: ${fetchErr.message}`);
  const startedAt = existing?.started_at ? new Date(existing.started_at) : null;
  const durationMs = startedAt ? Date.now() - startedAt.getTime() : null;
  const { data, error } = await supabase
    .from("translation_sessions")
    .update({ ended_at: new Date().toISOString(), duration_ms: durationMs })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw new Error(`endSession: ${error.message}`);
  return data;
};

export interface AppendLogInput {
  sessionId: string;
  gestureLabel: string;
  confidence: number;
  inferenceTimeMs: number;
  selectedReply?: string | null;
  wasCustomReply?: boolean;
  createdAt?: string;
  recognitionSource?: "static" | "temporal" | "hybrid" | "unknown" | null;
}

export const appendLog = async (input: AppendLogInput): Promise<TranslationLog> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("translation_logs")
    .insert({
      session_id: input.sessionId,
      gesture_label: input.gestureLabel,
      confidence: input.confidence,
      inference_time_ms: input.inferenceTimeMs,
      selected_reply: input.selectedReply ?? null,
      was_custom_reply: input.wasCustomReply ?? false,
      recognition_source: input.recognitionSource ?? null,
      created_at: input.createdAt
    })
    .select()
    .single();
  if (error) throw new Error(`appendLog: ${error.message}`);
  return data;
};

export interface ListLogsOptions {
  limit?: number;
  offset?: number;
  label?: string;
  since?: string;
  until?: string;
}

export const listOwnLogs = async (opts: ListLogsOptions = {}): Promise<{ rows: TranslationLog[]; total: number }> => {
  const supabase = await createSupabaseServerClient();
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  let query = supabase
    .from("translation_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (opts.label) query = query.eq("gesture_label", opts.label);
  if (opts.since) query = query.gte("created_at", opts.since);
  if (opts.until) query = query.lte("created_at", opts.until);
  const { data, error, count } = await query;
  if (error) throw new Error(`listOwnLogs: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
};

export const listAllLogs = async (opts: ListLogsOptions = {}): Promise<{ rows: TranslationLog[]; total: number }> => {
  const supabase = await createSupabaseServerClient();
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  let query = supabase
    .from("translation_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (opts.label) query = query.eq("gesture_label", opts.label);
  if (opts.since) query = query.gte("created_at", opts.since);
  if (opts.until) query = query.lte("created_at", opts.until);
  const { data, error, count } = await query;
  if (error) throw new Error(`listAllLogs: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
};

export const listOwnSessions = async (limit = 50, offset = 0): Promise<{ rows: TranslationSession[]; total: number }> => {
  const supabase = await createSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("translation_sessions")
    .select("*", { count: "exact" })
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`listOwnSessions: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
};

export const listAllSessions = async (limit = 50, offset = 0): Promise<{ rows: TranslationSession[]; total: number }> => {
  const supabase = await createSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("translation_sessions")
    .select("*", { count: "exact" })
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`listAllSessions: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
};

export const deleteOwnSession = async (sessionId: string): Promise<void> => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("translation_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw new Error(`deleteOwnSession: ${error.message}`);
};

export interface ImportLogInput {
  sessionId: string;
  gestureLabel: string;
  confidence: number;
  inferenceTimeMs: number;
  createdAt: string;
}

export interface ImportSessionInput {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  logs: ImportLogInput[];
}

export const importLocalSessions = async (sessions: ImportSessionInput[]): Promise<number> => {
  if (sessions.length === 0) return 0;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const sessionRows = sessions.map((s) => ({
    id: s.id,
    user_id: user.id,
    source: "web" as const,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    duration_ms: s.durationMs
  }));

  const { error: sessionErr } = await supabase
    .from("translation_sessions")
    .upsert(sessionRows, { onConflict: "id", ignoreDuplicates: true });
  if (sessionErr) throw new Error(`importLocalSessions (sessions): ${sessionErr.message}`);

  const logRows = sessions.flatMap((s) =>
    s.logs.map((l) => ({
      session_id: s.id,
      gesture_label: l.gestureLabel,
      confidence: l.confidence,
      inference_time_ms: l.inferenceTimeMs,
      selected_reply: null,
      was_custom_reply: false,
      created_at: l.createdAt
    }))
  );

  if (logRows.length === 0) return sessionRows.length;
  const chunkSize = 200;
  for (let i = 0; i < logRows.length; i += chunkSize) {
    const slice = logRows.slice(i, i + chunkSize);
    const { error: logErr } = await supabase.from("translation_logs").insert(slice);
    if (logErr) throw new Error(`importLocalSessions (logs): ${logErr.message}`);
  }
  return sessionRows.length;
};
