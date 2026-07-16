import type { TelemetryEvent } from "@/lib/supabase/types";

type RecognitionTelemetryEvent = {
  event_type: TelemetryEvent["event_type"];
  event_data: Record<string, unknown>;
  gesture_label: string;
  confidence: number;
  session_token: string;
};

export const buildRecognitionTelemetryEvents = ({
  gestureLabel,
  confidence,
  sessionToken,
  isLowConfidence,
  inferenceTimeMs,
}: {
  gestureLabel: string | null;
  confidence: number;
  sessionToken: string;
  isLowConfidence?: boolean;
  inferenceTimeMs?: number;
}): RecognitionTelemetryEvent[] => {
  if (!gestureLabel) return [];

  const event = (event_type: RecognitionTelemetryEvent["event_type"], event_data: Record<string, unknown> = {}) => ({
    event_type,
    event_data,
    gesture_label: gestureLabel,
    confidence,
    session_token: sessionToken,
  });

  const events = [
    event("recognition_success", Number.isFinite(inferenceTimeMs) ? { inference_time_ms: inferenceTimeMs } : {}),
    event("gesture_used"),
  ];

  if (isLowConfidence ?? confidence < 0.5) {
    events.push(event("low_confidence", { threshold: 0.5 }));
  }

  return events;
};