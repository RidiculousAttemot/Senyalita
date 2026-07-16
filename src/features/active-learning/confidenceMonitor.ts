import type { ConfidenceLevel, RecognitionResult, CategorizedRecognition } from "./types";

export function categorizeConfidence(confidence: number): ConfidenceLevel {
  if (confidence >= 0.95) return "excellent";
  if (confidence >= 0.80) return "good";
  if (confidence >= 0.60) return "needs_review";
  return "hard_case";
}

export function categorizeRecognition(result: RecognitionResult): CategorizedRecognition {
  const level = categorizeConfidence(result.confidence);
  const labels: Record<ConfidenceLevel, string> = {
    excellent: "Excellent",
    good: "Good",
    needs_review: "Needs Review",
    hard_case: "Hard Case",
  };
  return {
    result,
    level,
    category: labels[level],
    reviewed: false,
  };
}

export function shouldAcceptPrediction(result: RecognitionResult): boolean {
  return result.confidence >= 0.80;
}

export function shouldQueueForReview(result: RecognitionResult): boolean {
  return result.confidence >= 0.60 && result.confidence < 0.80;
}

export function shouldFlagAsHardCase(result: RecognitionResult): boolean {
  return result.confidence < 0.60;
}

export function detectUnknownGesture(
  result: RecognitionResult,
  threshold = 0.3,
): boolean {
  return result.confidence < threshold || result.label === "unknown";
}
