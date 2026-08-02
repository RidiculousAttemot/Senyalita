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

// Module-scoped, not per-instance: a misconfigured key affects every caller,
// and without this every recognized gesture (and every AI reply) kept
// re-attempting and re-logging the same failure for the rest of the session.
let telemetryDisabled = false;

/** An auth failure means every future call will fail the same way until the key is fixed; anything else may be transient. */
function isAuthError(message: string): boolean {
  return /invalid api key|jwt|api key/i.test(message);
}

function logTelemetryError(context: string, message: string) {
  if (isAuthError(message)) {
    telemetryDisabled = true;
    console.error(
      `${context}: ${message}. Telemetry disabled for the rest of this session \u2014 ` +
        "check NEXT_PUBLIC_SUPABASE_ANON_KEY matches the current Supabase project (this is a deploy config issue, not a recognition bug).",
    );
    return;
  }
  console.error(`${context}:`, message);
}

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
    if (telemetryDisabled || !currentGesture || !sessionToken || currentGesture === lastLoggedGesture.current) return;
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
        if (error) logTelemetryError("RealtimeMetrics insert error", error.message);
      });
    }
  }, [currentGesture, confidence, inferenceTimeMs, isLowConfidence, sessionToken, userId, sessionId]);

  useEffect(() => {
    if (telemetryDisabled || !isAiReply || !sessionToken) return;
    const supabase = createSupabaseBrowserClient();
    supabase.from("telemetry_events").insert({
      event_type: "ai_reply_used" as const,
      session_id: sessionId,
      user_id: userId,
      session_token: sessionToken,
    }).then(({ error }) => {
      if (error) logTelemetryError("RealtimeMetrics AI reply error", error.message);
    });
  }, [isAiReply, sessionId, sessionToken, userId]);

  return null;
};

