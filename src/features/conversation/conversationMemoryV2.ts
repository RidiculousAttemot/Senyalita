import type { ConversationIntent } from "./types";

type ConversationState = "idle" | "greeting" | "introduction" | "questioning" | "responding" | "requesting" | "farewell" | "emergency" | "food_discussion" | "healthcare" | "education" | "transportation";

type ConversationTopic = {
  topic: string;
  confidence: number;
  lastMentioned: number;
  mentionCount: number;
};

type QuestionEntry = {
  question: string;
  timestamp: number;
  answered: boolean;
  replyGiven?: string;
  contextTopic?: string;
};

type ReplyEntry = {
  reply: string;
  timestamp: number;
  toQuestion?: string;
  wasAccepted: boolean;
};

type MessageEntry = {
  speaker: "user" | "assistant";
  text: string;
  gestureLabel?: string;
  confidence: number;
  intent: ConversationIntent;
  timestamp: number;
};

export class ConversationMemoryV2 {
  private currentTopic: ConversationTopic | null = null;
  private previousQuestions: QuestionEntry[] = [];
  private previousReplies: ReplyEntry[] = [];
  private conversationState: ConversationState = "idle";
  private messages: MessageEntry[] = [];
  private topicHistory: ConversationTopic[] = [];
  private maxQuestions = 20;
  private maxReplies = 20;
  private maxMessages = 50;
  private sessionStartTime: number = Date.now();
  private lastActivityTime: number = Date.now();

  addMessage(
    speaker: "user" | "assistant",
    text: string,
    intent: ConversationIntent,
    confidence: number,
    gestureLabel?: string
  ): void {
    const now = Date.now();
    this.messages.push({
      speaker,
      text,
      gestureLabel,
      confidence,
      intent,
      timestamp: now,
    });
    this.lastActivityTime = now;

    if (this.messages.length > this.maxMessages) {
      this.messages.splice(0, this.messages.length - this.maxMessages);
    }

    this.updateTopic(intent);
    this.updateState(intent);

    if (speaker === "user" && this.isQuestionText(text)) {
      this.previousQuestions.push({
        question: text,
        timestamp: now,
        answered: false,
        contextTopic: this.currentTopic?.topic,
      });
      if (this.previousQuestions.length > this.maxQuestions) {
        this.previousQuestions.splice(0, 1);
      }
    }

    if (speaker === "assistant") {
      this.previousReplies.push({
        reply: text,
        timestamp: now,
        toQuestion: this.getLastUnansweredQuestion()?.question,
        wasAccepted: false,
      });
      if (this.previousReplies.length > this.maxReplies) {
        this.previousReplies.splice(0, 1);
      }
    }
  }

  markReplyAccepted(replyText: string): void {
    const entry = this.previousReplies.find(r => r.reply === replyText);
    if (entry) {
      entry.wasAccepted = true;
    }
  }

  markQuestionAnswered(question: string): void {
    const entry = this.previousQuestions.find(q => q.question === question);
    if (entry) {
      entry.answered = true;
    }
  }

  isQuestionText(text: string): boolean {
    return /^(how|what|where|when|why|who|which|can|do|is|are|will|would|could|should|may|have|has|does)\b/i.test(text.trim()) || text.trim().endsWith("?");
  }

  private getLastUnansweredQuestion(): QuestionEntry | undefined {
    return [...this.previousQuestions].reverse().find(q => !q.answered);
  }

  private updateTopic(intent: ConversationIntent): void {
    const now = Date.now();
    if (intent === "Unknown") return;

    if (this.currentTopic && this.currentTopic.topic === intent) {
      this.currentTopic.mentionCount++;
      this.currentTopic.lastMentioned = now;
      this.currentTopic.confidence = Math.min(1, this.currentTopic.confidence + 0.1);
    } else if (this.currentTopic) {
      this.currentTopic.confidence -= 0.05;
      if (this.currentTopic.confidence <= 0) {
        this.topicHistory.push(this.currentTopic);
        this.currentTopic = { topic: intent, confidence: 0.6, lastMentioned: now, mentionCount: 1 };
      } else {
        const existing = this.topicHistory.find(t => t.topic === intent);
        if (existing) {
          existing.mentionCount++;
          existing.lastMentioned = now;
          existing.confidence = Math.min(1, existing.confidence + 0.15);
        }
        const newTopic: ConversationTopic = { topic: intent, confidence: 0.5, lastMentioned: now, mentionCount: 1 };
        this.currentTopic = newTopic;
      }
    } else {
      this.currentTopic = { topic: intent, confidence: 0.6, lastMentioned: now, mentionCount: 1 };
    }
  }

