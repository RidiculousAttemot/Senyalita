export type SessionAnalysis = {
  gestureLabel: string;
  avgConfidence: number;
  totalRecognitions: number;
  correctionCount: number;
  rejectionCount: number;
  successfulConversations: number;
  failedConversations: number;
  trend: "improving" | "declining" | "stable";
};

export type Recommendation = {
  gestureLabel: string;
  priority: number;
  reason: string;
  suggestedAction: "collect_more_data" | "review_label" | "add_variations" | "improve_lighting" | "add_signers";
};

export type FeedbackSessionData = {
  gestureLabel: string;
  confidence: number;
  wasCorrected: boolean;
  wasRejected: boolean;
  conversationSuccessful: boolean;
  timestamp: number;
};

type GestureStats = {
  totalRecognitions: number;
  confidences: number[];
  correctionCount: number;
  rejectionCount: number;
  successfulConversations: number;
  failedConversations: number;
  lastSeen: number;
};

export class AdaptiveFeedbackEngine {
  private gestureStats: Map<string, GestureStats> = new Map();
  private recentFeedback: FeedbackSessionData[] = [];
  private maxRecentFeedback = 500;
  private analysisThreshold = 10;

  recordFeedback(data: FeedbackSessionData): void {
    const normalized = data.gestureLabel.toUpperCase().replace(/['']/g, "'");
    const stats = this.gestureStats.get(normalized) ?? {
      totalRecognitions: 0,
      confidences: [],
      correctionCount: 0,
      rejectionCount: 0,
      successfulConversations: 0,
      failedConversations: 0,
      lastSeen: 0,
    };

    stats.totalRecognitions++;
    stats.confidences.push(data.confidence);
    if (data.wasCorrected) stats.correctionCount++;
    if (data.wasRejected) stats.rejectionCount++;
    if (data.conversationSuccessful) stats.successfulConversations++;
    else stats.failedConversations++;
    stats.lastSeen = data.timestamp;

    if (stats.confidences.length > 100) {
      stats.confidences = stats.confidences.slice(-100);
    }

    this.gestureStats.set(normalized, stats);

    this.recentFeedback.push(data);
    if (this.recentFeedback.length > this.maxRecentFeedback) {
      this.recentFeedback.splice(0, this.recentFeedback.length - this.maxRecentFeedback);
    }
  }

  getRecommendations(): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const [label, stats] of this.gestureStats) {
      if (stats.totalRecognitions < this.analysisThreshold) continue;

      const avgConfidence = stats.confidences.reduce((s, v) => s + v, 0) / stats.confidences.length;
      const correctionRate = stats.correctionCount / stats.totalRecognitions;
      const rejectionRate = stats.rejectionCount / stats.totalRecognitions;
      const totalConversations = stats.successfulConversations + stats.failedConversations;
      const successRate = totalConversations > 0 ? stats.successfulConversations / totalConversations : 0;

      if (avgConfidence < 0.6) {
        recommendations.push({
          gestureLabel: label,
          priority: Math.round((1 - avgConfidence) * 100),
          reason: `Low average confidence (${(avgConfidence * 100).toFixed(0)}%). Needs more training data.`,
          suggestedAction: "collect_more_data",
        });
      }

      if (correctionRate > 0.3) {
        recommendations.push({
          gestureLabel: label,
          priority: Math.round(correctionRate * 100),
          reason: `High correction rate (${(correctionRate * 100).toFixed(0)}%). Label may be confusing.`,
          suggestedAction: "review_label",
        });
      }

      if (rejectionRate > 0.2) {
        recommendations.push({
          gestureLabel: label,
          priority: Math.round(rejectionRate * 100),
          reason: `High rejection rate (${(rejectionRate * 100).toFixed(0)}%). Users reject suggestions.`,
          suggestedAction: "add_variations",
        });
      }

      if (successRate < 0.5 && totalConversations > 3) {
        recommendations.push({
          gestureLabel: label,
          priority: Math.round((1 - successRate) * 80),
          reason: `Low conversation success rate (${(successRate * 100).toFixed(0)}%). May need clearer gesture definition.`,
          suggestedAction: "add_signers",
        });
      }
    }

    recommendations.sort((a, b) => b.priority - a.priority);
    return recommendations.slice(0, 20);
  }

  getGestureAnalysis(gestureLabel: string): SessionAnalysis | null {
    const normalized = gestureLabel.toUpperCase().replace(/['']/g, "'");
    const stats = this.gestureStats.get(normalized);
    if (!stats || stats.totalRecognitions < 3) return null;

    const avgConfidence = stats.confidences.reduce((s, v) => s + v, 0) / stats.confidences.length;
    const trend = this.calculateTrend(stats.confidences);

    return {
      gestureLabel: normalized,
      avgConfidence,
      totalRecognitions: stats.totalRecognitions,
      correctionCount: stats.correctionCount,
      rejectionCount: stats.rejectionCount,
      successfulConversations: stats.successfulConversations,
      failedConversations: stats.failedConversations,
      trend,
    };
  }

  private calculateTrend(confidences: number[]): "improving" | "declining" | "stable" {
    if (confidences.length < 5) return "stable";
    const recent = confidences.slice(-5);
    const older = confidences.slice(-10, -5);
    if (older.length === 0) return "stable";

    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;

    if (recentAvg > olderAvg + 0.05) return "improving";
    if (recentAvg < olderAvg - 0.05) return "declining";
    return "stable";
  }

  getAllAnalyses(): SessionAnalysis[] {
    const analyses: SessionAnalysis[] = [];
    for (const [label] of this.gestureStats) {
      const analysis = this.getGestureAnalysis(label);
      if (analysis) analyses.push(analysis);
    }
    return analyses.sort((a, b) => a.avgConfidence - b.avgConfidence);
  }

  getDatasetPrioritization(): Array<{ gestureLabel: string; priority: number; reason: string }> {
    const recommendations = this.getRecommendations();
    return recommendations.map(r => ({
      gestureLabel: r.gestureLabel,
      priority: r.priority,
      reason: r.reason,
    }));
  }

  reset(): void {
    this.gestureStats.clear();
    this.recentFeedback = [];
  }
}
