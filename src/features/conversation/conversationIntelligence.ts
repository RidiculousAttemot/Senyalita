import type { ContextMessage, QualityMetrics } from "../conversation/types";

export type ConversationIntelligenceReport = {
  totalConversations: number;
  successfulConversations: number;
  stalledConversations: number;
  repeatedClarifications: number;
  misunderstoodGestures: number;
  averageResponseTime: number;
  communicationEfficiency: number;
  qualityIndex: number;
  trends: {
    dailySuccessRate: number[];
    dailyAvgConfidence: number[];
    dailyMessageCount: number[];
    dailyClarificationRate: number[];
  };
  topMisunderstoodGestures: Array<{ label: string; count: number }>;
  recommendations: string[];
};

export type ConversationQualityIndex = {
  overall: number;
  factors: {
    communicationSuccess: number;
    confidenceQuality: number;
    efficiency: number;
    clarity: number;
    engagement: number;
  };
};

export class ConversationIntelligenceAnalyzer {
  analyze(
    sessions: Array<{
      id: string;
      startedAt: string;
      endedAt?: string;
      totalMessages: number;
      communicationSuccess: boolean | null;
      messages?: Array<{
        gestureLabel: string;
        confidence: number;
        senderType: string;
        isSelectedReply: boolean;
        createdAt: string;
      }>;
    }>,
    qualityMetrics?: QualityMetrics
  ): ConversationIntelligenceReport {
    const totalConversations = sessions.length;
    const successfulConversations = sessions.filter((s) => s.communicationSuccess === true).length;
    const stalledConversations = sessions.filter(
      (s) => s.totalMessages <= 2 && s.communicationSuccess !== true
    ).length;

    let totalClarifications = 0;
    const gestureClarificationMap: Record<string, number> = {};
    let totalResponseDelay = 0;
    let responseDelayCount = 0;
    let totalLowConfMessages = 0;
    let totalMessages = 0;

    const dailyBuckets: Record<string, { success: number; total: number; confSum: number; confCount: number; msgCount: number; clarifications: number }> = {};

    for (const session of sessions) {
      const day = session.startedAt?.slice(0, 10) ?? "unknown";
      if (!dailyBuckets[day]) {
        dailyBuckets[day] = { success: 0, total: 0, confSum: 0, confCount: 0, msgCount: 0, clarifications: 0 };
      }
      dailyBuckets[day].total++;
      dailyBuckets[day].msgCount += session.totalMessages ?? 0;
      if (session.communicationSuccess === true) {
        dailyBuckets[day].success++;
      }

      if (session.messages) {
        let clarificationCount = 0;
        const seenGestures = new Set<string>();
        let msgIdx = 0;

        for (const msg of session.messages) {
          dailyBuckets[day].confSum += msg.confidence;
          dailyBuckets[day].confCount++;
          totalMessages++;

          if (msg.confidence < 0.5) {
            totalLowConfMessages++;
          }

          if (msg.senderType === "signer" && seenGestures.has(msg.gestureLabel)) {
            clarificationCount++;
            gestureClarificationMap[msg.gestureLabel] = (gestureClarificationMap[msg.gestureLabel] ?? 0) + 1;
          }
          seenGestures.add(msg.gestureLabel);
          msgIdx++;
        }

        totalClarifications += clarificationCount;
        dailyBuckets[day].clarifications += clarificationCount;

        if (msgIdx > 0 && session.messages) {
          for (let j = 1; j < session.messages.length; j++) {
            const prev = new Date(session.messages[j - 1].createdAt).getTime();
            const curr = new Date(session.messages[j].createdAt).getTime();
            if (!isNaN(prev) && !isNaN(curr)) {
              totalResponseDelay += curr - prev;
              responseDelayCount++;
            }
          }
        }
      }
    }

    const avgResponseTime = responseDelayCount > 0 ? totalResponseDelay / responseDelayCount : 0;
    const lowConfRate = totalMessages > 0 ? totalLowConfMessages / totalMessages : 0;
    const successRate = totalConversations > 0 ? successfulConversations / totalConversations : 0;
    const stallRate = totalConversations > 0 ? stalledConversations / totalConversations : 0;
    const clarificationRate = totalMessages > 0 ? totalClarifications / totalMessages : 0;

    const avgMessagesPerConversation = totalConversations > 0 ? totalMessages / totalConversations : 0;

    const efficiency = Math.min(
      (successRate * 0.4 + (1 - stallRate) * 0.2 + (1 - clarificationRate) * 0.2 + Math.min(avgMessagesPerConversation / 10, 1) * 0.2) * 100,
      100
    );

    const qualityIndex = this.computeQualityIndex(
      successRate,
      lowConfRate,
      clarificationRate,
      stallRate,
      avgMessagesPerConversation
    );

    const sortedDays = Object.entries(dailyBuckets).sort(([a], [b]) => a.localeCompare(b));

    const topMisunderstood = Object.entries(gestureClarificationMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    const recommendations: string[] = [];
    if (stallRate > 0.3) recommendations.push("High stall rate — consider improving gesture suggestions for early conversation stages.");
    if (clarificationRate > 0.2) recommendations.push("Frequent clarifications detected — review commonly misunderstood gestures.");
    if (lowConfRate > 0.2) recommendations.push("Low confidence rate is high — consider collecting more training samples.");
    if (successRate < 0.5) recommendations.push("Overall success rate is below 50% — review conversation flow patterns.");
    if (avgResponseTime > 5000) recommendations.push("Average response time is high — consider optimizing inference pipeline.");
    if (topMisunderstood.length > 0) {
      const topLabels = topMisunderstood.slice(0, 3).map((g) => g.label).join(", ");
      recommendations.push(`Most misunderstood gestures: ${topLabels} — consider additional training data.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("System is performing well — continue monitoring.");
    }

    const dailySuccessRate = sortedDays.map(([, d]) => (d.total > 0 ? d.success / d.total : 0));
    const dailyAvgConfidence = sortedDays.map(([, d]) => (d.confCount > 0 ? d.confSum / d.confCount : 0));
    const dailyMessageCount = sortedDays.map(([, d]) => d.msgCount);
    const dailyClarificationRate = sortedDays.map(([, d]) => (d.msgCount > 0 ? d.clarifications / d.msgCount : 0));

    return {
      totalConversations,
      successfulConversations,
      stalledConversations,
      repeatedClarifications: totalClarifications,
      misunderstoodGestures: totalLowConfMessages,
      averageResponseTime: avgResponseTime,
      communicationEfficiency: Math.round(efficiency),
      qualityIndex: Math.round(qualityIndex.overall),
      trends: {
        dailySuccessRate,
        dailyAvgConfidence,
        dailyMessageCount,
        dailyClarificationRate,
      },
      topMisunderstoodGestures: topMisunderstood,
      recommendations,
    };
  }

  computeQualityIndex(
    successRate: number,
    lowConfRate: number,
    clarificationRate: number,
    stallRate: number,
    avgMessagesPerConversation: number
  ): ConversationQualityIndex {
    const communicationSuccess = successRate * 100;
    const confidenceQuality = (1 - lowConfRate) * 100;
    const efficiency = Math.min((1 - stallRate) * 30 + Math.min(avgMessagesPerConversation / 10, 1) * 20, 50) * 2;
    const clarity = (1 - clarificationRate) * 100;
    const engagement = Math.min(avgMessagesPerConversation * 10, 100);

    const overall = Math.round(
      communicationSuccess * 0.25 +
      confidenceQuality * 0.25 +
      efficiency * 0.2 +
      clarity * 0.2 +
      engagement * 0.1
    );

    return {
      overall: Math.round(overall),
      factors: {
        communicationSuccess: Math.round(communicationSuccess),
        confidenceQuality: Math.round(confidenceQuality),
        efficiency: Math.round(efficiency),
        clarity: Math.round(clarity),
        engagement: Math.round(engagement),
      },
    };
  }
}

export const globalConversationIntelligence = new ConversationIntelligenceAnalyzer();
