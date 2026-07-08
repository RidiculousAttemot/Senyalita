import type { TranslationIntent } from "../types";

const INTENT_PATTERNS: Array<{
  intent: TranslationIntent;
  keywords: string[];
  patterns: RegExp[];
}> = [
  {
    intent: "greeting",
    keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "kumusta", "maganda", "hello", "hi"],
    patterns: [/^(hello|hi|hey|good\s+(morning|afternoon|evening)|kumusta)/i],
  },
  {
    intent: "farewell",
    keywords: ["bye", "goodbye", "see you", "paalam", "sige", "later", "see"],
    patterns: [/^(bye|goodbye|see\s+you|paalam)/i],
  },
  {
    intent: "question",
    keywords: ["what", "where", "when", "why", "how", "who", "which", "is", "are", "do", "does", "did", "can", "will", "would", "could", "ask", "question", "ano", "saan", "kailan", "bakit", "paano", "sino", "ilan", "gaano"],
    patterns: [/(\?|what|where|when|why|how|who|which|ano|saan|kailan|bakit|paano|sino|ilan|gaano)/i],
  },
  {
    intent: "affirmation",
    keywords: ["yes", "yeah", "yep", "sure", "okay", "ok", "correct", "right", "true", "agree", "oo", "opo", "sige", "tama", "oo"],
    patterns: [/^(yes|yeah|yep|sure|okay|ok|correct|right|true|agree|oo|opo|sige|tama)/i],
  },
  {
    intent: "negation",
    keywords: ["no", "nope", "not", "dont", "don't", "incorrect", "wrong", "false", "disagree", "hindi", "ayaw", "wag", "bawal"],
    patterns: [/^(no|nope|not|dont|don't|incorrect|wrong|false|disagree|hindi|ayaw|wag|bawal)/i],
  },
  {
    intent: "request",
    keywords: ["please", "can", "could", "would", "may", "need", "want", "help", "pakiusap", "puede", "pwede", "gusto", "kailangan"],
    patterns: [/(please|can\s+(you|i)|could\s+(you|i)|would\s+(you|i)|may\s+(i|we)|need|want|pakiusap|puede|pwede|gusto|kailangan)/i],
  },
];

export function detectIntent(words: string[], fullText: string): TranslationIntent {
  const lower = fullText.toLowerCase();
  const wordSet = new Set(words.map((w) => w.toLowerCase()));

  const scored: Array<{ intent: TranslationIntent; score: number }> = [];

  for (const pattern of INTENT_PATTERNS) {
    let score = 0;

    for (const kw of pattern.keywords) {
      if (wordSet.has(kw)) score += 1;
    }

    for (const re of pattern.patterns) {
      if (re.test(lower)) score += 2;
    }

    if (score > 0) {
      scored.push({ intent: pattern.intent, score });
    }
  }

  if (scored.length === 0) return "statement";

  scored.sort((a, b) => b.score - a.score);
  return scored[0].intent;
}
