import { GESTURE_CATEGORIES } from "@/features/gesture-mapping/glossDictionary";

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

/** The gloss whose animation should play for a label, or null if none exists. */
export function playableGlossFor(label: string): string | null {
  const upper = label.toUpperCase().trim();
  if (upper.length === 1 && /[A-Z]/.test(upper)) return upper;
  if (NUMBERS.includes(upper)) return upper;
  return NUMBER_WORD_TO_DIGIT[upper] ?? null;
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
 * Takes the label list as an argument rather than importing it, so the caller
 * decides where it comes from and this stays testable without fixtures.
 */
export function buildVocabulary(modelLabels: string[]): VocabularyEntry[] {
  return modelLabels
    .filter((label) => label.length > 1)
    .map((label) => ({
      label,
      gloss: playableGlossFor(label),
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
