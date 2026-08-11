/**
 * The words the user typed, formatted for display.
 *
 * The rule this exists to enforce: labels and fingerspelled characters follow
 * the source text, while the gloss stays the identity used to find the asset.
 * Typing "kamusta ka" and being shown HOW ARE YOU -- or worse, being spelled
 * H-O-W-A-R-E-Y-O-U -- puts words on screen in a language the user did not
 * write.
 *
 * Uppercased only, to match how signs are captioned everywhere else. Nothing
 * else is rewritten: this is the user's own text and the point is fidelity to
 * it. An empty source falls back to the gloss at the call site.
 */
export function sourceLabel(original: string | undefined, fallback: string): string {
  const trimmed = (original ?? "").trim();
  return trimmed ? trimmed.toUpperCase() : fallback;
}

/**
 * The text a sign should be fingerspelled from when no animation exists.
 *
 * Extracted so it is reachable from a test. The decision used to live inline in
 * resolveFallback, which meant a test could only cover it by reimplementing it
 * -- and a reimplementation keeps passing when the real code regresses, which
 * is the one thing a regression test must not do.
 *
 * Falls back to the gloss only when there is no source text at all, so a sign
 * still spells something rather than vanishing.
 */
export function fingerspellSource(item: { original?: string; gloss: string }): string {
  return item.original?.trim() || item.gloss;
}

/**
 * The characters to fingerspell for a source phrase, one array per word.
 *
 * Word boundaries are preserved as separate arrays so a caller can tell where
 * one word ends -- "kamusta ka" is 7 signs then 2, not an undifferentiated run
 * of 9. No pause clip is inserted between words; the boundary survives in the
 * ordering and in clip ids, and adding a silent clip would make the sign count
 * disagree with what the viewer sees.
 *
 * Punctuation is dropped rather than spelled: "Kamusta ka?" must not try to
 * fingerspell "?", which has no sign and would 404. Digits are kept, because
 * ONE-TEN are real signs.
 */
export function spellableCharacters(source: string): string[][] {
  return source
    .split(/\s+/)
    .map((word) => word.toUpperCase().replace(/[^A-Z0-9]/g, "").split(""))
    .filter((characters) => characters.length > 0);
}
