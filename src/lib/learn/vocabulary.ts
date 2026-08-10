import { GESTURE_CATEGORIES } from "@/features/gesture-mapping/glossDictionary";
import { glossLookupCandidates } from "@/lib/glossKey";

/**
 * What /learn can actually show, derived from what is published.
 *
 * Measured against Supabase rather than assumed:
 *
 *   published animation_assets : 37  (A-Z and 0-10, all published)
 *   deployed model classes     : 131 (26 letters + 105 multi-word labels)
 *   multi-word labels with an animation : 0
 *
 * So a "pick a phrase and watch its sign" gallery would be empty for 95 of
 * 105 entries. This module encodes the distinction instead of hiding it: an
 * entry either has a playable gloss or it does not, and the UI renders those
 * two states differently.
 */

/** Letters and digits, the 37 glosses with a published animation. */
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const NUMBERS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/**
 * The model emits number WORDS; the published assets are keyed by DIGIT.
 *
 *   model label : "ONE"   published gloss : "1"
 *
 * Same sign, different key — the lookup missed on spelling alone. Mapping
 * them makes 10 of the 105 multi-word labels playable with no new recordings.
 * This is the only place where a label is rewritten before lookup; everything
 * else resolves by its own name.
 */
export const NUMBER_WORD_TO_DIGIT: Record<string, string> = {
  ZERO: "0",
  ONE: "1",
  TWO: "2",
  THREE: "3",
  FOUR: "4",
  FIVE: "5",
  SIX: "6",
  SEVEN: "7",
  EIGHT: "8",
  NINE: "9",
  TEN: "10",
};

/**
 * The gloss whose animation should play for a label, or null if none exists.
 *
 * `published` is the live set from /api/animations, not a rule. This used to
 * decide playability structurally — a single letter, a digit, or a number word
 * — which was true only while the published library was exactly A-Z and 0-10.
 * Publishing THANK YOU made it false: the sign played correctly in
 * Text-to-Sign while /learn went on listing it as "recognised, no animation
 * yet", and every phrase published afterwards would have joined it.
 *
 * Asking the library means the page follows what is actually published instead
 * of a snapshot of what was published the day it was written.
 *
 * Spelling is matched through glossLookupCandidates, the same helper the server
 * uses, so THANK YOU and THANK_YOU resolve identically here and there.
 */
export function playableGlossFor(
  label: string,
  published: ReadonlySet<string>,
): string | null {
  for (const candidate of glossLookupCandidates(label)) {
    if (published.has(candidate)) return candidate;
  }

  // The model emits number WORDS; the assets are keyed by DIGIT. Same sign,
  // different key — still a mapping, not a rule about what is playable, and it
  // is only offered if that digit is actually published.
  const digit = NUMBER_WORD_TO_DIGIT[label.toUpperCase().trim()];
  return digit && published.has(digit) ? digit : null;
}

export type VocabularyEntry = {
  label: string;
  /** Gloss to play, or null when the sign is recognised but not animated. */
  gloss: string | null;
  category: string;
};

/** Human-readable grouping, falling back to a catch-all rather than "undefined". */
export function categoryFor(label: string): string {
  return GESTURE_CATEGORIES[label.toUpperCase().replace(/['']/g, "'")] ?? "other";
}

/**
 * Builds the recognition vocabulary from the model's own labels.
 *
 * Both inputs are arguments rather than imports: the caller decides where the
 * labels and the published set come from, and this stays testable without
 * fixtures or a database.
 */
export function buildVocabulary(
  modelLabels: string[],
  publishedGlosses: readonly string[],
): VocabularyEntry[] {
  const published = new Set(publishedGlosses.map((g) => g.toUpperCase().trim()));
  return modelLabels
    .filter((label) => label.length > 1)
    .map((label) => ({
      label,
      gloss: playableGlossFor(label, published),
      category: categoryFor(label),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Case- and separator-insensitive match, so "good morning" finds "GOOD MORNING". */
export function matchesQuery(text: string, query: string): boolean {
  if (!query.trim()) return true;
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalise(text).includes(normalise(query));
}
