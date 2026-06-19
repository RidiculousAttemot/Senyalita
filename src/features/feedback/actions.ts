// Server actions for the feedback widget on the camera page.

"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertFeedback } from "@/lib/supabase/queries/feedback";
import type { FeedbackRow } from "@/lib/supabase/types";

export interface FeedbackInput {
  sessionId?: string | null;
  gestureLabel: string;
  rating: FeedbackRow["rating"];
  comment?: string | null;
}

export const submitFeedback = async (input: FeedbackInput): Promise<FeedbackRow> => {
  if (!input.gestureLabel || (input.rating !== "correct" && input.rating !== "incorrect")) {
    throw new Error("gestureLabel and a valid rating are required");
  }
  return insertFeedback({
    user_id: null,
    session_id: input.sessionId ?? null,
    gesture_label: input.gestureLabel,
    rating: input.rating,
    comment: input.comment ?? null
  });
};
