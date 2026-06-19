// Query helpers for the `transcripts` table.
// Each row is an append-only snapshot of the running transcript content
// for a translation session; the latest row per session is the current
// recognised text.

import "server-only";
import { createSupabaseServerClient } from "../server";
import type { TranscriptEntryRow } from "../types";

export const appendTranscript = async (
  sessionId: string,
  content: string
): Promise<TranscriptEntryRow> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transcripts")
    .insert({ session_id: sessionId, content })
    .select()
    .single();
  if (error) throw new Error(`appendTranscript: ${error.message}`);
  return data;
};

export const listTranscriptsForSession = async (
  sessionId: string
): Promise<TranscriptEntryRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transcripts")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listTranscriptsForSession: ${error.message}`);
  return data ?? [];
};

export const listTranscriptsForOwnSessions = async (
  limit = 50,
  offset = 0
): Promise<{ rows: (TranscriptEntryRow & { session_started_at: string | null })[]; total: number }> => {
  const supabase = await createSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("transcripts")
    .select("*, translation_sessions!inner(started_at)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`listTranscriptsForOwnSessions: ${error.message}`);
  const rows = (data ?? []).map((r) => {
    const joined = (r as unknown as { translation_sessions: { started_at: string } | null }).translation_sessions;
    return {
      id: r.id,
      session_id: r.session_id,
      user_id: r.user_id,
      content: r.content,
      created_at: r.created_at,
      session_started_at: joined?.started_at ?? null
    };
  });
  return { rows, total: count ?? 0 };
};
