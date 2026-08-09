/**
 * Matching a requested gloss against the one stored in the database.
 *
 * The two are not spelled the same. Every client-side cache keys a gloss by
 * `toUpperCase().replace(/\s+/g, "_")` — AnimationLoader, AnimationCache,
 * SmartAnimationResolver and PlaybackSequencer all do it — and AnimationLoader
 * uses that same key as the URL segment it requests. The database stores what
 * the admin typed at publish time, `gloss.trim().toUpperCase()`, which keeps
 * the space.
 *
 * So the browser asks for THANK_YOU and the row is THANK YOU, and the exact
 * match returns nothing:
 *
 *   GET /api/animations/THANK_YOU    -> 404
 *   GET /api/animations/THANK%20YOU  -> 307   (the asset is fine)
 *
 * This stayed hidden because every published gloss until now was a single
 * letter or digit, where underscore normalisation is the identity function.
 * THANK YOU was the first multi-word sign ever published, and it 404'd on the
 * first request.
 *
 * Fixed here rather than in the four client modules: the server is one place,
 * it is the side that owns the stored spelling, and a lookup that accepts both
 * spellings cannot be broken by the next cache that invents its own key.
 */

/**
 * Spellings to try for `gloss`, most likely first, without duplicates.
 *
 * The exact form comes first so a gloss that genuinely contains an underscore
 * still matches itself before the space variant is attempted.
 */
export function glossLookupCandidates(gloss: string): string[] {
  const exact = gloss.trim().toUpperCase();
  const spaced = exact.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  return exact === spaced ? [exact] : [exact, spaced];
}
