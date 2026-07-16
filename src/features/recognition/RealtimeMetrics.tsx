"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildRecognitionTelemetryEvents } from "./telemetry";

type RealtimeMetricsProps = {
  sessionId: string | null;
  userId: string | null;
  sessionToken: string | null;
  currentGesture: string | null;
  confidence: number;
  isLowConfidence: boolean;
  isAiReply: boolean;
  inferenceTimeMs?: number;
};

export const RealtimeMetrics = ({
  sessionId,
  userId,
  sessionToken,
  currentGesture,
  confidence,
  isLowConfidence,
  isAiReply,
  inferenceTimeMs,
}: RealtimeMetricsProps) => {
  const lastLoggedGesture = useRef<string | null>(null);

  useEffect(() => {
    if (!currentGesture || !sessionToken || currentGesture === lastLoggedGesture.current) return;
    lastLoggedGesture.current = currentGesture;

    const supabase = createSupabaseBrowserClient();

    for (const event of buildRecognitionTelemetryEvents({
      gestureLabel: currentGesture,
      confidence,
      sessionToken,
      isLowConfidence,
      inferenceTimeMs,
    })) {
      supabase.from("telemetry_events").insert({
        ...event,
        user_id: userId,
        session_id: sessionId,
      }).then(({ error }) => {
        if (error) console.error("RealtimeMetrics insert error:", error.message);
      });
    }
  }, [currentGesture, confidence, inferenceTimeMs, isLowConfidence, sessionToken, userId, sessionId]);

  useEffect(() => {
    if (!isAiReply || !sessionToken) return;
    const supabase = createSupabaseBrowserClient();
    supabase.from("telemetry_events").insert({
      event_type: "ai_reply_used" as const,
      session_id: sessionId,
      user_id: userId,
      session_token: sessionToken,
    }).then(({ error }) => {
      if (error) console.error("RealtimeMetrics AI reply error:", error.message);
    });
  }, [isAiReply, sessionId, sessionToken, userId]);

  return null;
};
