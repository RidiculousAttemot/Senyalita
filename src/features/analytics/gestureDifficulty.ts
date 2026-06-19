import type { GestureDifficultyTracking } from "@/lib/supabase/types";

export type GestureDifficultyRank = GestureDifficultyTracking & {
  rank: number;
  difficultyLabel: "easy" | "moderate" | "hard" | "very_hard";
};

export class GestureDifficultyAnalyzer {
  private tracking: Map<string, GestureDifficultyTracking> = new Map();
  private rankedList: GestureDifficultyRank[] = [];

  addTracking(entry: GestureDifficultyTracking): void {
    this.tracking.set(entry.gesture_label, entry);
    this.recompute();
  }

  addTrackings(entries: GestureDifficultyTracking[]): void {
    for (const entry of entries) {
      this.tracking.set(entry.gesture_label, entry);
    }
    this.recompute();
  }

  getRanked(): GestureDifficultyRank[] {
    return [...this.rankedList];
  }

  getDifficulty(label: string): GestureDifficultyRank | undefined {
    return this.rankedList.find(r => r.gesture_label === label);
  }

  getTopHardest(count = 10): GestureDifficultyRank[] {
    return this.rankedList.slice(0, count);
  }

  getEasiest(count = 10): GestureDifficultyRank[] {
    return this.rankedList.slice(-count).reverse();
  }

  private recompute(): void {
    const entries = Array.from(this.tracking.values());
    entries.sort((a, b) => b.difficulty_score - a.difficulty_score);

    this.rankedList = entries.map((e, i) => ({
      ...e,
      rank: i + 1,
      difficultyLabel: this.classifyDifficulty(e.difficulty_score),
    }));
  }

  private classifyDifficulty(score: number): "easy" | "moderate" | "hard" | "very_hard" {
    if (score < 0.25) return "easy";
    if (score < 0.45) return "moderate";
    if (score < 0.65) return "hard";
    return "very_hard";
  }
}

export const computeDifficultyScore = (
  avgConfidence: number,
  correctionRate: number,
  confusionRate: number,
  retryRate: number
): number => {
  return (
    (1 - avgConfidence) * 0.4 +
    correctionRate * 0.3 +
    confusionRate * 0.2 +
    retryRate * 0.1
  );
};
