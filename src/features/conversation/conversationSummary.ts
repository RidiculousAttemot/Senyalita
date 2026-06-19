import { ContextMessage, ConversationSummary, ConversationIntent } from "./types";
import { detectIntent } from "./intentEngine";

export const generateSummary = (
  messages: ContextMessage[],
  startTime: number,
  endTime: number
): ConversationSummary => {
  if (messages.length === 0) {
    return {
      duration: "0 minutes",
      gestureCount: 0,
      topTopics: [],
      avgConfidence: 0,
      suggestedFollowUp: "Start a conversation to receive suggestions.",
      transcript: [],
    };
  }

  const durationMs = endTime - startTime;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  const duration = minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`;

  const topicCounts = new Map<string, number>();
  let totalConfidence = 0;
  const transcript: Array<{ time: string; text: string }> = [];

  for (const msg of messages) {
    const intent = detectIntent(msg.gestureLabel);
    if (intent.intent !== "Unknown") {
      topicCounts.set(intent.intent, (topicCounts.get(intent.intent) ?? 0) + 1);
    }
    totalConfidence += msg.confidence;

    const msgTime = new Date(msg.timestamp).toLocaleTimeString("en-US", {
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    transcript.push({ time: msgTime, text: msg.translatedText });
  }

  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic, count]) => ({ topic, count }));

  const avgConfidence = Math.round((totalConfidence / messages.length) * 100) / 100;

  const suggestedFollowUp = generateFollowUp(topTopics.map(t => t.topic));

  return {
    duration,
    gestureCount: messages.length,
    topTopics,
    avgConfidence,
    suggestedFollowUp,
    transcript,
  };
};

const generateFollowUp = (topics: string[]): string => {
  if (topics.includes("Healthcare")) {
    return "Practice healthcare vocabulary. Consider learning: hospital, doctor, medicine, pain.";
  }
  if (topics.includes("Food")) {
    return "Explore food-related signs. Try: menu, restaurant, order, delicious.";
  }
  if (topics.includes("Education")) {
    return "Continue with education vocabulary. Try: teacher, exam, homework, study.";
  }
  if (topics.includes("Transportation")) {
    return "Practice transportation signs. Try: bus, jeepney, destination, ticket.";
  }
  if (topics.includes("Emergency")) {
    return "Review emergency signs. Ensure you know: help, hospital, police, fire.";
  }
  if (topics.includes("Greeting") || topics.includes("Introduction")) {
    return "Build on conversation basics. Try: how are you, my name is, nice to meet you.";
  }
  return "Practice more gestures to build your vocabulary. Try common phrases like greetings and questions.";
};

export const formatSummary = (summary: ConversationSummary): string => {
  const lines = [
    "Conversation Summary",
    "",
    `Duration: ${summary.duration}`,
    `Gestures: ${summary.gestureCount}`,
    `Average Confidence: ${(summary.avgConfidence * 100).toFixed(0)}%`,
    "",
    "Top Topics:",
  ];

  for (const topic of summary.topTopics) {
    lines.push(`  ${topic.topic} (${topic.count}x)`);
  }

  if (summary.topTopics.length === 0) {
    lines.push("  None detected");
  }

  lines.push("");
  lines.push(`Suggested Follow-up: ${summary.suggestedFollowUp}`);
  lines.push("");

  return lines.join("\n");
};
