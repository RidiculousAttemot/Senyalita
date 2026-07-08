import type { SequencedItem } from "./animationSequencer";
import type { GlossTranslation } from "./glossTranslator";

export interface WordConfidence {
  word: string;
  gloss: string;
  score: number;
  isLowConfidence: boolean;
  isFingerspelled: boolean;
  isUnresolved: boolean;
  strategy: string;
}

export interface TranslationConfidence {
  overall: number;
  words: WordConfidence[];
  lowConfidenceCount: number;
  fingerspelledCount: number;
  unresolvedCount: number;
  totalWords: number;
  level: "high" | "medium" | "low";
}

const LOW_CONFIDENCE_THRESHOLD = 0.5;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.75;

export function computeTranslationConfidence(
  glossSequence: GlossTranslation[],
  sequence: SequencedItem[],
): TranslationConfidence {
  const words: WordConfidence[] = [];

  for (const g of glossSequence) {
    const score = g.confidence;
    words.push({
      word: g.original,
      gloss: g.gloss,
      score,
      isLowConfidence: score < LOW_CONFIDENCE_THRESHOLD,
      isFingerspelled: g.strategy === "fingerspelling",
      isUnresolved: g.strategy === "related" || score < 0.4,
      strategy: g.strategy,
    });
  }

  const lowConfidenceCount = words.filter((w) => w.isLowConfidence).length;
  const fingerspelledCount = words.filter((w) => w.isFingerspelled).length;
  const unresolvedCount = words.filter((w) => w.isUnresolved).length;
  const totalWords = words.length;

  const averageScore = totalWords > 0
    ? words.reduce((sum, w) => sum + w.score, 0) / totalWords
    : 0;

  let level: "high" | "medium" | "low";
  if (averageScore >= MEDIUM_CONFIDENCE_THRESHOLD && lowConfidenceCount === 0) {
    level = "high";
  } else if (averageScore >= LOW_CONFIDENCE_THRESHOLD && lowConfidenceCount <= totalWords / 2) {
    level = "medium";
  } else {
    level = "low";
  }

  return {
    overall: Math.round(averageScore * 100) / 100,
    words,
    lowConfidenceCount,
    fingerspelledCount,
    unresolvedCount,
    totalWords,
    level,
  };
}

export function getConfidenceColor(score: number): string {
  if (score >= 0.9) return "#22c55e";
  if (score >= 0.7) return "#eab308";
  if (score >= 0.5) return "#f97316";
  return "#ef4444";
}

export function getConfidenceLabel(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high": return "High Confidence";
    case "medium": return "Medium Confidence";
    case "low": return "Low Confidence";
  }
}
