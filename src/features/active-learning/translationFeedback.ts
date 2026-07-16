import type { TranslationFeedback } from "./types";

export interface TranslationFailure {
  requestedText: string;
  generatedGlosses: string[];
  missingGlosses: string[];
  usedFallback: boolean;
  playbackFailed: boolean;
  failureReason: string | null;
}

export function createTranslationFeedback(
  failure: TranslationFailure,
): Omit<TranslationFeedback, "id" | "createdAt" | "updatedAt" | "frequency"> {
  return {
    requestedText: failure.requestedText,
    generatedGlosses: failure.generatedGlosses,
    missingGlosses: failure.missingGlosses,
    usedFallback: failure.usedFallback,
    playbackFailed: failure.playbackFailed,
    failureReason: failure.failureReason,
  };
}

export function analyzeMissingAnimations(
  feedbacks: TranslationFeedback[],
): Array<{ gloss: string; count: number; lastRequested: string }> {
  const glossCount = new Map<string, { count: number; lastRequested: string }>();
  for (const fb of feedbacks) {
    for (const gloss of fb.missingGlosses) {
      const existing = glossCount.get(gloss);
      if (existing) {
        existing.count += fb.frequency;
        if (fb.createdAt > existing.lastRequested) existing.lastRequested = fb.createdAt;
      } else {
        glossCount.set(gloss, { count: fb.frequency, lastRequested: fb.createdAt });
      }
    }
  }
  return Array.from(glossCount.entries())
    .map(([gloss, data]) => ({ gloss, ...data }))
    .sort((a, b) => b.count - a.count);
}

export function prioritizeMissingAnimations(
  missingAnalysis: Array<{ gloss: string; count: number; lastRequested: string }>,
): Array<{ gloss: string; count: number; priority: "high" | "medium" | "low" }> {
  return missingAnalysis.map((item) => ({
    ...item,
    priority: item.count >= 10 ? "high" : item.count >= 3 ? "medium" : "low",
  }));
}
