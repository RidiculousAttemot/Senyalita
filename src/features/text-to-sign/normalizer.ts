export interface NormalizedInput {
  original: string;
  sentences: string[];
  words: string[];
  language: "en" | "tl" | "unknown";
}

const TAGALOG_INDICATORS = [
  "ang", "ng", "sa", "ay", "ako", "ikaw", "siya", "tayo", "kami", "kayo",
  "sila", "ito", "iyan", "iyon", "opo", "oo", "hindi", "po", "salamat",
  "maganda", "pakiusap", "kumusta", "mabuti", "oo", "sige", "ba",
];

function detectLanguage(text: string): "en" | "tl" | "unknown" {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const tlCount = words.filter((w) => TAGALOG_INDICATORS.includes(w)).length;
  if (tlCount >= 2) return "tl";
  const enWordCount = words.filter((w) => /^[a-z]+$/.test(w)).length;
  if (enWordCount > 0) return "en";
  return "unknown";
}

export function normalizeInput(text: string): NormalizedInput {
  const trimmed = text.trim();

  const sentences = trimmed
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const words = trimmed
    .toLowerCase()
    .replace(/[^\w\sñá-ú]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const language = detectLanguage(trimmed);

  return { original: trimmed, sentences, words, language };
}

export function removeStopWords(words: string[]): string[] {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "to", "of", "in",
    "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "above", "below", "between", "out",
    "off", "over", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "each", "every",
    "both", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "just",
    "because", "but", "and", "or", "if", "while",
  ]);
  return words.filter((w) => !stopWords.has(w));
}
