/**
 * Vocabulary for the letter-to-word suggestion engine.
 *
 * Sourced from the FSL gesture dictionary so suggestions stay tied to signs
 * the wider system already knows, rather than an invented word list. Nothing
 * here touches the recognition model — this layer runs entirely on letters
 * that have already been recognised.
 */
import { globalDictionary } from "@/features/fsl-translation/dictionary/gestureDictionary";

export interface VocabularyEntry {
  /** Display form, e.g. "HOW ARE YOU". */
  phrase: string;
  /** Letters only, e.g. "HOWAREYOU" — what a signer actually spells. */
  key: string;
  /** Number of words; multi-word entries are worth surfacing prominently. */
  wordCount: number;
  language: "english" | "filipino";
  category?: string;
}

/** Signers spell letters, so punctuation and spacing cannot be relied upon. */
export function toLetterKey(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9Ñ]/g, "");
}

function displayForm(text: string): string {
  return text.trim().toUpperCase().replace(/\s+/g, " ");
}

let cached: VocabularyEntry[] | null = null;

/**
 * Flattens every label, English gloss and Filipino gloss into one searchable
 * list. FSL users move between both languages, so both are first-class.
 */
export function buildVocabulary(): VocabularyEntry[] {
  if (cached) return cached;

  const seen = new Map<string, VocabularyEntry>();

  const add = (raw: string, language: VocabularyEntry["language"], category?: string) => {
    const phrase = displayForm(raw);
    const key = toLetterKey(phrase);
    // A single letter cannot disambiguate anything and would match everything.
    if (key.length < 2) return;
    const existing = seen.get(key);
    if (existing) {
      // Prefer the form with real spacing: "HOW ARE YOU" over "HOWAREYOU".
      if (phrase.includes(" ") && !existing.phrase.includes(" ")) {
        seen.set(key, { ...existing, phrase, wordCount: phrase.split(" ").length });
      }
      return;
    }
    seen.set(key, {
      phrase,
      key,
      wordCount: phrase.split(" ").length,
      language,
      category,
    });
  };

  for (const entry of globalDictionary.getAllEntries()) {
    add(entry.label, "english", entry.category);
    for (const word of entry.english ?? []) add(word, "english", entry.category);
    for (const word of entry.filipino ?? []) add(word, "filipino", entry.category);
    for (const word of entry.synonyms ?? []) add(word, "english", entry.category);
  }

  cached = [...seen.values()];
  return cached;
}

/** Test seam — the vocabulary is otherwise memoised for the app's lifetime. */
export function resetVocabularyCache(): void {
  cached = null;
}
