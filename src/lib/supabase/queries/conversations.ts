import "server-only";
import { createSupabaseServerClient } from "../server";
import {
  type ConversationSession,
  type ConversationMessage,
} from "../types";

// --- Sessions ---

export type CreateConvSessionInput = {
  participant_name?: string | null;
};

export const createConversationSession = async (
  input: CreateConvSessionInput = {}
): Promise<ConversationSession> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("conversation_sessions")
    .insert({
      user_id: user.id,
      participant_name: input.participant_name ?? null,
      status: "active",
    })
    .select()
    .single();
  if (error) throw new Error(`createConversationSession: ${error.message}`);
  return data;
};

export const endConversationSession = async (
  id: string,
  communication_success?: boolean | null
): Promise<ConversationSession> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversation_sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      communication_success: communication_success ?? null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`endConversationSession: ${error.message}`);
  return data;
};

export const listOwnConversationSessions = async (
  limit = 20,
  offset = 0
): Promise<ConversationSession[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversation_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`listOwnConversationSessions: ${error.message}`);
  return data ?? [];
};

export const getConversationSession = async (
  id: string
): Promise<ConversationSession | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getConversationSession: ${error.message}`);
  return data ?? null;
};

// --- Messages ---

export type AddMessageInput = {
  session_id: string;
  sender_type: "signer" | "responder";
  gesture_label?: string | null;
  translated_text: string;
  confidence?: number | null;
  reply_to_message_id?: string | null;
};

export const addConversationMessage = async (
  input: AddMessageInput
): Promise<ConversationMessage> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversation_messages")
    .insert({
      session_id: input.session_id,
      sender_type: input.sender_type,
      gesture_label: input.gesture_label ?? null,
      translated_text: input.translated_text,
      confidence: input.confidence ?? null,
      reply_to_message_id: input.reply_to_message_id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`addConversationMessage: ${error.message}`);

  // Update total_messages counter
  await supabase.rpc("increment_conv_message_count" as any, {
    p_session_id: input.session_id,
  } as any);

  return data;
};

export const listConversationMessages = async (
  sessionId: string
): Promise<ConversationMessage[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listConversationMessages: ${error.message}`);
  return data ?? [];
};

// --- Context-aware reply suggestions ---

export const getContextRepliesForGesture = async (
  gestureLabel: string,
  limit = 5
): Promise<string[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gesture_reply_relationships")
    .select("suggested_reply")
    .eq("gesture_label", gestureLabel)
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`getContextRepliesForGesture: ${error.message}`);
  return (data ?? []).map((r) => r.suggested_reply);
};

// --- Conversation analytics ---

export type ConversationAnalytics = {
  total_sessions: number;
  active_sessions: number;
  total_messages: number;
  avg_messages_per_session: number;
  avg_duration_minutes: number;
  success_rate: number | null;
};

export const getConversationAnalytics = async (): Promise<ConversationAnalytics> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("conversation_sessions").select("*");
  if (error) throw new Error(`getConversationAnalytics: ${error.message}`);

  const sessions = data ?? [];
  const active = sessions.filter((s) => s.status === "active");
  const completed = sessions.filter((s) => s.status === "ended");
  const withSuccess = completed.filter((s) => s.communication_success !== null);
  const totalMessages = sessions.reduce((sum, s) => sum + (s.total_messages ?? 0), 0);
  const durations = sessions
    .filter((s) => s.ended_at && s.started_at)
    .map((s) => (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60000);

  return {
    total_sessions: sessions.length,
    active_sessions: active.length,
    total_messages: totalMessages,
    avg_messages_per_session: sessions.length > 0 ? totalMessages / sessions.length : 0,
    avg_duration_minutes:
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
    success_rate:
      withSuccess.length > 0
        ? withSuccess.filter((s) => s.communication_success === true).length /
          withSuccess.length
        : null,
  };
};
