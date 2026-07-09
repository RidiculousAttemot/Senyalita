// Server actions: admin authentication + logging sync.

"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "./server";
import {
  appendLog,
  endSession as endSessionQuery,
  ensureSession,
  importLocalSessions,
  type ImportSessionInput
} from "./queries/translations";
import { appendTranscript } from "./queries/transcripts";

export const signInWithPassword = async (formData: FormData) => {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "").trim();
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const { data: { user } } = await supabase.auth.getUser();
  if (user?.app_metadata?.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "Access denied. This account does not have admin privileges." };
  }

  revalidatePath("/", "layout");
  const redirectTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  return { success: true as const, redirectTo };
};

export interface RecordPredictionActionInput {
  clientSessionId: string;
  predictedLabel: string;
  confidence: number;
  inferenceTimeMs: number;
  selectedReply?: string | null;
  wasCustomReply?: boolean;
  startedAt?: string;
}

export const recordPredictionAction = async (input: RecordPredictionActionInput) => {
  if (!input.clientSessionId) return { error: "Missing client session id." };
  try {
    const session = await ensureSession(input.clientSessionId, input.startedAt);
    await appendLog({
      sessionId: session.id,
      gestureLabel: input.predictedLabel,
      confidence: input.confidence,
      inferenceTimeMs: input.inferenceTimeMs,
      selectedReply: input.selectedReply ?? null,
      wasCustomReply: input.wasCustomReply ?? false
    });
    return { success: true as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to record prediction." };
  }
};

export const endSessionAction = async (clientSessionId: string) => {
  if (!clientSessionId) return { error: "Missing client session id." };
  try {
    await endSessionQuery(clientSessionId);
    return { success: true as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to end session." };
  }
};

export const importLocalDataAction = async (sessions: ImportSessionInput[]) => {
  if (!Array.isArray(sessions)) return { error: "Invalid payload." };
  try {
    const imported = await importLocalSessions(sessions);
    return { success: true as const, imported };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to import sessions." };
  }
};

export const saveTranscriptAction = async (input: {
  clientSessionId: string;
  content: string;
  startedAt?: string;
}) => {
  if (!input.clientSessionId) return { error: "Missing client session id." };
  if (typeof input.content !== "string") return { error: "Missing transcript content." };
  try {
    const session = await ensureSession(input.clientSessionId, input.startedAt);
    const row = await appendTranscript(session.id, input.content);
    return { success: true as const, id: row.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save transcript." };
  }
};



