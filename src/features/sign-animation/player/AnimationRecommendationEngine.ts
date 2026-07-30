import type { AnimationRecommendation } from "../types";

export class AnimationRecommendationEngine {
  private fingerspellLog: Map<string, {
    word: string;
    occurrences: number;
    firstSeen: number;
    lastSeen: number;
    language: string;
  }> = new Map();

  private readonly MIN_OCCURRENCES_FOR_RECOMMENDATION = 5;

  recordFingerspell(word: string, language: string = "FSL"): void {
    const upper = word.toUpperCase();
    const existing = this.fingerspellLog.get(upper);
    if (existing) {
      existing.occurrences++;
      existing.lastSeen = Date.now();
    } else {
      this.fingerspellLog.set(upper, {
        word: upper,
        occurrences: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        language,
      });
    }
  }

  getRecommendations(): AnimationRecommendation[] {
    const recommendations: AnimationRecommendation[] = [];
    for (const [, entry] of this.fingerspellLog) {
      if (entry.occurrences >= this.MIN_OCCURRENCES_FOR_RECOMMENDATION) {
        recommendations.push({
          word: entry.word,
          frequency: entry.occurrences,
          language: entry.language,
          firstSeen: entry.firstSeen,
          lastSeen: entry.lastSeen,
          currentPlayback: "Finger Spelling",
          occurrences: entry.occurrences,
          recommendation: `Create dedicated FSL animation for "${entry.word}" (fingerspelled ${entry.occurrences} times)`,
        });
      }
    }
    return recommendations.sort((a, b) => b.frequency - a.frequency);
  }

  getAllFingerspelled(): AnimationRecommendation[] {
    const all: AnimationRecommendation[] = [];
    for (const [, entry] of this.fingerspellLog) {
      all.push({
        word: entry.word,
        frequency: entry.occurrences,
        language: entry.language,
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen,
        currentPlayback: "Finger Spelling",
        occurrences: entry.occurrences,
        recommendation: entry.occurrences >= this.MIN_OCCURRENCES_FOR_RECOMMENDATION
          ? `Create dedicated FSL animation for "${entry.word}"`
          : "Monitor usage",
      });
    }
    return all.sort((a, b) => b.frequency - a.frequency);
  }

  getOccurrenceThreshold(): number {
    return this.MIN_OCCURRENCES_FOR_RECOMMENDATION;
  }

  setOccurrenceThreshold(threshold: number): void {
    // @ts-expect-error - allow override
    this.MIN_OCCURRENCES_FOR_RECOMMENDATION = threshold;
  }

  reset(): void {
    this.fingerspellLog.clear();
  }
}
