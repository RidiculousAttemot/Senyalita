import type { AliasSource } from "@/lib/aliases/ownership";
import { globalDictionary } from "./gestureDictionary";
import { aliasIndex } from "./aliasIndex";

/**
 * The one place a phrase is turned into a sign.
 *
 * Precedence lives here and nowhere else, so "where did this mapping come
 * from" has a single answer and the admin can show it. The rule itself is
 * documented in lib/aliases/ownership.ts: a gloss with an asset row owns its
 * lexical forms in the database, everything else owns them in
 * gestureDictionary.ts.
 *
 * Those sets are disjoint by construction, so this order rarely matters. It
 * matters during the one overlap moment — publishing an animation for a gloss
 * the dictionary already describes — where the database winning means the new
 * sign is reachable immediately instead of after a source edit and a deploy.
 */
export interface PhraseMatch {
  /** The gloss, and the asset lookup key. Never the phrase that matched. */
  gloss: string;
  /** What to request from /api/animations/[gloss]. */
  animationKey: string;
  category?: string;
  /** Which store answered, for the admin's provenance display. */
  source: AliasSource;
}

export function resolvePhrase(phrase: string): PhraseMatch | undefined {
  const alias = aliasIndex.lookup(phrase);
  if (alias) {
    return {
      gloss: alias.gloss,
      // The gloss is the key. Using alias.phrase here would request an asset
      // that does not exist, 404, and silently fingerspell — which reads as a
      // dictionary bug rather than a labelling one.
      animationKey: alias.gloss,
      source: "database",
    };
  }

  const entry = globalDictionary.lookup(phrase);
  if (entry) {
    return {
      gloss: entry.gloss,
      animationKey: entry.animationAsset ?? entry.gloss,
      category: entry.category,
      source: "source-dictionary",
    };
  }

  return undefined;
}

/** The longest phrase either store can match, so the matcher's window covers both. */
export function maxPhraseWords(): number {
  return Math.max(globalDictionary.maxPhraseWords(), aliasIndex.maxPhraseWords());
}
