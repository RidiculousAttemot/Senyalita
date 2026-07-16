import type { RecognitionResult } from "./types";

export interface UnknownGestureRecord {
  sessionId: string;
  timestamp: string;
  confidence: number;
  topPredictions: Array<{ label: string; confidence: number }>;
  gestureLabel: string | null;
}

const UNKNOWN_THRESHOLD = 0.3;

export function isUnknownGesture(result: RecognitionResult): boolean {
  return result.confidence < UNKNOWN_THRESHOLD;
}

export function createUnknownRecord(
  result: RecognitionResult,
  sessionId?: string,
): UnknownGestureRecord {
  return {
    sessionId: sessionId ?? "unknown",
    timestamp: new Date().toISOString(),
    confidence: result.confidence,
    topPredictions: result.topK.slice(0, 3),
    gestureLabel: result.confidence >= UNKNOWN_THRESHOLD ? result.label : null,
  };
}

export function shouldDisplayUnknown(confidence: number): boolean {
  return confidence < UNKNOWN_THRESHOLD;
}
