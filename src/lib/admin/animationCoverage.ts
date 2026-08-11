/**
 * What the system can recognise, versus what it can show back.
 *
 * The dashboard already had a coverage card, and it was wrong in both halves:
 *
 *   denominator  WORD_TO_GLOSS — 211 entries of a hardcoded English→gloss
 *                dictionary. That file describes what the translator will *try*
 *                to look up, not what the recognition model knows. Measuring
 *                against it answered a question nobody asked.
 *
 *   numerator    every row in animation_assets, with no filter on
 *                published_version_id. A gloss uploaded, extracted and left as
 *                a draft counted as covered — so the number went up at upload
 *                time rather than at publish time, which is the opposite of
 *                what "covered" has to mean. Nothing is visible to the public
 *                app until a version is published.
 *
 * The honest measure is the model's own label set against the glosses that
 * actually have a published version. A label in the first set but not the
 * second is a sign the camera can recognise and the avatar cannot perform.
 */

import { NUMBER_ORDER } from "@/features/recognition/labelPartition";

/**
 * The number signs are spelled as words by the model and as digits by the
 * library: label ONE, published gloss "1". They are one sign. Without this map
 * the report is wrong twice over for every number — ONE counted as missing, and
 * "1" listed as something the model cannot recognise.
 *
 * ZERO is deliberately absent from NUMBER_ORDER because the model has no such
 * class, so the published "0" correctly stays uncounted. That asymmetry is real
 * and documented at ZERO_IS_TEXT_TO_SIGN_ONLY; the report should show it rather
 * than smooth it over.
 */
const NUMBER_WORD_TO_DIGIT = new Map<string, string>(
  NUMBER_ORDER.map((word, index) => [word, String(index + 1)]),
);

/**
 * Glosses are spelled inconsistently across the system: the model emits
 * lowercase letters and uppercase phrases, clients cache THANK_YOU, and the
 * database stores THANK YOU. Compare on a single canonical form so the count is
 * not quietly wrong for every multi-word sign. Mirrors glossLookupCandidates.
 */
export const coverageKey = (gloss: string): string => {
  const upper = gloss.toUpperCase().replace(/[_\s]+/g, " ").trim();
  return NUMBER_WORD_TO_DIGIT.get(upper) ?? upper;
};

export interface CoverageGroup {
  name: string;
  total: number;
  published: number;
  /** Original model spelling, so it reads the way it does everywhere else. */
  missing: string[];
}

export interface AnimationCoverage {
  total: number;
  published: number;
  missing: number;
  percent: number;
  groups: CoverageGroup[];
  /**
   * Published glosses with no matching model label. Not an error — they are
   * usable in text-to-sign — but they cannot be produced by signing at the
   * camera, so they do not count toward coverage of the model.
   */
  unrecognised: string[];
}

const isLetter = (label: string) => /^[a-z]$/i.test(label.trim());
const isNumber = (label: string) => NUMBER_WORD_TO_DIGIT.has(label.toUpperCase().trim());

export function computeAnimationCoverage(
  modelLabels: readonly string[],
  publishedGlosses: readonly string[],
): AnimationCoverage {
  const published = new Set(publishedGlosses.map(coverageKey));

  // De-duplicate on the canonical key, keeping the model's own spelling for
  // display. A label list with both "THANK YOU" and "THANK_YOU" must not
  // inflate the denominator.
  const labels = new Map<string, string>();
  for (const label of modelLabels) {
    const key = coverageKey(label);
    if (key && !labels.has(key)) labels.set(key, label);
  }

  const groupOf = (label: string) =>
    isLetter(label) ? "Alphabet" : isNumber(label) ? "Numbers" : "Words and phrases";
  const groups = new Map<string, CoverageGroup>();

  for (const [key, label] of labels) {
    const name = groupOf(label);
    const group = groups.get(name) ?? { name, total: 0, published: 0, missing: [] };
    group.total += 1;
    if (published.has(key)) group.published += 1;
    else group.missing.push(label);
    groups.set(name, group);
  }

  const total = labels.size;
  const publishedCount = [...groups.values()].reduce((sum, g) => sum + g.published, 0);

  const unrecognised = [...new Set(publishedGlosses.map(coverageKey))]
    .filter((key) => !labels.has(key))
    .sort();

  return {
    total,
    published: publishedCount,
    missing: total - publishedCount,
    // Round toward zero: 130 of 131 must not read as 100%.
    percent: total === 0 ? 0 : Math.floor((publishedCount / total) * 100),
    groups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)),
    unrecognised,
  };
}
