// Typed query helpers for the `gestures` and `gesture_replies` tables.

import "server-only";
import { createSupabaseServerClient } from "../server";
import type { Gesture, GestureReply, GestureWithReplies } from "../types";

export const listActiveGesturesWithReplies = async (): Promise<GestureWithReplies[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gestures_with_replies")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(`listActiveGesturesWithReplies: ${error.message}`);
  return data ?? [];
};

export const getGestureByLabel = async (label: string): Promise<GestureWithReplies | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gestures_with_replies")
    .select("*")
    .eq("label", label)
    .maybeSingle();
  if (error) throw new Error(`getGestureByLabel: ${error.message}`);
  return data ?? null;
};

export const listAllGesturesAdmin = async (): Promise<Gesture[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gestures")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw new Error(`listAllGesturesAdmin: ${error.message}`);
  return data ?? [];
};

export interface UpsertGestureInput {
  id?: string;
  label: string;
  description?: string;
  video_path?: string | null;
  thumbnail_path?: string | null;
  is_active?: boolean;
  status?: Gesture["status"];
  display_order?: number;
}

export const upsertGesture = async (input: UpsertGestureInput): Promise<Gesture> => {
  const supabase = await createSupabaseServerClient();
  const payload = {
    id: input.id,
    label: input.label,
    description: input.description ?? "",
    video_path: input.video_path ?? null,
    thumbnail_path: input.thumbnail_path ?? null,
    is_active: input.is_active ?? true,
    status: input.status ?? "approved",
    display_order: input.display_order ?? 0
  };
  const { data, error } = await supabase
    .from("gestures")
    .upsert(payload)
    .select()
    .single();
  if (error) throw new Error(`upsertGesture: ${error.message}`);
  return data;
};

export const updateGestureVideoPath = async (
  id: string,
  videoPath: string | null
): Promise<Gesture> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gestures")
    .update({ video_path: videoPath })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateGestureVideoPath: ${error.message}`);
  return data;
};

export const updateGestureStatus = async (
  id: string,
  status: Gesture["status"]
): Promise<Gesture> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gestures")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateGestureStatus: ${error.message}`);
  return data;
};

export const deleteGesture = async (id: string): Promise<void> => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("gestures").delete().eq("id", id);
  if (error) throw new Error(`deleteGesture: ${error.message}`);
};

export const listRepliesForGesture = async (gestureId: string): Promise<GestureReply[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gesture_replies")
    .select("*")
    .eq("gesture_id", gestureId)
    .order("display_order", { ascending: true });
  if (error) throw new Error(`listRepliesForGesture: ${error.message}`);
  return data ?? [];
};

export interface UpsertReplyInput {
  id?: string;
  gesture_id: string;
  reply_text: string;
  display_order?: number;
  is_active?: boolean;
}

export const upsertReply = async (input: UpsertReplyInput): Promise<GestureReply> => {
  const supabase = await createSupabaseServerClient();
  const payload = {
    id: input.id,
    gesture_id: input.gesture_id,
    reply_text: input.reply_text,
    display_order: input.display_order ?? 0,
    is_active: input.is_active ?? true
  };
  const { data, error } = await supabase
    .from("gesture_replies")
    .upsert(payload)
    .select()
    .single();
  if (error) throw new Error(`upsertReply: ${error.message}`);
  return data;
};

export const deleteReply = async (id: string): Promise<void> => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("gesture_replies").delete().eq("id", id);
  if (error) throw new Error(`deleteReply: ${error.message}`);
};

export const updateReplyVideoPath = async (
  id: string,
  videoPath: string | null
): Promise<GestureReply> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gesture_replies")
    .update({ video_path: videoPath })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateReplyVideoPath: ${error.message}`);
  return data;
};
