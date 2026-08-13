/**
 * The alphabet a stored alias phrase may contain.
 *
 * This exists in two places by necessity — here, and as a CHECK constraint in
 * migration 0041 — so it is written once and kept identical. If they diverge,
 * the admin accepts a phrase the database then rejects with a raw constraint
 * error, or worse, stores one the matcher can never produce.
 *
 * Derived from TextNormalizer, not invented. The normaliser keeps `\w`
 * (a-z0-9_ once lowercased), the apostrophe, the hyphen and a specific set of
 * accented letters; it splits `,.!?;:` into their own tokens and then drops
 * tokens that are only punctuation. So a phrase is one or more such tokens
 * joined by single spaces.
 *
 * The first version of this constraint was `^[a-z0-9ñ]+( [a-z0-9ñ]+)*$`, which
 * is narrower than the normaliser's own output: "mag-aral", "sino'ng" and
 * "café" all normalise cleanly and were all unstorable. `ñ` happened to be
 * allowed and the other accents were not, which is the kind of gap that only
 * shows up once someone types the wrong Filipino word.
 */
/**
 * The hyphen is last in the class, and that is deliberate.
 *
 * Escaping it as `\-` works in JavaScript but not reliably in Postgres, whose
 * advanced regular expressions treat a backslash as special inside a bracket
 * expression too. Trailing, it is a literal in both, so this string can be
 * pasted into the CHECK constraint unchanged apart from doubling the quote.
 */
const TOKEN = "[a-z0-9_'ñáéíóúàèìòùäëïöüâêîôû-]+";

/** Matches a fully normalised alias phrase. */
export const ALIAS_PHRASE_PATTERN = new RegExp(`^${TOKEN}( ${TOKEN})*$`);

/**
 * The identical pattern, quoted for SQL. Kept beside the JavaScript one so a
 * change to either is visibly a change to both.
 */
export const ALIAS_PHRASE_SQL_PATTERN = `^${TOKEN}( ${TOKEN})*$`.replace(/'/g, "''");

export function isStorableAliasPhrase(phrase: string): boolean {
  return ALIAS_PHRASE_PATTERN.test(phrase);
}
