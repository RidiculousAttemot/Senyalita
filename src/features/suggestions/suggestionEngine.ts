import { buildVocabulary, toLetterKey, type VocabularyEntry } from "./vocabulary";
import { boundedEditDistance, editBudget, segmentIntoWords } from "./matching";

export type SuggestionKind = "exact" | "phrase" | "prefix" | "fuzzy";

export interface Suggestion {
  /** Text to insert into the transcript, e.g. "HOW ARE YOU". */
  phrase: string;
  kind: SuggestionKind;
  /** 0-1, for display only — not a model confidence. */
  score: number;
  language?: VocabularyEntry["language"];
  /** Edits needed to reach this from the signed letters; 0 when exact. */
  distance?: number;
}

export interface SuggestOptions {
  limit?: number;
  /** Accepted-suggestion counts, used to bias ranking toward habitual phrases. */
  usage?: Record<string, number>;
  vocabulary?: VocabularyEntry[];
}

/** Ranking bands. A kind never outranks a stronger kind on score alone. */
const KIND_WEIGHT: Record<SuggestionKind, number> = {
  exact: 1000,
  phrase: 700,
  prefix: 400,
  fuzzy: 200,
};

const DEFAULT_LIMIT = 6;

/**
 * Turns a run of recognised letters into ranked word and phrase candidates.
 *
 * Deliberately independent of the recognition model: it takes a string and
 * returns strings. When word-level recognition arrives later, this same engine
 * still applies to whatever letters or partial glosses come out of it.
 */
export function suggest(letters: string, options: SuggestOptions = {}): Suggestion[] {
  const key = toLetterKey(letters);
  if (key.length < 2) return [];

  const vocabulary = options.vocabulary ?? buildVocabulary();
  const usage = options.usage ?? {};
  const limit = options.limit ?? DEFAULT_LIMIT;
  const budget = editBudget(key.length);

  const found = new Map<string, Suggestion>();
  const consider = (candidate: Suggestion) => {
    const existing = found.get(candidate.phrase);
    // Keep the strongest explanation for a phrase reached several ways.
    if (!existing || candidate.score > existing.score) found.set(candidate.phrase, candidate);
  };

  for (const entry of vocabulary) {
    if (entry.key === key) {
      consider({
        phrase: entry.phrase,
        kind: "exact",
        // Multi-word exact matches are the most useful answer of all.
        score: KIND_WEIGHT.exact + entry.wordCount * 10,
        language: entry.language,
        distance: 0,
      });
      continue;
    }

    if (entry.key.startsWith(key)) {
      // The closer the completion, the more likely it is what they mean.
      const remaining = entry.key.length - key.length;
      consider({
        phrase: entry.phrase,
        kind: "prefix",
        score: KIND_WEIGHT.prefix + Math.max(0, 60 - remaining * 4),
        language: entry.language,
      });
      continue;
    }

    if (budget > 0 && Math.abs(entry.key.length - key.length) <= budget) {
      const distance = boundedEditDistance(key, entry.key, budget);
      if (distance <= budget) {
        consider({
          phrase: entry.phrase,
          kind: "fuzzy",
          score: KIND_WEIGHT.fuzzy + (budget - distance) * 30 + entry.wordCount * 5,
          language: entry.language,
          distance,
        });
      }
    }
  }

  // "MAHALKITA" is not one dictionary entry, but "MAHAL" + "KITA" are.
  const segmented = segmentIntoWords(key, vocabulary);
  if (segmented && segmented.words.length > 1) {
    consider({
      phrase: segmented.words.join(" "),
      kind: "phrase",
      score: KIND_WEIGHT.phrase + Math.max(0, 60 - segmented.words.length * 8),
      distance: 0,
    });
  }

  return [...found.values()]
    .map((item) => ({
      ...item,
      // Habitual phrases drift upward, but never across a band boundary.
      score: item.score + Math.min(90, (usage[item.phrase] ?? 0) * 6),
    }))
    .sort((a, b) => b.score - a.score || a.phrase.localeCompare(b.phrase))
    .slice(0, limit)
    .map((item) => ({
      ...item,
      // Normalise to 0-1 for display without losing the ordering.
      score: Math.min(1, item.score / (KIND_WEIGHT.exact + 120)),
    }));
}
