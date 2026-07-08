// Centralized telemetry helpers — fire-and-forget, never throws.
// Use these throughout the application for consistent event tracking.

import { createSupabaseServiceClient } from "./service";
import type { TelemetryEvent } from "./types";

type EventType = TelemetryEvent["event_type"];

interface TelemetryInput {
  event_type: EventType;
  event_data?: Record<string, unknown>;
  user_id?: string | null;
  session_id?: string | null;
  gesture_label?: string | null;
  confidence?: number | null;
}

const record = async (input: TelemetryInput): Promise<void> => {
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("telemetry_events").insert({
      event_type: input.event_type,
      event_data: input.event_data ?? {},
      user_id: input.user_id ?? null,
      session_id: input.session_id ?? null,
      gesture_label: input.gesture_label ?? null,
      confidence: input.confidence ?? null,
    });
    if (error) console.error("telemetry:", error.message);
  } catch (err) {
    console.error("telemetry: unexpected error", err);
  }
};

// --- Specific event helpers ---

export const telemetry = {
  translationStarted: (data?: {
    inputLength?: number;
    modelVersion?: string;
    userId?: string | null;
    sessionId?: string | null;
  }) =>
    record({
      event_type: "translation_started",
      event_data: data
        ? {
            input_length: data.inputLength,
            model_version: data.modelVersion,
          }
        : {},
      user_id: data?.userId ?? null,
      session_id: data?.sessionId ?? null,
    }),

  translationCompleted: (data: {
    confidence: number;
    processingTimeMs: number;
    unknownTokenCount: number;
    userId?: string | null;
    sessionId?: string | null;
  }) =>
    record({
      event_type: "translation_completed",
      event_data: {
        confidence: data.confidence,
        processing_time_ms: data.processingTimeMs,
        unknown_token_count: data.unknownTokenCount,
      },
      confidence: data.confidence,
      user_id: data.userId ?? null,
      session_id: data.sessionId ?? null,
    }),

  translationFailed: (data: {
    errorMessage: string;
    userId?: string | null;
    sessionId?: string | null;
  }) =>
    record({
      event_type: "translation_failed",
      event_data: { error: data.errorMessage },
      user_id: data.userId ?? null,
      session_id: data.sessionId ?? null,
    }),

  modelLoaded: (data: {
    modelVersion: string;
    loadTimeMs: number;
    userId?: string | null;
  }) =>
    record({
      event_type: "model_loaded",
      event_data: {
        model_version: data.modelVersion,
        load_time_ms: data.loadTimeMs,
      },
      user_id: data.userId ?? null,
    }),

  modelPrediction: (data: {
    label: string;
    confidence: number;
    inferenceTimeMs: number;
    userId?: string | null;
    sessionId?: string | null;
  }) =>
    record({
      event_type: "model_prediction",
      event_data: {
        label: data.label,
        inference_time_ms: data.inferenceTimeMs,
      },
      confidence: data.confidence,
      gesture_label: data.label,
      user_id: data.userId ?? null,
      session_id: data.sessionId ?? null,
    }),

  adminLogin: (data: { userId: string }) =>
    record({
      event_type: "admin_login",
      event_data: {},
      user_id: data.userId,
    }),

  retrainingStarted: (data: {
    triggerReason: string;
    jobId: string;
    userId?: string | null;
  }) =>
    record({
      event_type: "retraining_started",
      event_data: { trigger_reason: data.triggerReason, job_id: data.jobId },
      user_id: data.userId ?? null,
    }),

  retrainingCompleted: (data: {
    jobId: string;
    accuracyBefore: number | null;
    accuracyAfter: number | null;
    userId?: string | null;
  }) =>
    record({
      event_type: "retraining_completed",
      event_data: {
        job_id: data.jobId,
        accuracy_before: data.accuracyBefore,
        accuracy_after: data.accuracyAfter,
      },
      user_id: data.userId ?? null,
    }),
};
