import type { ContextMessage } from "@/features/conversation/types";
import type { GestureDifficultyRank } from "./gestureDifficulty";

export type LearningRecommendation = {
  gestureLabel: string;
  reason: string;
  priorityScore: number;
};

export class LearningRecommendationEngine {
  private difficultyRankings: GestureDifficultyRank[] = [];
  private lowConfidenceGestures: Map<string, number> = new Map();
  private commonMistakes: Map<string, string[]> = new Map();
  private conversationHistory: ContextMessage[] = [];

  setDifficultyRankings(rankings: GestureDifficultyRank[]): void {
    this.difficultyRankings = rankings;
  }

  recordLowConfidence(label: string, confidence: number): void {
    const current = this.lowConfidenceGestures.get(label) ?? 0;
    this.lowConfidenceGestures.set(label, current + 1);
  }

  recordMistake(predicted: string, corrected: string): void {
    const mistakes = this.commonMistakes.get(predicted) ?? [];
    if (!mistakes.includes(corrected)) {
      mistakes.push(corrected);
    }
    this.commonMistakes.set(predicted, mistakes);
  }

  setConversationHistory(history: ContextMessage[]): void {
    this.conversationHistory = history;
  }

  getRecommendations(maxCount = 6): LearningRecommendation[] {
    const recommendations: LearningRecommendation[] = [];
    const seen = new Set<string>();

    const addIfNew = (rec: LearningRecommendation): void => {
      if (!seen.has(rec.gestureLabel)) {
        seen.add(rec.gestureLabel);
        recommendations.push(rec);
      }
    };

    for (const [label, count] of this.lowConfidenceGestures) {
      addIfNew({
        gestureLabel: label,
        reason: `You've had low confidence with this gesture ${count} time(s). Practice to improve.`,
        priorityScore: Math.min(count * 0.2, 0.8),
      });
    }

    for (const [, mistakes] of this.commonMistakes) {
      for (const mistake of mistakes) {
        addIfNew({
          gestureLabel: mistake,
          reason: "Common mistake detected. Review the correct form for this gesture.",
          priorityScore: 0.7,
        });
      }
    }

    for (const ranking of this.difficultyRankings) {
      if (ranking.difficultyLabel === "very_hard" || ranking.difficultyLabel === "hard") {
        addIfNew({
          gestureLabel: ranking.gesture_label,
          reason: `Ranked #${ranking.rank} hardest gesture. Focus on improving this one.`,
          priorityScore: 0.5 + (1 - ranking.rank / this.difficultyRankings.length) * 0.3,
        });
      }
    }

    const topics = this.extractTopicsFromHistory();
    for (const topic of topics) {
      const topicGestures = this.getGesturesForTopic(topic);
      for (const gesture of topicGestures) {
        if (recommendations.length >= maxCount) break;
        addIfNew({
          gestureLabel: gesture,
          reason: `Continue building your "${topic}" vocabulary for conversations.`,
          priorityScore: 0.4,
        });
      }
    }

    recommendations.sort((a, b) => b.priorityScore - a.priorityScore);
    return recommendations.slice(0, maxCount);
  }

  private extractTopicsFromHistory(): string[] {
    const topics = new Set<string>();
    for (const msg of this.conversationHistory) {
      if (msg.intent && msg.intent !== "Unknown") {
        topics.add(msg.intent);
      }
    }
    return Array.from(topics);
  }

  private getGesturesForTopic(topic: string): string[] {
    const topicGestures: Record<string, string[]> = {
      Greeting: ["Hello", "Good Morning", "Good Afternoon", "How Are You", "Nice to Meet You", "I'm Fine"],
      Introduction: ["My name", "Deaf", "Hard of Hearing", "Boy", "Girl", "Man", "Woman"],
      Question: ["What", "Who", "Where", "When", "Why", "How", "Which"],
      Response: ["Yes", "No", "Thank You", "You're Welcome", "Understand", "Don't Know"],
      Farewell: ["Goodbye", "See You Tomorrow", "Take Care"],
      Request: ["Please", "Help", "Need"],
      Emergency: ["Help", "Emergency", "Hospital", "Police", "Pain"],
      Food: ["Food", "Eat", "Drink", "Water", "Rice", "Bread", "Meat", "Fish", "Chicken", "Coffee", "Juice", "Milk"],
      Healthcare: ["Doctor", "Nurse", "Hospital", "Medicine", "Sick", "Pain", "Fever"],
      Education: ["School", "Teacher", "Student", "Study", "Learn", "Book", "Read", "Write"],
      Transportation: ["Car", "Bus", "Jeepney", "Taxi", "Train", "Go", "Come", "Travel"],
    };
    return topicGestures[topic] ?? [];
  }
}
