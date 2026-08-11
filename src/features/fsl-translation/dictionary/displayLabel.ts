import type { DictionaryEntry } from "../types";

/**
 * The word to show the user for a sign, in their language.
 *
 * PRESENTATION ONLY. The gloss stays the identity: the animationAsset key, the
 * database row, and the path in /api/animations/[gloss]. SALAMAT and THANK YOU
 * are two labels for one published animation, and nothing here may reach asset
 * resolution.
 *
 * Resolved per sign from the lexical list the input actually matched, not from
 * the sentence. A sentence-level choice cannot be right for mixed input by
 * definition -- "hello salamat" is one English word and one Filipino word, and
 * labelling both from a single detected language mislabels one of them.
 */
export type LabelLanguage = "en" | "tl" | "mixed";

/** Which lexical list produced the match, recorded at lookup time. */
export type MatchedList = "english" | "filipino" | "synonym" | "label";

/**
 * Chips already render an uppercase gloss. The filipino/english arrays hold
 * lowercase lexical forms, so they are uppercased at the display boundary
 * rather than introducing a second casing rule.
 */
const display = (form: string): string => form.trim().toUpperCase();

export function resolveDisplayLabel(
  entry: Pick<DictionaryEntry, "gloss" | "english" | "filipino"> | undefined,
  language: LabelLanguage,
  matched?: MatchedList,
): string {
  const gloss = entry?.gloss ?? "";
  if (!entry) return gloss;

  // Per-token first: if the input matched a Filipino form, this sign is
  // Filipino whatever the rest of the sentence was, and vice versa.
  if (matched === "filipino" && entry.filipino.length > 0) {
    return display(entry.filipino[0]);
  }
  if (matched === "english" && entry.english.length > 0) {
    return display(entry.english[0]);
  }

  // Otherwise fall back to the sentence's language. "mixed" deliberately lands
  // here only when the match gave no signal -- a synonym like "ty" belongs to
  // no list -- and then the gloss is the honest answer.
  if (language === "tl" && entry.filipino.length > 0) {
    return display(entry.filipino[0]);
  }
  if (language === "en" && entry.english.length > 0) {
    return display(entry.english[0]);
  }

  // No form for that language, or mixed with no per-token signal. Never blank.
  return gloss;
}

/**
 * The BCP-47 tag for speech, so the voice matches the words on screen.
 *
 * Read aloud hardcoded "tl-PH" and spoke the raw input, so typing "thank you"
 * in English was read by a Filipino voice.
 */
export function speechLocaleFor(language: LabelLanguage): string {
  return language === "tl" ? "tl-PH" : "en-US";
}
