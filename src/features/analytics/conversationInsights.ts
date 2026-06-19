export type ConversationInsightMetrics = {
  averageConversationLength: number;
  gesturesPerMinute: number;
  communicationCompletion: number;
  correctionFrequency: number;
  confidenceTrend: number[];
  replyAcceptance: number;
  mostCommonTopics: Array<{ topic: string; count: number }>;
  totalConversations: number;
  totalGestures: number;
  totalDurationMs: number;
};

export type SessionRecord = {
  conversationId: string;
  durationMs: number;
  gestureCount: number;
  corrections: number;
  avgConfidence: number;
  repliesAccepted: number;
  repliesTotal: number;
  topic: string;
  completedSuccessfully: boolean;
  timestamps: number[];
  confidences: number[];
};

export class ConversationInsights {
  private sessions: SessionRecord[] = [];

  recordSession(session: SessionRecord): void {
    this.sessions.push(session);
  }

  getMetrics(): ConversationInsightMetrics {
    if (this.sessions.length === 0) {
      return {
        averageConversationLength: 0,
        gesturesPerMinute: 0,
        communicationCompletion: 0,
        correctionFrequency: 0,
        confidenceTrend: [],
        replyAcceptance: 0,
        mostCommonTopics: [],
        totalConversations: 0,
        totalGestures: 0,
        totalDurationMs: 0,
      };
    }

    const totalConversations = this.sessions.length;
    const totalGestures = this.sessions.reduce((s, sess) => s + sess.gestureCount, 0);
    const totalDurationMs = this.sessions.reduce((s, sess) => s + sess.durationMs, 0);
    const totalCorrections = this.sessions.reduce((s, sess) => s + sess.corrections, 0);
    const totalRepliesAccepted = this.sessions.reduce((s, sess) => s + sess.repliesAccepted, 0);
    const totalReplies = this.sessions.reduce((s, sess) => s + sess.repliesTotal, 0);
    const completedCount = this.sessions.filter(s => s.completedSuccessfully).length;

    const averageConversationLength = totalGestures / totalConversations;
    const totalDurationMinutes = totalDurationMs / 60000;
    const gesturesPerMinute = totalDurationMinutes > 0 ? totalGestures / totalDurationMinutes : 0;
    const communicationCompletion = totalConversations > 0 ? completedCount / totalConversations : 0;
    const correctionFrequency = totalGestures > 0 ? totalCorrections / totalGestures : 0;
    const replyAcceptance = totalReplies > 0 ? totalRepliesAccepted / totalReplies : 0;

    const topicMap = new Map<string, number>();
    for (const sess of this.sessions) {
      topicMap.set(sess.topic, (topicMap.get(sess.topic) ?? 0) + 1);
    }
    const mostCommonTopics = [...topicMap.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const allConfidences: number[] = [];
    for (const sess of this.sessions) {
      allConfidences.push(...sess.confidences);
    }

    const windowSize = Math.max(1, Math.floor(allConfidences.length / 10));
    const confidenceTrend: number[] = [];
    for (let i = 0; i < allConfidences.length; i += windowSize) {
      const window = allConfidences.slice(i, i + windowSize);
      const avg = window.reduce((s, v) => s + v, 0) / window.length;
      confidenceTrend.push(avg);
    }

    return {
      averageConversationLength,
      gesturesPerMinute,
      communicationCompletion,
      correctionFrequency,
      confidenceTrend,
      replyAcceptance,
      mostCommonTopics,
      totalConversations,
      totalGestures,
      totalDurationMs,
    };
  }

  getRecentSessions(count = 10): SessionRecord[] {
    return this.sessions.slice(-count);
  }

  getSessionCount(): number {
    return this.sessions.length;
  }

  reset(): void {
    this.sessions = [];
  }
}
