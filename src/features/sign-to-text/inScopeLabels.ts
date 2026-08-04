/**
 * The classes Sign-to-Text will act on.
 *
 * PRODUCT DECISION, NOT A MODEL LIMIT. The deployed model has all 131 classes
 * and keeps them: 26 letters, 105 phrase/word classes. This filter narrows what
 * the *app* accepts to the 36 that fingerspelling covers — a-z plus the ten
 * number signs — because the transcript, the suggestion engine and the commit
 * flow are all built around single characters.
 *
 * TO REVERT: delete the `isInScope` call in SignToTextInterface's
 * `currentPrediction`. Nothing else needs touching, and no model or dataset
 * change is involved.
 *
 * DELIBERATELY NOT IN features/recognition/. That layer stays capable of the
 * full 131 so /evaluation can keep measuring every class for the thesis
 * numbers. Filtering there would silently change what the evaluation harness
 * can score.
 */

/**
 * Raw model labels in scope, for reference and for anything that needs to
 * reason about the model's own vocabulary.
 *
 * The number classes are `ONE`..`TEN`, not digits — the model has no digit
 * labels, and no ZERO class at all (see the asymmetry note below).
 */
export const IN_SCOPE_SOURCE_LABELS: readonly string[] = [
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
];

/**
 * The same list as a Set, for `useRecognition`'s `allowedLabels`.
 *
 * This is where the narrowing actually happens: the model's argmax is taken
 * over these classes only, so an in-scope answer always exists. The first
 * version of this feature filtered *after* prediction instead, which meant the
 * UI went blank whenever the model's top pick was one of the 105 phrase
 * classes — most noisy frames — and looked like recognition had stopped
 * working entirely.
 */
export const IN_SCOPE_SOURCE_LABEL_SET: ReadonlySet<string> = new Set(IN_SCOPE_SOURCE_LABELS);

/**
 * What actually arrives at the UI.
 *
 * Predictions are display-mapped before they leave the recognition layer
 * (`translateResult` -> `GESTURE_DISPLAY_MAP`), so `ONE` reaches the consumer
 * as `"1"` and `TEN` as `"10"`. Matching on source labels here would filter
 * out every number.
 */
export const IN_SCOPE_DISPLAY_LABELS: ReadonlySet<string> = new Set([
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
]);

/** True when a display-form prediction is one Sign-to-Text will act on. */
export function isInScope(displayLabel: string): boolean {
  return IN_SCOPE_DISPLAY_LABELS.has(displayLabel);
}

/**
 * True for the number signs, which behave differently from letters on commit.
 *
 * They reach the transcript but must NOT enter the letter-spelling buffer: the
 * suggestion engine matches a run of characters against a word dictionary, and
 * a digit in the middle can never match, so it would kill suggestions until
 * cleared. `appendLabel` would also mangle `"10"` — it takes `.slice(0, 1)` of
 * anything outside MULTI_CHARACTER_LABELS (which holds only "NG"), so TEN
 * would silently append `"1"`.
 */
export function isNumberSign(displayLabel: string): boolean {
  return /^(?:[1-9]|10)$/.test(displayLabel);
}

/**
 * KNOWN ASYMMETRY — ZERO.
 *
 * The model has no ZERO class (verified against labels.json: no "ZERO", no
 * "0", no digit-form labels at all), so Sign-to-Text can never produce a zero.
 * Text-to-Sign *can* play one: gloss `0` is published and serves alongside
 * `1`-`10`.
 *
 * So the two directions disagree on the number range: Text-to-Sign covers
 * 0-10, Sign-to-Text covers 1-10. Left as-is and documented rather than
 * hidden, because removing `0` from Text-to-Sign would delete a working
 * capability to paper over a gap in the other direction.
 */
export const ZERO_IS_TEXT_TO_SIGN_ONLY = true;
