import type { ContextMessage, ConversationIntent } from "./types";
import { detectIntent } from "./intentEngine";

const TRANSITION_PROBABILITIES: Record<string, Record<string, number>> = {
  Greeting: { Introduction: 0.4, Question: 0.3, Response: 0.2, Unknown: 0.1 },
  Introduction: { Question: 0.35, Response: 0.3, Greeting: 0.2, Food: 0.1, Education: 0.05 },
  Question: { Response: 0.5, Question: 0.2, Request: 0.15, Food: 0.1, Healthcare: 0.05 },
  Response: { Question: 0.35, Greeting: 0.2, Farewell: 0.2, Request: 0.15, Food: 0.1 },
  Request: { Response: 0.4, Question: 0.2, Farewell: 0.15, Food: 0.15, Healthcare: 0.1 },
  Emergency: { Response: 0.5, Healthcare: 0.25, Request: 0.15, Question: 0.1 },
  Food: { Response: 0.3, Question: 0.3, Request: 0.2, Farewell: 0.1, Greeting: 0.1 },
  Healthcare: { Response: 0.4, Emergency: 0.2, Request: 0.2, Question: 0.15, Farewell: 0.05 },
  Education: { Response: 0.35, Question: 0.3, Request: 0.2, Greeting: 0.1, Farewell: 0.05 },
  Transportation: { Response: 0.35, Question: 0.3, Request: 0.2, Greeting: 0.1, Food: 0.05 },
  Farewell: { Greeting: 0.5, Unknown: 0.3, Response: 0.2 },
  Unknown: { Greeting: 0.3, Question: 0.25, Response: 0.2, Request: 0.15, Farewell: 0.1 },
};

const GESTURES_BY_INTENT: Record<ConversationIntent, string[]> = {
  Greeting: ["Hello", "Good Morning", "Good Afternoon", "Good Evening", "How Are You", "Nice to Meet You"],
  Introduction: ["I'm Fine", "My name", "Deaf", "Hard of Hearing", "Boy", "Girl", "Man", "Woman"],
  Question: ["What", "Who", "Where", "When", "Why", "How", "Which"],
  Response: ["Yes", "No", "Okay", "Fine", "Good", "Thank You", "You're Welcome", "Understand", "Don't Know"],
  Farewell: ["Goodbye", "See You Tomorrow", "Take Care"],
  Request: ["Please", "Help", "Need", "Give", "Want"],
  Emergency: ["Help", "Emergency", "Hospital", "Police", "Pain", "Sick", "Accident"],
  Food: ["Food", "Eat", "Drink", "Water", "Rice", "Bread", "Meat", "Fish", "Chicken", "Coffee", "Juice", "Milk", "Hungry", "Thirsty"],
  Healthcare: ["Doctor", "Nurse", "Hospital", "Medicine", "Sick", "Pain", "Fever", "Cold", "Health"],
  Education: ["School", "Teacher", "Student", "Class", "Lesson", "Study", "Learn", "Book", "Read", "Write"],
  Transportation: ["Car", "Bus", "Jeepney", "Taxi", "Train", "Airport", "Station", "Ticket", "Go", "Come", "Travel"],
  Unknown: [],
};

export type FlowPrediction = {
  predictedIntent: ConversationIntent;
  probability: number;
  suggestedGestures: Array<{ label: string; score: number }>;
};

export class ConversationFlowPredictor {
  predict(
    recentGestures: ContextMessage[],
    currentTopic?: string
  ): FlowPrediction[] {
    if (recentGestures.length === 0) {
      return [{
        predictedIntent: "Greeting",
        probability: 0.5,
        suggestedGestures: GESTURES_BY_INTENT.Greeting.slice(0, 3).map(label => ({ label, score: 0.5 })),
      }];
    }

    const lastIntent = detectIntent(recentGestures[recentGestures.length - 1].gestureLabel);
    const transitions = TRANSITION_PROBABILITIES[lastIntent.intent];
    if (!transitions) return [];

    const total = Object.values(transitions).reduce((s, v) => s + v, 0);
    const predictions: FlowPrediction[] = [];

    for (const [intent, prob] of Object.entries(transitions)) {
      const normalizedProb = prob / total;
      const intentKey = intent as ConversationIntent;
      const gestures = GESTURES_BY_INTENT[intentKey] ?? [];
      const topicBoost = currentTopic && intent === currentTopic ? 0.15 : 0;

      predictions.push({
        predictedIntent: intentKey,
        probability: Math.min(normalizedProb + topicBoost, 1),
        suggestedGestures: gestures.slice(0, 4).map(label => ({
          label,
          score: normalizedProb * (intent === lastIntent.intent ? 0.6 : 0.4),
        })),
      });
    }

    predictions.sort((a, b) => b.probability - a.probability);
    return predictions.slice(0, 3);
  }

  predictNextGestures(
    recentGestures: ContextMessage[],
    currentTopic?: string,
    maxSuggestions = 5
): Array<{ label: string; score: number; intent: ConversationIntent }> {
    const flowPredictions = this.predict(recentGestures, currentTopic);
    const allSuggestions: Array<{ label: string; score: number; intent: ConversationIntent }> = [];

    for (const pred of flowPredictions) {
      for (const gesture of pred.suggestedGestures) {
        if (!allSuggestions.some(s => s.label === gesture.label)) {
          allSuggestions.push({
            label: gesture.label,
            score: gesture.score * pred.probability,
            intent: pred.predictedIntent,
          });
        }
      }
    }

    allSuggestions.sort((a, b) => b.score - a.score);
    return allSuggestions.slice(0, maxSuggestions);
  }
}
