import { ContextMessage, ConversationIntent, ScoredReply } from "./types";
import { detectIntent } from "./intentEngine";

type ReplySource = {
  text: string;
  gestureLabel: string;
  videoUrl: string | null;
  priority: number;
  contextTags: string[];
};

export type ReplyAcceptanceEntry = {
  replyText: string;
  wasAccepted: boolean;
  contextTopic?: string;
};

export type ExtendedRankingContext = {
  previousReplies: string[];
  replyAcceptanceHistory: ReplyAcceptanceEntry[];
  communicationSuccessRate?: number;
  conversationTopic?: string;
  phraseFrequency: Map<string, number>;
};

export class ReplyRanker {
  rank(
    gestureLabel: string,
    availableReplies: ReplySource[],
    context: ContextMessage[],
    userLanguage: "en" | "tl",
    userHistory?: { selectedReplies: string[] },
    extendedContext?: ExtendedRankingContext
  ): ScoredReply[] {
    if (availableReplies.length === 0) return [];

    const currentIntent = detectIntent(gestureLabel);
    const scored: ScoredReply[] = [];

    for (const reply of availableReplies) {
      let score = 0;

      score += reply.priority * 0.2;

      const replyIntent = detectIntent(reply.text);
      if (replyIntent.intent === currentIntent.intent) {
        score += 0.15 * currentIntent.confidence;
      }

      if (context.length > 0) {
        const contextIntents = context
          .filter(c => c.intent)
          .map(c => c.intent as string);
        if (replyIntent.intent && contextIntents.includes(replyIntent.intent)) {
          score += 0.1;
        }
      }

      if (userHistory?.selectedReplies?.includes(reply.text)) {
        score += 0.15;
      }

      const isTagalog = /^(salamat|oo|hindi|po|opo|ano|saan|kailan|bakit|paano|mabuti|masama|pakiusap|paumanhin|patawad)\b/i.test(reply.text);
      if (userLanguage === "tl" && isTagalog) {
        score += 0.1;
      }

      if (extendedContext) {
        score = this.applyExtendedContext(reply, score, extendedContext);
      }

      score = Math.min(score, 1);

      scored.push({
        text: reply.text,
        score,
        source: userHistory?.selectedReplies?.includes(reply.text) ? "personalized" : "gesture",
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  private applyExtendedContext(
    reply: ReplySource,
    baseScore: number,
    ctx: ExtendedRankingContext
  ): number {
    let score = baseScore;

    if (ctx.previousReplies.includes(reply.text)) {
      score += 0.1;
    }

    const acceptanceForReply = ctx.replyAcceptanceHistory.filter(
      a => a.replyText === reply.text && a.wasAccepted
    );
    if (acceptanceForReply.length > 0) {
      const acceptanceRate = acceptanceForReply.length /
        Math.max(ctx.replyAcceptanceHistory.filter(a => a.replyText === reply.text).length, 1);
      score += acceptanceRate * 0.1;
    }

    if (ctx.communicationSuccessRate !== undefined && ctx.communicationSuccessRate > 0.5) {
      score += 0.05;
    }

    if (ctx.conversationTopic && reply.contextTags.includes(ctx.conversationTopic)) {
      score += 0.1;
    }

    const freq = ctx.phraseFrequency.get(reply.text) ?? 0;
    if (freq > 0) {
      score += Math.min(freq * 0.02, 0.1);
    }

    return score;
  }
}

export const CONTEXTUAL_REPLIES: Record<string, string[]> = {
  Greeting: ["I'm fine, thank you!", "Nice to meet you too!", "How are you?"],
  Question: ["Yes", "No", "I don't know", "Let me think..."],
  Request: ["Sure!", "Of course", "I'll help you", "Just a moment"],
  Emergency: ["I'll call for help", "Are you okay?", "Where does it hurt?"],
  Food: ["That sounds good", "I'm hungry too", "Where should we eat?"],
  Farewell: ["See you later!", "Take care!", "Goodbye!"],
};

export type { ReplySource };
