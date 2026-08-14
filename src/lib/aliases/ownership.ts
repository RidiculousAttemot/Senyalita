/**
 * Where a word→sign mapping is allowed to live. Stated once, here.
 *
 * THE RULE
 *   A gloss that has a row in animation_assets owns its lexical forms in the
 *   database. Every other gloss owns them in gestureDictionary.ts.
 *
 * The two sets are disjoint by construction, which is the property worth
 * having: there is no precedence to resolve in the normal case, and no way for
 * the same phrase to be defined twice and drift. Enforced at the only moment
 * it could be violated -- adding an alias -- by feeding sourceDictionaryClaims
 * into the conflict check, so claiming a built-in phrase for a different sign
 * is refused rather than silently overriding it.
 *
 * WHY THIS SPLIT AND NOT "DATABASE FOR EVERYTHING"
 *   Aliases attach to an asset. Of 209 dictionary entries, 208 have no asset to
 *   attach to -- they resolve to a gloss that then fingerspells, and they also
 *   carry suggestedReplies and categories that have nothing to do with
 *   animations. Moving them would mean three more tables and would drag in the
 *   suggestion engine. So the database owns exactly the vocabulary that can
 *   actually play, and grows as more is published.
 *
 * THE ONE OVERLAP MOMENT
 *   Publishing an animation for a gloss the dictionary already describes. At
 *   that point the source forms are adopted into the database and removed from
 *   the dictionary in the same commit -- one-way, at a known moment, visible in
 *   the admin. Until that happens the database wins, so a freshly published
 *   sign is reachable immediately.
 */

/** Which store a mapping came from. Shown in the admin beside every phrase. */
export type AliasSource = "database" | "source-dictionary";

export const ALIAS_SOURCE_LABEL: Record<AliasSource, string> = {
  database: "Admin",
  "source-dictionary": "Built in",
};

export const ALIAS_SOURCE_EXPLANATION: Record<AliasSource, string> = {
  database:
    "Added in the admin. Editable here, and live on the deployed site without a rebuild.",
  "source-dictionary":
    "Defined in gestureDictionary.ts because this gloss has no animation yet. Publishing one moves its words here.",
};

/**
 * Resolution order for a phrase claimed by both stores.
 *
 * Only reachable during the overlap described above; the disjointness test
 * fails if it becomes routine. Database first, so publishing an animation makes
 * its words reachable straight away rather than after a source edit.
 */
export const ALIAS_PRECEDENCE: readonly AliasSource[] = ["database", "source-dictionary"] as const;

/** True when the database is allowed to own this gloss's lexical forms. */
export function databaseOwnsGloss(gloss: string, glossesWithAssets: ReadonlySet<string>): boolean {
  return glossesWithAssets.has(gloss.trim().toUpperCase());
}

/**
 * Every phrase the built-in dictionary already claims, and for which gloss.
 *
 * Conflict detection has to see these, not only the phrases already in the
 * database. Checking the database alone would let "salamat" -- a built-in form
 * of THANK YOU -- be claimed for a different sign, and because the database
 * wins during the overlap, the built-in mapping would be silently overridden
 * with nothing anywhere saying so.
 *
 * Claiming one for the *same* gloss stays allowed: that is adoption, the
 * one-way move that happens when a gloss gains an animation.
 */
export function sourceDictionaryClaims(
  entries: readonly { gloss: string; synonyms: string[]; english: string[]; filipino: string[] }[],
): { phrase: string; gloss: string }[] {
  const claims: { phrase: string; gloss: string }[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const form of [...entry.synonyms, ...entry.english, ...entry.filipino]) {
      const phrase = form.trim().toLowerCase();
      if (!phrase || seen.has(phrase)) continue;
      seen.add(phrase);
      claims.push({ phrase, gloss: entry.gloss.toUpperCase() });
    }
  }
  return claims;
}
