import { ConversationIntent } from "../conversation/types";

export type GestureSuggestion = {
  label: string;
  displayName: string;
  score: number;
  context: "follow_up" | "related" | "opposite" | "conversation_flow";
};

type SuggestionRule = {
  gesture: string;
  suggestions: Array<{ label: string; score: number }>;
};

const FOLLOW_UP_SUGGESTIONS: SuggestionRule[] = [
  { gesture: "THANK YOU", suggestions: [{ label: "YOURE WELCOME", score: 0.95 }, { label: "NO PROBLEM", score: 0.7 }, { label: "ANYTIME", score: 0.6 }] },
  { gesture: "HELLO", suggestions: [{ label: "HOW ARE YOU", score: 0.9 }, { label: "NICE TO MEET YOU", score: 0.7 }, { label: "IM FINE", score: 0.5 }] },
  { gesture: "GOOD MORNING", suggestions: [{ label: "HOW ARE YOU", score: 0.85 }, { label: "GOOD MORNING", score: 0.6 }, { label: "NICE TO MEET YOU", score: 0.4 }] },
  { gesture: "GOOD AFTERNOON", suggestions: [{ label: "HOW ARE YOU", score: 0.85 }, { label: "GOOD AFTERNOON", score: 0.6 }] },
  { gesture: "GOOD EVENING", suggestions: [{ label: "HOW ARE YOU", score: 0.85 }, { label: "GOOD EVENING", score: 0.6 }] },
  { gesture: "HOW ARE YOU", suggestions: [{ label: "IM FINE", score: 0.9 }, { label: "THANK YOU", score: 0.5 }, { label: "HOW ARE YOU", score: 0.4 }] },
  { gesture: "IM FINE", suggestions: [{ label: "THANK YOU", score: 0.8 }, { label: "HOW ARE YOU", score: 0.7 }, { label: "NICE TO MEET YOU", score: 0.4 }] },
  { gesture: "NICE TO MEET YOU", suggestions: [{ label: "NICE TO MEET YOU", score: 0.85 }, { label: "HOW ARE YOU", score: 0.6 }, { label: "THANK YOU", score: 0.4 }] },
  { gesture: "YOURE WELCOME", suggestions: [{ label: "THANK YOU", score: 0.5 }, { label: "GOODBYE", score: 0.4 }, { label: "SEE YOU TOMORROW", score: 0.3 }] },
  { gesture: "SEE YOU TOMORROW", suggestions: [{ label: "GOODBYE", score: 0.8 }, { label: "THANK YOU", score: 0.4 }, { label: "GOOD MORNING", score: 0.3 }] },
  { gesture: "YES", suggestions: [{ label: "THANK YOU", score: 0.6 }, { label: "GOOD", score: 0.5 }, { label: "CORRECT", score: 0.4 }] },
  { gesture: "NO", suggestions: [{ label: "SORRY", score: 0.7 }, { label: "WRONG", score: 0.6 }, { label: "DON'T KNOW", score: 0.5 }] },
  { gesture: "UNDERSTAND", suggestions: [{ label: "THANK YOU", score: 0.7 }, { label: "YES", score: 0.6 }, { label: "GOOD", score: 0.5 }] },
  { gesture: "DON'T UNDERSTAND", suggestions: [{ label: "PLEASE", score: 0.8 }, { label: "SLOW", score: 0.7 }, { label: "HELP", score: 0.6 }] },
  { gesture: "KNOW", suggestions: [{ label: "UNDERSTAND", score: 0.7 }, { label: "YES", score: 0.6 }, { label: "THANK YOU", score: 0.5 }] },
  { gesture: "DON'T KNOW", suggestions: [{ label: "HELP", score: 0.7 }, { label: "PLEASE", score: 0.6 }, { label: "UNDERSTAND", score: 0.4 }] },
  { gesture: "PLEASE", suggestions: [{ label: "THANK YOU", score: 0.8 }, { label: "YES", score: 0.5 }, { label: "HELP", score: 0.4 }] },
  { gesture: "HELP", suggestions: [{ label: "THANK YOU", score: 0.7 }, { label: "PLEASE", score: 0.6 }, { label: "EMERGENCY", score: 0.5 }] },
  { gesture: "GOODBYE", suggestions: [{ label: "SEE YOU TOMORROW", score: 0.8 }, { label: "THANK YOU", score: 0.5 }, { label: "GOOD NIGHT", score: 0.4 }] },
  { gesture: "SORRY", suggestions: [{ label: "THANK YOU", score: 0.6 }, { label: "PLEASE", score: 0.5 }, { label: "UNDERSTAND", score: 0.4 }] },
  { gesture: "WATER", suggestions: [{ label: "PLEASE", score: 0.8 }, { label: "THANK YOU", score: 0.6 }, { label: "DRINK", score: 0.5 }] },
  { gesture: "FOOD", suggestions: [{ label: "EAT", score: 0.8 }, { label: "RICE", score: 0.6 }, { label: "WATER", score: 0.5 }] },
  { gesture: "HOSPITAL", suggestions: [{ label: "EMERGENCY", score: 0.9 }, { label: "HELP", score: 0.8 }, { label: "DOCTOR", score: 0.7 }] },
  { gesture: "PAIN", suggestions: [{ label: "HOSPITAL", score: 0.8 }, { label: "HELP", score: 0.7 }, { label: "MEDICINE", score: 0.6 }] },
];

