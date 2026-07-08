import { ConversationIntent, IntentResult, ContextMessage } from "./types";

const INTENT_KEYWORDS: Record<ConversationIntent, string[]> = {
  Greeting: ["hello", "hi", "good morning", "good afternoon", "good evening", "hey", "how are you", "nice to meet you"],
  Introduction: ["my name", "i am", "im", "meet", "introduce", "call me", "this is"],
  Question: ["what", "who", "where", "when", "why", "how", "which", "can i", "do you", "is there", "are you"],
  Response: ["yes", "no", "okay", "fine", "good", "great", "i understand", "i see", "i agree", "sure", "of course", "im fine", "thank you"],
  Farewell: ["goodbye", "bye", "see you", "later", "take care", "see you tomorrow", "good night"],
  Request: ["please", "help", "can you", "i need", "want", "give", "may i", "could you", "would you"],
  Emergency: ["help", "emergency", "danger", "accident", "fire", "earthquake", "flood", "typhoon", "hospital", "police", "ambulance", "sick", "hurt", "pain"],
  Food: ["food", "eat", "drink", "water", "rice", "bread", "meat", "fish", "chicken", "coffee", "tea", "juice", "milk", "hungry", "thirsty", "restaurant", "menu"],
  Healthcare: ["doctor", "nurse", "hospital", "clinic", "medicine", "sick", "pain", "fever", "cold", "flu", "checkup", "health", "dentist", "pharmacy"],
  Education: ["school", "teacher", "student", "class", "lesson", "study", "learn", "exam", "test", "homework", "book", "read", "write", "university", "college"],
  Transportation: ["car", "bus", "jeepney", "tricycle", "taxi", "train", "airport", "station", "ticket", "fare", "destination", "go", "come", "travel", "ride"],
  Confirmation: ["yes", "no", "correct", "wrong", "understand", "don't understand", "agree", "confirm"],
  Time: ["today", "tomorrow", "yesterday", "now", "later", "soon", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "time", "schedule"],
  Description: ["hot", "cold", "slow", "fast", "light", "dark", "big", "small", "good", "bad", "beautiful", "ugly", "old", "new"],
  Color: ["red", "blue", "green", "yellow", "orange", "brown", "black", "white", "gray", "pink", "violet", "color"],
  Family: ["father", "mother", "son", "daughter", "grandfather", "grandmother", "uncle", "auntie", "cousin", "parents", "family", "sibling"],
  Number: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "number", "count"],
  Drink: ["water", "juice", "milk", "coffee", "tea", "beer", "wine", "drink", "beverage"],
  Unknown: [],
};

export const detectIntent = (gestureLabel: string): IntentResult => {
  const label = gestureLabel.toLowerCase().trim();

  const scores: Array<{ intent: ConversationIntent; score: number }> = [];

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === "Unknown") continue;

    for (const keyword of keywords) {
      if (label === keyword || label.includes(keyword)) {
        const confidence = label === keyword ? 0.95 : 0.75;
        scores.push({ intent: intent as ConversationIntent, score: confidence });
        break;
      }
    }
  }

  if (scores.length === 0) {
    return { intent: "Unknown", confidence: 0 };
  }

  scores.sort((a, b) => b.score - a.score);
  return { intent: scores[0].intent, confidence: scores[0].score };
};

export const detectIntentFromContext = (messages: ContextMessage[]): IntentResult => {
  if (messages.length === 0) {
    return { intent: "Unknown", confidence: 0 };
  }

  const recentMessages = messages.slice(-5);
  const intentScores = new Map<ConversationIntent, number>();

  for (const msg of recentMessages) {
    const result = detectIntent(msg.gestureLabel);
    if (result.intent !== "Unknown") {
      const weighted = result.confidence * (1 + msg.confidence) / 2;
      intentScores.set(result.intent, (intentScores.get(result.intent) ?? 0) + weighted);
    }
  }

  if (intentScores.size === 0) {
    return { intent: "Unknown", confidence: 0 };
  }

  let bestIntent: ConversationIntent = "Unknown";
  let bestScore = 0;
  let totalScore = 0;

  for (const [intent, score] of intentScores) {
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  return {
    intent: bestIntent,
    confidence: totalScore > 0 ? bestScore / totalScore : 0,
  };
};

