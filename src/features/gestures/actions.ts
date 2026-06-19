// Server action: lookup gesture details (reference video, suggested replies)
// for a given recognised label. Used by the camera page when the model
// predicts a label above the confidence threshold.

"use server";

import {
  listActiveGesturesWithReplies,
  getGestureByLabel
} from "@/lib/supabase/queries/gestures";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { GestureWithReplies } from "@/lib/supabase/types";

export interface GestureInfoReply {
  id: string;
  replyText: string;
  displayOrder: number;
  videoUrl: string | null;
}

export interface GestureInfo {
  id: string;
  label: string;
  description: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  replies: GestureInfoReply[];
}

const BUCKET = "gesture-videos";

const resolvePublicUrl = (path: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const supabase = createSupabaseServiceClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

const toGestureInfo = (g: GestureWithReplies): GestureInfo => ({
  id: g.id,
  label: g.label,
  description: g.description,
  videoUrl: resolvePublicUrl(g.video_path),
  thumbnailUrl: resolvePublicUrl(g.thumbnail_path),
  replies: (g.replies ?? []).map((r) => ({
    id: r.id,
    replyText: r.reply_text,
    displayOrder: r.display_order,
    videoUrl: null
  }))
});

// Fetch per-reply video paths in a single round trip and zip them into the
// GestureInfo. The `gestures_with_replies` view intentionally does not
// expose `video_path` on the inner rows, so we resolve them here.
const attachReplyVideos = async (infos: GestureInfo[]): Promise<GestureInfo[]> => {
  if (infos.length === 0) return infos;
  const supabase = createSupabaseServiceClient();
  const ids = infos.flatMap((g) => g.replies.map((r) => r.id));
  if (ids.length === 0) return infos;
  const { data, error } = await supabase
    .from("gesture_replies")
    .select("id, video_path")
    .in("id", ids);
  if (error || !data) return infos;
  const pathById = new Map<string, string | null>(
    data.map((row) => [row.id as string, (row.video_path as string | null) ?? null])
  );
  return infos.map((g) => ({
    ...g,
    replies: g.replies.map((r) => ({
      ...r,
      videoUrl: resolvePublicUrl(pathById.get(r.id) ?? null)
    }))
  }));
};

export const lookupGesture = async (label: string): Promise<GestureInfo | null> => {
  const g = await getGestureByLabel(label);
  if (!g) return null;
  const [info] = await attachReplyVideos([toGestureInfo(g)]);
  return info ?? null;
};

export const listAllActiveGestures = async (): Promise<GestureInfo[]> => {
  const list = await listActiveGesturesWithReplies();
  return attachReplyVideos(list.map(toGestureInfo));
};