const INTENT_FLOW_PRIORITIES: Record<string, string[]> = {
  Greeting: ["Introduction", "Question", "Response"],
  Introduction: ["Question", "Response", "Greeting"],
  Question: ["Response", "Question", "Request"],
  Response: ["Question", "Greeting", "Farewell"],
  Request: ["Response", "Question", "Farewell"],
  Emergency: ["Response", "Healthcare", "Request"],
  Food: ["Response", "Question", "Request"],
  Healthcare: ["Response", "Emergency", "Request"],
  Education: ["Response", "Question", "Request"],
  Transportation: ["Response", "Question", "Request"],
  Farewell: ["Greeting", "Unknown", "Response"],
  Unknown: ["Greeting", "Question", "Response"],
};

const GESTURE_DISPLAY_NAMES: Record<string, string> = {
  "YOURE WELCOME": "You're Welcome",
  "THANK YOU": "Thank You",
  "SEE YOU TOMORROW": "See You Tomorrow",
  "GOOD MORNING": "Good Morning",
  "GOOD AFTERNOON": "Good Afternoon",
  "GOOD EVENING": "Good Evening",
  "HOW ARE YOU": "How Are You",
  "IM FINE": "I'm Fine",
  "NICE TO MEET YOU": "Nice to Meet You",
  "DON'T UNDERSTAND": "Don't Understand",
  "DON'T KNOW": "Don't Know",
  "HARD OF HEARING": "Hard of Hearing",
  "WEELCHAIR PERSON": "Wheelchair Person",
  "DEAF BLIND": "Deaf-Blind",
  "NO SUGAR": "No Sugar",
};

function getDisplayName(label: string): string {
  const upper = label.toUpperCase().replace(/['']/g, "'");
  if (GESTURE_DISPLAY_NAMES[upper]) return GESTURE_DISPLAY_NAMES[upper];
  return upper.charAt(0).toUpperCase() + upper.slice(1).toLowerCase();
}

export class SmartGestureSuggestions {
  private recentSuggestions: string[] = [];
  private maxRecentHistory = 10;
  private suggestionUseCount: Map<string, number> = new Map();

  getSuggestions(
    currentGesture: string,
    conversationHistory: Array<{ gestureLabel: string; intent?: ConversationIntent }>,
    maxSuggestions = 5
  ): GestureSuggestion[] {
    const normalizedGesture = currentGesture.toUpperCase().replace(/['']/g, "'");
    const suggestions: GestureSuggestion[] = [];

    const followUps = this.getFollowUpSuggestions(normalizedGesture);
    for (const s of followUps) {
      suggestions.push({ ...s, context: "follow_up" });
    }

    const recentGestures = conversationHistory.slice(-3).map(m => m.gestureLabel.toUpperCase());
    for (const recent of recentGestures) {
      if (recent !== normalizedGesture) {
        const related = this.getFollowUpSuggestions(recent);
        for (const s of related) {
          const exists = suggestions.some(e => e.label === s.label);
          if (!exists) {
            suggestions.push({ ...s, score: s.score * 0.6, context: "conversation_flow" });
          }
        }
      }
    }

    if (conversationHistory.length > 0) {
      const lastIntent = conversationHistory[conversationHistory.length - 1].intent;
      if (lastIntent && lastIntent !== "Unknown") {
        const intentFlow = INTENT_FLOW_PRIORITIES[lastIntent];
        if (intentFlow) {
          const intentGestures = this.getGesturesByIntent(lastIntent);
          for (const gesture of intentGestures) {
            const exists = suggestions.some(s => s.label === gesture);
            if (!exists && gesture !== normalizedGesture) {
              suggestions.push({
                label: gesture,
                displayName: getDisplayName(gesture),
                score: 0.3,
                context: "conversation_flow",
              });
            }
          }
        }
      }
    }

    for (const s of suggestions) {
      const useCount = this.suggestionUseCount.get(s.label) ?? 0;
      if (useCount > 0) {
        s.score = Math.min(1, s.score + useCount * 0.02);
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
    const unique = this.deduplicate(suggestions);
    return unique.slice(0, maxSuggestions);
  }

  private getFollowUpSuggestions(gesture: string): GestureSuggestion[] {
    const rule = FOLLOW_UP_SUGGESTIONS.find(s => s.gesture === gesture);
    if (!rule) return [];

    return rule.suggestions.map(s => ({
      label: s.label,
      displayName: getDisplayName(s.label),
      score: s.score,
      context: "follow_up" as const,
    }));
  }

  private getGesturesByIntent(intent: ConversationIntent): string[] {
    const map: Partial<Record<ConversationIntent, string[]>> = {
      Greeting: ["HELLO", "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING", "HOW ARE YOU", "NICE TO MEET YOU"],
      Response: ["YES", "NO", "THANK YOU", "IM FINE", "UNDERSTAND", "DON'T UNDERSTAND"],
      Farewell: ["GOODBYE", "SEE YOU TOMORROW", "THANK YOU"],
      Request: ["PLEASE", "HELP", "WANT", "NEED"],
      Food: ["FOOD", "WATER", "RICE", "BREAD", "MEAT", "FISH", "CHICKEN"],
      Emergency: ["HELP", "HOSPITAL", "PAIN", "EMERGENCY"],
    };
    return map[intent] ?? [];
  }

  private deduplicate(suggestions: GestureSuggestion[]): GestureSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(s => {
      if (seen.has(s.label)) return false;
      seen.add(s.label);
      return true;
    });
  }

  recordSuggestionUsed(label: string): void {
    const current = this.suggestionUseCount.get(label) ?? 0;
    this.suggestionUseCount.set(label, current + 1);
    this.recentSuggestions.push(label);
    if (this.recentSuggestions.length > this.maxRecentHistory) {
      this.recentSuggestions.shift();
    }
  }

  reset(): void {
    this.recentSuggestions = [];
    this.suggestionUseCount.clear();
  }
}
