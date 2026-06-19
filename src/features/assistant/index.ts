import { ContextMemory } from "@/features/conversation/contextMemory";
import { ReplyRanker, CONTEXTUAL_REPLIES, ExtendedRankingContext, ReplyAcceptanceEntry } from "@/features/conversation/replyRanker";
import { QualityScoreTracker, QualityMetricsV2 } from "@/features/conversation/qualityScore";
import { detectIntent, detectIntentFromContext } from "@/features/conversation/intentEngine";
import { generateSummary, formatSummary } from "@/features/conversation/conversationSummary";
import { ConversationFlowPredictor } from "@/features/conversation/flowPrediction";
import type { ConversationIntent, IntentResult, QualityMetrics, ConversationSummary, ScoredReply, ContextMessage } from "@/features/conversation/types";
import type { FlowPrediction } from "@/features/conversation/flowPrediction";

export type AssistantConfig = {
  language: "en" | "tl";
  userId?: string;
};

export class ConversationAssistant {
  private context: ContextMemory;
  private replyRanker: ReplyRanker;
  private qualityTracker: QualityScoreTracker;
  private config: AssistantConfig;
  private sessionStartTime: number = Date.now();
  private flowPredictor: ConversationFlowPredictor;
  private previousReplies: string[] = [];
  private replyAcceptanceHistory: ReplyAcceptanceEntry[] = [];
  private phraseFrequency: Map<string, number> = new Map();
  private conversationTopic: string | undefined;
  private communicationSuccessCount = 0;
  private communicationTotalCount = 0;

  constructor(config: AssistantConfig) {
    this.context = new ContextMemory();
    this.replyRanker = new ReplyRanker();
    this.qualityTracker = new QualityScoreTracker();
    this.flowPredictor = new ConversationFlowPredictor();
    this.config = config;
    this.sessionStartTime = Date.now();
  }

  recordGesture(gestureLabel: string, translatedText: string, confidence: number): void {
    const intent = detectIntent(gestureLabel);
    this.context.addMessage(gestureLabel, translatedText, confidence, intent.intent);
    this.qualityTracker.recordGesture(gestureLabel, confidence, intent.intent !== "Unknown" ? intent.intent : "Unknown");

    if (intent.intent !== "Unknown") {
      this.conversationTopic = intent.intent;
    }
  }

  getCurrentIntent(): IntentResult {
    const context = this.context.getContext();
    if (context.length === 0) return { intent: "Unknown", confidence: 0 };
    return detectIntentFromContext(context);
  }

  getContext(): ContextMessage[] {
    return this.context.getContext();
  }

  getRecentContext(count = 3): ContextMessage[] {
    return this.context.getRecentContext(count);
  }

  rankReplies(
    gestureLabel: string,
    availableReplies: Array<{ text: string; gestureLabel: string; videoUrl: string | null; priority: number; contextTags: string[] }>,
    userHistory?: { selectedReplies: string[] }
  ): ScoredReply[] {
    const context = this.context.getContext();

    const extendedContext: ExtendedRankingContext = {
      previousReplies: this.previousReplies,
      replyAcceptanceHistory: this.replyAcceptanceHistory,
      communicationSuccessRate: this.communicationTotalCount > 0
        ? this.communicationSuccessCount / this.communicationTotalCount
        : undefined,
      conversationTopic: this.conversationTopic,
      phraseFrequency: this.phraseFrequency,
    };

    return this.replyRanker.rank(gestureLabel, availableReplies, context, this.config.language, userHistory, extendedContext);
  }

  getContextualReplies(intent: ConversationIntent): string[] {
    return CONTEXTUAL_REPLIES[intent] ?? [];
  }

  recordReplySelection(replyText: string, accepted: boolean = true): void {
    this.qualityTracker.recordReplySelection();
    this.previousReplies.push(replyText);
    if (this.previousReplies.length > 20) this.previousReplies.shift();

    this.replyAcceptanceHistory.push({
      replyText,
      wasAccepted: accepted,
      contextTopic: this.conversationTopic,
    });

    const current = this.phraseFrequency.get(replyText) ?? 0;
    this.phraseFrequency.set(replyText, current + 1);
  }

  recordCorrection(): void {
    this.qualityTracker.recordCorrection();
  }

  recordConversation(successful: boolean): void {
    this.qualityTracker.recordConversation(successful);
    this.communicationTotalCount++;
    if (successful) this.communicationSuccessCount++;
  }

  recordResponseDelay(delayMs: number): void {
    this.qualityTracker.recordResponseDelay(delayMs);
  }

  recordExchange(successful: boolean): void {
    this.qualityTracker.recordExchange(successful);
  }

  getQualityScore(): QualityMetrics {
    return this.qualityTracker.getMetrics();
  }

  getQualityScoreV2(): QualityMetricsV2 {
    return this.qualityTracker.getMetricsV2();
  }

  getConversationSummary(): ConversationSummary {
    return generateSummary(
      this.context.getContext(),
      this.sessionStartTime,
      Date.now()
    );
  }

  getFormattedSummary(): string {
    return formatSummary(this.getConversationSummary());
  }

  resetSession(): void {
    this.context.clearContext();
    this.qualityTracker.reset();
    this.sessionStartTime = Date.now();
    this.previousReplies = [];
    this.replyAcceptanceHistory = [];
    this.phraseFrequency.clear();
    this.conversationTopic = undefined;
  }

  getTopics(): string[] {
    return this.context.getTopics();
  }

  getFlowPredictions(): FlowPrediction[] {
    return this.flowPredictor.predict(this.context.getContext(), this.conversationTopic);
  }

  getNextGestureSuggestions(maxCount = 5): Array<{ label: string; score: number; intent: ConversationIntent }> {
    return this.flowPredictor.predictNextGestures(this.context.getContext(), this.conversationTopic, maxCount);
  }
}