  private updateState(intent: ConversationIntent): void {
    const stateMap: Partial<Record<ConversationIntent, ConversationState>> = {
      Greeting: "greeting",
      Introduction: "introduction",
      Question: "questioning",
      Response: "responding",
      Request: "requesting",
      Farewell: "farewell",
      Emergency: "emergency",
      Food: "food_discussion",
      Healthcare: "healthcare",
      Education: "education",
      Transportation: "transportation",
    };

    const newState = stateMap[intent];
    if (newState) {
      this.conversationState = newState;
    }
  }

  getCurrentTopic(): string | null {
    return this.currentTopic?.topic ?? null;
  }

  getCurrentTopicConfidence(): number {
    return this.currentTopic?.confidence ?? 0;
  }

  getConversationState(): ConversationState {
    return this.conversationState;
  }

  getUnansweredQuestions(): QuestionEntry[] {
    return this.previousQuestions.filter(q => !q.answered);
  }

  getRecentQuestions(count = 3): QuestionEntry[] {
    return this.previousQuestions.slice(-count);
  }

  getRecentReplies(count = 5): ReplyEntry[] {
    return this.previousReplies.slice(-count);
  }

  getRecentMessages(count = 5): MessageEntry[] {
    return this.messages.slice(-count);
  }

  getLastUserMessage(): MessageEntry | undefined {
    return [...this.messages].reverse().find(m => m.speaker === "user");
  }

  getLastAssistantMessage(): MessageEntry | undefined {
    return [...this.messages].reverse().find(m => m.speaker === "assistant");
  }

  getSuggestedPriorities(): string[] {
    const priorities: string[] = [];

    const unanswered = this.getUnansweredQuestions();
    if (unanswered.length > 0) {
      const last = unanswered[unanswered.length - 1];
      if (last.contextTopic === "Greeting" || last.contextTopic === "Response") {
        priorities.push("Wellbeing", "Status update", "How about you?");
      } else if (last.contextTopic === "Food") {
        priorities.push("Food recommendation", "Restaurant suggestion", "Recipe");
      } else if (last.contextTopic === "Healthcare") {
        priorities.push("Health advice", "Doctor recommendation", "Medicine info");
      } else if (last.contextTopic === "Education") {
        priorities.push("Study tip", "Learning resource", "Practice session");
      } else if (last.contextTopic === "Transportation") {
        priorities.push("Direction", "Route info", "Schedule");
      } else {
        priorities.push("Answer the question", "Follow up", "Ask for clarification");
      }
    }

    if (this.currentTopic?.topic === "Greeting") {
      priorities.unshift("That's good to hear", "I'm glad you're okay", "How about you?");
    } else if (this.currentTopic?.topic === "Food") {
      priorities.unshift("That sounds good", "I'm hungry too", "Where should we eat?");
    } else if (this.currentTopic?.topic === "Farewell") {
      priorities.unshift("See you later", "Take care", "Goodbye");
    }

    return [...new Set(priorities)];
  }

  getSessionDuration(): number {
    return Date.now() - this.sessionStartTime;
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  getTopicHistory(): ConversationTopic[] {
    return this.topicHistory;
  }

  getFullContext(): {
    currentTopic: string | null;
    state: ConversationState;
    unansweredQuestions: number;
    recentMessages: MessageEntry[];
    suggestedPriorities: string[];
    messageCount: number;
    sessionDurationMs: number;
  } {
    return {
      currentTopic: this.getCurrentTopic(),
      state: this.conversationState,
      unansweredQuestions: this.getUnansweredQuestions().length,
      recentMessages: this.getRecentMessages(5),
      suggestedPriorities: this.getSuggestedPriorities(),
      messageCount: this.getMessageCount(),
      sessionDurationMs: this.getSessionDuration(),
    };
  }

  reset(): void {
    this.currentTopic = null;
    this.previousQuestions = [];
    this.previousReplies = [];
    this.conversationState = "idle";
    this.messages = [];
    this.topicHistory = [];
    this.sessionStartTime = Date.now();
    this.lastActivityTime = Date.now();
  }

  get allMessages(): MessageEntry[] {
    return [...this.messages];
  }
}
