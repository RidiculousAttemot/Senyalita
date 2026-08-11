/**
 * Splits the model's label set into the groups the UI shows.
 *
 * DERIVED FROM THE MODEL, NEVER HARDCODED. The supported-characters panel used
 * to list "0123456789", which advertised a ZERO the model has no class for and
 * omitted TEN, which it does. Same failure as the 20-item battery /evaluation
 * once ran against a 131-class model: a hand-written list drifts silently,
 * because nothing fails when it disagrees.
 *
 * `assertPartition` exists so that drift becomes a test failure instead.
 */

/**
 * A number sign's model label, in counting order.
 *
 * Exported because this is the canonical order — sorted as strings, EIGHT
 * would come first and TWO last. Anything presenting numbers has to agree with
 * it, so it is shared rather than restated.
 */
export const NUMBER_ORDER = [
  "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
] as const;

const NUMBER_RANK = new Map<string, number>(NUMBER_ORDER.map((l, i) => [l, i]));

export interface LabelPartition {
  /** Single-character labels — the 26 letters. */
  letters: string[];
  /** Number-word labels, in counting order rather than alphabetical. */
  numbers: string[];
  /** Everything else: the phrase and word signs. */
  phrases: string[];
}

/**
 * Letters are single-character labels; numbers are the ONE..TEN words;
 * everything else is a phrase.
 *
 * Numbers cannot be detected by shape — "ONE" looks like any other
 * multi-character label — so they are matched against a known list. That list
 * is validated against the model by `assertPartition`, which fails if the
 * model ever gains or loses one.
 */
export function partitionLabels(allLabels: readonly string[]): LabelPartition {
  const letters: string[] = [];
  const numbers: string[] = [];
  const phrases: string[] = [];

  for (const label of allLabels) {
    if (label.length === 1) letters.push(label);
    else if (NUMBER_RANK.has(label)) numbers.push(label);
    else phrases.push(label);
  }

  letters.sort();
  numbers.sort((a, b) => (NUMBER_RANK.get(a) ?? 0) - (NUMBER_RANK.get(b) ?? 0));
  phrases.sort();

  return { letters, numbers, phrases };
}

/**
 * Throws when the three groups do not exactly reconstruct the label set.
 *
 * Cheap, and the only thing standing between a model change and a UI that
 * quietly lies about what it can recognise.
 */
export function assertPartition(allLabels: readonly string[], partition: LabelPartition): void {
  const total = partition.letters.length + partition.numbers.length + partition.phrases.length;
  if (total !== allLabels.length) {
    throw new Error(
      `label partition does not cover the model: ${partition.letters.length} letters + `
      + `${partition.numbers.length} numbers + ${partition.phrases.length} phrases = ${total}, `
      + `but the model has ${allLabels.length} classes`,
    );
  }
  const missing = NUMBER_ORDER.filter((n) => !partition.numbers.includes(n));
  if (missing.length) {
    throw new Error(`model is missing expected number classes: ${missing.join(", ")}`);
  }
}

/**
 * How a number reaches the UI: "ONE" -> "1", "TEN" -> "10".
 *
 * There is no ZERO class, so the displayed range is 1-10 and not 0-9. Text-to-
 * Sign can play gloss 0 — that asymmetry is deliberate and documented in
 * inScopeLabels.ts.
 */
export function numberDisplay(label: string): string {
  const rank = NUMBER_RANK.get(label);
  return rank === undefined ? label : String(rank + 1);
}
