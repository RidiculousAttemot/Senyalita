import { defaultTextNormalizer } from "@/features/translation-pipeline/stages/TextNormalizer";
import { ALIAS_PHRASE_PATTERN } from "./phrasePattern";

/**
 * Turns what the admin typed into the form the matcher will actually look up.
 *
 * This runs the real normaliser rather than approximating it, and that is the
 * whole point. TextNormalizer does considerably more than lowercase and strip
 * punctuation: it expands contractions, applies abbreviation expansion, and
 * substitutes Filipino spelling variants. "kumusta ka" arrives at the matcher
 * as "kamusta ka", so an alias stored as typed would sit in the database
 * looking correct and never match anything.
 *
 * Any reimplementation here would drift from the pipeline the first time
 * someone adds a spelling variant, and the failure would be a word that
 * silently refuses to play.
 */
export interface NormalisedPhrase {
  /** What to store, and what the matcher will compare against. */
  phrase: string;
  /** The individual tokens, so callers can reason about phrase length. */
  words: string[];
  /** True when the admin's text survives normalisation unchanged. */
  unchanged: boolean;
}

export function normalisePhrase(input: string): NormalisedPhrase {
  const words = defaultTextNormalizer.normalize(input).words;
  const phrase = words.join(" ");
  return { phrase, words, unchanged: phrase === input.trim().toLowerCase() };
}

export type PhraseRejection =
  | { ok: true; value: NormalisedPhrase }
  | { ok: false; reason: string };

/**
 * Normalises and confirms the result is something the database will accept.
 *
 * The CHECK constraint would refuse it anyway, but as a raw constraint
 * violation rather than an explanation, so the same rule is applied here where
 * there is a sentence to attach to it.
 */
export function prepareAliasPhrase(input: string): PhraseRejection {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Enter a word or phrase." };

  const normalised = normalisePhrase(trimmed);
  if (!normalised.phrase) {
    return {
      ok: false,
      reason: `"${trimmed}" has nothing to match on once punctuation is removed.`,
    };
  }

  if (!ALIAS_PHRASE_PATTERN.test(normalised.phrase)) {
    // Reaching here means the normaliser emitted something the constraint
    // rejects, which is a bug in one of them rather than bad input.
    return {
      ok: false,
      reason: `"${normalised.phrase}" contains characters that cannot be stored.`,
    };
  }

  return { ok: true, value: normalised };
}
