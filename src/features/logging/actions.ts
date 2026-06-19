// Logging server actions. Public API for the camera/history pages to
// persist prediction data through Supabase. Thin wrappers over
// src/lib/supabase/actions.ts that translate to the simpler signature
// used by the client (createTranslationSession, logPrediction, ...).
//
// All actions are "use server" and therefore only run on the server. They
// rely on the active user cookie to honour RLS.

"use server";

import {
  recordPredictionAction as supabaseRecordPrediction,
  endSessionAction as supabaseEndSession,
  importLocalDataAction as supabaseImport,
  saveTranscriptAction as supabaseSaveTranscript,
  type RecordPredictionActionInput
} from "@/lib/supabase/actions";
import {
  listOwnSessions,
  listOwnLogs,
  deleteOwnSession as supabaseDeleteOwnSession,
  type ImportSessionInput
} from "@/lib/supabase/queries/translations";
import { listTranscriptsForSession } from "@/lib/supabase/queries/transcripts";

export interface CreateSessionResult {
  sessionId: string;
  startedAt: string;
}

export const createTranslationSession = async (): Promise<CreateSessionResult> => {
  const sessionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  return { sessionId, startedAt };
};

export interface LogPredictionInput {
  sessionId: string;
  gestureLabel: string;
  confidence: number;
  inferenceTimeMs: number;
  selectedReply?: string | null;
  wasCustomReply?: boolean;
  startedAt?: string;
}

export const logPrediction = async (input: LogPredictionInput) => {
  const payload: RecordPredictionActionInput = {
    clientSessionId: input.sessionId,
    predictedLabel: input.gestureLabel,
    confidence: input.confidence,
    inferenceTimeMs: input.inferenceTimeMs,
    selectedReply: input.selectedReply ?? null,
    wasCustomReply: input.wasCustomReply ?? false,
    startedAt: input.startedAt
  };
  return supabaseRecordPrediction(payload);
};

export interface SaveTranscriptInput {
  sessionId: string;
  content: string;
  startedAt?: string;
}

export const saveTranscript = async (input: SaveTranscriptInput) => {
  return supabaseSaveTranscript({
    clientSessionId: input.sessionId,
    content: input.content,
    startedAt: input.startedAt
  });
};

export interface FinalizeSessionInput {
  sessionId: string;
}

export const finalizeTranslationSession = async (input: FinalizeSessionInput) => {
  return supabaseEndSession(input.sessionId);
};

export interface GetUserSessionsOptions {
  limit?: number;
  offset?: number;
  label?: string;
}

export interface UserSessionRow {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  totalPredictions: number;
  averageConfidence: number;
}

export const getUserSessions = async (opts: GetUserSessionsOptions = {}) => {
  const { rows, total } = await listOwnSessions(opts.limit ?? 20, opts.offset ?? 0);
  return {
    sessions: rows.map((s) => ({
      id: s.id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      durationMs: s.duration_ms,
      totalPredictions: 0,
      averageConfidence: 0
    })),
    total
  };
};

export interface SessionLogRow {
  id: string;
  sessionId: string;
  gestureLabel: string;
  confidence: number;
  inferenceTimeMs: number;
  selectedReply: string | null;
  createdAt: string;
}

export interface SessionTranscriptRow {
  id: string;
  content: string;
  createdAt: string;
}

export interface GetSessionLogsResult {
  session: { id: string; startedAt: string; endedAt: string | null } | null;
  logs: SessionLogRow[];
  transcripts: SessionTranscriptRow[];
}

export const getSessionLogs = async (input: { sessionId: string }): Promise<GetSessionLogsResult> => {
  const [logsResult, transcripts] = await Promise.all([
    listOwnLogs({ limit: 500 }),
    listTranscriptsForSession(input.sessionId)
  ]);
  const logs = logsResult.rows.filter((l) => l.session_id === input.sessionId);
  const session = logs[0]
    ? { id: input.sessionId, startedAt: logs[logs.length - 1].created_at, endedAt: logs[0].created_at }
    : null;
  return {
    session,
    logs: logs.map((l) => ({
      id: l.id,
      sessionId: l.session_id,
      gestureLabel: l.gesture_label,
      confidence: l.confidence,
      inferenceTimeMs: l.inference_time_ms,
      selectedReply: l.selected_reply,
      createdAt: l.created_at
    })),
    transcripts: transcripts.map((t) => ({
      id: t.id,
      content: t.content,
      createdAt: t.created_at
    }))
  };
};

export const importLocalHistory = async (sessions: ImportSessionInput[]) => {
  return supabaseImport(sessions);
};

export const deleteOwnSession = async (sessionId: string): Promise<void> => {
  await supabaseDeleteOwnSession(sessionId);
};
