import { ReplyRanker, ReplyAcceptanceEntry, ExtendedRankingContext } from "../conversation/replyRanker";
import { ContextMessage, ScoredReply } from "../conversation/types";
import { detectIntent } from "../conversation/intentEngine";
import { ConversationMemoryV2 } from "../conversation/conversationMemoryV2";
import { TranslationMemory } from "../adaptive-memory/translationMemory";
import type { TranslationMemoryEntry } from "../adaptive-memory/types";
import { ConversationFlowPredictor } from "../conversation/flowPrediction";

type ReplySource = {
  text: string;
  gestureLabel: string;
  videoUrl: string | null;
  priority: number;
  contextTags: string[];
};

export type EnhancedRankingOptions = {
  translationMemory?: TranslationMemory;
  conversationMemory?: ConversationMemoryV2;
  flowPredictor?: ConversationFlowPredictor;
  recentGestures?: ContextMessage[];
  gestureSimilarityMap?: Map<string, Array<{ label: string; similarity: number }>>;
  confidenceHistory?: Map<string, number[]>;
};

export class IntelligentReplyRanker {
  private baseRanker = new ReplyRanker();

  async rank(
    gestureLabel: string,
    availableReplies: ReplySource[],
    context: ContextMessage[],
    userLanguage: "en" | "tl",
    userHistory?: { selectedReplies: string[] },
    extendedContext?: ExtendedRankingContext,
    options?: EnhancedRankingOptions,
  ): Promise<ScoredReply[]> {
    let scored = this.baseRanker.rank(gestureLabel, availableReplies, context, userLanguage, userHistory, extendedContext);

    if (!options) return scored;

    if (options.translationMemory) {
      const tmEntries = await options.translationMemory.query({ gestureLabel });
      if (tmEntries.length > 0) {
        for (const entry of tmEntries) {
          for (const reply of entry.administratorCorrections) {
            const existing = scored.find((s) => s.text.toLowerCase() === reply.toLowerCase());
            if (existing) {
              existing.score += Math.min(entry.usageCount * 0.01, 0.1);
            }
          }
          if (entry.usageCount > 5) {
            for (const gesture of entry.gestureSequence) {
              const tmMatch = scored.find((s) =>
                s.text.toLowerCase().includes(gesture.toLowerCase())
              );
              if (tmMatch) {
                tmMatch.score += Math.min(entry.averageConfidence * 0.08, 0.08);
              }
            }
          }
        }
      }
    }

    if (options.conversationMemory) {
      const fullContext = options.conversationMemory.getFullContext();
      if (fullContext.suggestedPriorities.length > 0) {
        for (const suggestion of fullContext.suggestedPriorities) {
          const match = scored.find((s) =>
            s.text.toLowerCase().includes(suggestion.toLowerCase())
          );
          if (match) {
            match.score += 0.1;
          }
        }
      }

      const unansweredCount = fullContext.unansweredQuestions ?? 0;
      if (unansweredCount > 0) {
        const suggestions = fullContext.suggestedPriorities ?? [];
        for (const q of suggestions.slice(0, 3)) {
          const match = scored.find((s) =>
            s.text.toLowerCase().includes(q.toLowerCase())
          );
          if (match) {
            match.score += 0.12;
          }
        }
      }
    }

    if (options.flowPredictor && options.recentGestures && options.recentGestures.length > 0) {
      const predictions = options.flowPredictor.predict(options.recentGestures, context[context.length - 1]?.intent);
      for (const pred of predictions) {
        for (const gesture of pred.suggestedGestures) {
          const match = scored.find((s) =>
            s.text.toLowerCase().includes(gesture.label.toLowerCase())
          );
          if (match) {
            match.score += pred.probability * 0.05;
          }
        }
      }
    }

    if (options.gestureSimilarityMap && options.gestureSimilarityMap.size > 0) {
      const similar = options.gestureSimilarityMap.get(gestureLabel) ?? [];
      for (const sim of similar) {
        const match = scored.find((s) =>
          s.text.toLowerCase().includes(sim.label.toLowerCase())
        );
        if (match) {
          match.score += sim.similarity * 0.06;
        }
      }
    }

    if (options.confidenceHistory) {
      const history = options.confidenceHistory.get(gestureLabel) ?? [];
      if (history.length > 0) {
        const avgConf = history.reduce((s, c) => s + c, 0) / history.length;
        if (avgConf > 0.7) {
          for (const s of scored) {
            s.score += 0.03;
          }
        }
      }
    }

    for (const s of scored) {
      s.score = Math.min(s.score, 1);
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }
}

export async function generateIntelligentSuggestions(
  gestureLabel: string,
  availableReplies: ReplySource[],
  context: ContextMessage[],
  options: EnhancedRankingOptions & {
    userLanguage?: "en" | "tl";
    userHistory?: { selectedReplies: string[] };
  }
): Promise<ScoredReply[]> {
  const ranker = new IntelligentReplyRanker();
  const tm = options.translationMemory;
  let tmBoost: TranslationMemoryEntry[] = [];

  if (tm) {
    tmBoost = await tm.query({ gestureLabel });
  }

  const tmSuggestions: ScoredReply[] = tmBoost
    .filter((e) => e.usageCount >= 3)
    .slice(0, 5)
    .map((e) => ({
      text: e.originalText,
      score: Math.min(0.3 + e.usageCount * 0.02, 0.7),
      source: "personalized" as const,
    }));

  const ranked = await ranker.rank(
    gestureLabel,
    availableReplies,
    context,
    options.userLanguage ?? "en",
    options.userHistory,
    {
      previousReplies: [],
      replyAcceptanceHistory: [],
      phraseFrequency: new Map(),
    },
    options
  );

  const seen = new Set(ranked.map((r) => r.text.toLowerCase()));
  const combined = [...ranked];
  for (const tm of tmSuggestions) {
    if (!seen.has(tm.text.toLowerCase())) {
      combined.push(tm);
      seen.add(tm.text.toLowerCase());
    }
  }

  combined.sort((a, b) => b.score - a.score);
  return combined.slice(0, 10);
}
