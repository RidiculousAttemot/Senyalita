"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RealtimeMetricsProps = {
  sessionId: string | null;
  userId: string | null;
  currentGesture: string | null;
  confidence: number;
  isLowConfidence: boolean;
  isAiReply: boolean;
};

export const RealtimeMetrics = ({
  sessionId,
  userId,
  currentGesture,
  confidence,
  isLowConfidence,
  isAiReply,
}: RealtimeMetricsProps) => {
  const lastLoggedGesture = useRef<string | null>(null);

  useEffect(() => {
    if (!currentGesture || currentGesture === lastLoggedGesture.current) return;
    lastLoggedGesture.current = currentGesture;

    const supabase = createSupabaseBrowserClient();

    const fire = (evt: {
      event_type: "recognition_success" | "recognition_failure" | "low_confidence" | "ai_reply_used" | "conversation_completed" | "session_abandoned" | "gesture_used" | "reply_used";
      gesture_label?: string | null;
      confidence?: number | null;
      user_id?: string | null;
      session_id?: string | null;
      event_data?: Record<string, unknown>;
    }) => {
      supabase.from("telemetry_events").insert(evt).then(({ error }) => {
        if (error) console.error("RealtimeMetrics insert error:", error.message);
      });
    };

    fire({ event_type: "recognition_success", gesture_label: currentGesture, confidence, user_id: userId, session_id: sessionId });
    fire({ event_type: "gesture_used", gesture_label: currentGesture, confidence, user_id: userId, session_id: sessionId });

    if (isLowConfidence) {
      fire({ event_type: "low_confidence", gesture_label: currentGesture, confidence, user_id: userId, session_id: sessionId, event_data: { threshold: 0.5 } });
    }
  }, [currentGesture, confidence, isLowConfidence, userId, sessionId]);

  useEffect(() => {
    if (!isAiReply) return;
    const supabase = createSupabaseBrowserClient();
    supabase.from("telemetry_events").insert({
      event_type: "ai_reply_used" as const,
      session_id: sessionId,
      user_id: userId,
    }).then(({ error }) => {
      if (error) console.error("RealtimeMetrics AI reply error:", error.message);
    });
  }, [isAiReply, sessionId, userId]);

  return null;
};
