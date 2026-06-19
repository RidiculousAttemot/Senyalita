import { QualityMetrics } from "./types";

export type QualityMetricsV2 = QualityMetrics & {
  responseDelay: number;
  communicationCompletion: number;
  conversationDuration: number;
  successfulExchanges: number;
  totalExchanges: number;
  lowConfidenceRate: number;
  exchangeSuccessRate: number;
  communicationSpeed: number;
};

export class QualityScoreTracker {
  private totalConversations = 0;
  private successfulConversations = 0;
  private totalGestures = 0;
  private totalConfidence = 0;
  private replySelections = 0;
  private corrections = 0;
  private topicsSeen = new Set<string>();
  private gestureHistory: Array<{ label: string; confidence: number; topic: string }> = [];
  private window: number[] = [];

  private responseDelays: number[] = [];
  private lowConfidenceCount = 0;
  private successfulExchanges = 0;
  private totalExchanges = 0;
  private conversationStartTime: number = Date.now();
  private completedConversations = 0;

  recordGesture(label: string, confidence: number, topic: string): void {
    this.totalGestures++;
    this.totalConfidence += confidence;
    this.gestureHistory.push({ label, confidence, topic });
    this.topicsSeen.add(topic);

    this.window.push(confidence);
    if (this.window.length > 50) this.window.shift();

    if (confidence < 0.5) {
      this.lowConfidenceCount++;
    }
  }

  recordReplySelection(): void {
    this.replySelections++;
  }

  recordCorrection(): void {
    this.corrections++;
  }

  recordConversation(successful: boolean): void {
    this.totalConversations++;
    if (successful) this.successfulConversations++;
  }

  recordResponseDelay(delayMs: number): void {
    this.responseDelays.push(delayMs);
    if (this.responseDelays.length > 100) this.responseDelays.shift();
  }

  recordExchange(successful: boolean): void {
    this.totalExchanges++;
    if (successful) this.successfulExchanges++;
  }

  recordConversationCompletion(): void {
    this.completedConversations++;
  }

  reset(): void {
    this.totalGestures = 0;
    this.totalConfidence = 0;
    this.replySelections = 0;
    this.corrections = 0;
    this.totalConversations = 0;
    this.successfulConversations = 0;
    this.topicsSeen.clear();
    this.gestureHistory = [];
    this.window = [];
    this.responseDelays = [];
    this.lowConfidenceCount = 0;
    this.successfulExchanges = 0;
    this.totalExchanges = 0;
    this.conversationStartTime = Date.now();
    this.completedConversations = 0;
  }

  getMetrics(): QualityMetrics {
    const avgConfidence = this.totalGestures > 0
      ? this.totalConfidence / this.totalGestures
      : 0;

    const replySelectionRate = this.totalGestures > 0
      ? this.replySelections / this.totalGestures
      : 0;

    const correctionFrequency = this.totalGestures > 0
      ? this.corrections / this.totalGestures
      : 0;

    const topicDiversity = this.topicsSeen.size;

    const confidenceScore = avgConfidence * 40;
    const replyScore = Math.min(replySelectionRate * 20, 20);
    const correctionPenalty = Math.min(correctionFrequency * 30, 20);
    const topicScore = Math.min(topicDiversity * 5, 10);
    const successRate = this.totalConversations > 0
      ? (this.successfulConversations / this.totalConversations) * 20
      : 15;

    const overallScore = Math.round(
      Math.max(0, confidenceScore + replyScore + topicScore + successRate - correctionPenalty)
    );

    return {
      overallScore,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      replySelectionRate,
      successfulConversations: this.successfulConversations,
      totalConversations: this.totalConversations,
      correctionFrequency,
      gestureCount: this.totalGestures,
      topicDiversity,
    };
  }

  getMetricsV2(): QualityMetricsV2 {
    const base = this.getMetrics();
    const avgDelay = this.responseDelays.length > 0
      ? this.responseDelays.reduce((a, b) => a + b, 0) / this.responseDelays.length
      : 0;

    const completionRate = this.totalConversations > 0
      ? this.completedConversations / this.totalConversations
      : 0;

    const duration = (Date.now() - this.conversationStartTime) / 1000;

    const lowConfRate = this.totalGestures > 0
      ? this.lowConfidenceCount / this.totalGestures
      : 0;

    const exchangeSuccessRate = this.totalExchanges > 0
      ? this.successfulExchanges / this.totalExchanges
      : 0;

    return {
      ...base,
      responseDelay: avgDelay,
      communicationCompletion: completionRate,
      conversationDuration: duration,
      successfulExchanges: this.successfulExchanges,
      totalExchanges: this.totalExchanges,
      lowConfidenceRate: lowConfRate,
      exchangeSuccessRate,
      communicationSpeed: this.totalExchanges > 0 && duration > 0
        ? this.totalExchanges / (duration / 60)
        : 0,
    };
  }
}
