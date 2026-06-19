export type ConversationIntent =
  | "Greeting"
  | "Introduction"
  | "Question"
  | "Response"
  | "Farewell"
  | "Request"
  | "Emergency"
  | "Food"
  | "Healthcare"
  | "Education"
  | "Transportation"
  | "Unknown";

export type IntentResult = {
  intent: ConversationIntent;
  confidence: number;
};

export type ContextMessage = {
  gestureLabel: string;
  translatedText: string;
  confidence: number;
  timestamp: number;
  intent?: ConversationIntent;
};

export type ScoredReply = {
  text: string;
  score: number;
  source: "gesture" | "context" | "ai" | "personalized";
};

export type QualityMetrics = {
  overallScore: number;
  avgConfidence: number;
  replySelectionRate: number;
  successfulConversations: number;
  totalConversations: number;
  correctionFrequency: number;
  gestureCount: number;
  topicDiversity: number;
};

export type ConversationSummary = {
  duration: string;
  gestureCount: number;
  topTopics: Array<{ topic: string; count: number }>;
  avgConfidence: number;
  suggestedFollowUp: string;
  transcript: Array<{ time: string; text: string }>;
};
