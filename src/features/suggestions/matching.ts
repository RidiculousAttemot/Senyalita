import type { VocabularyEntry } from "./vocabulary";

/**
 * Levenshtein distance, abandoned early once it exceeds `max`.
 *
 * Bounding matters: this runs against the whole vocabulary on every recognised
 * letter, and an unbounded O(n·m) over hundreds of entries would show up as
 * jitter in a 30fps pipeline.
 */
export function boundedEditDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowBest = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,      // deletion
        current[j - 1] + 1,   // insertion
        previous[j - 1] + cost, // substitution
      );
      if (current[j] < rowBest) rowBest = current[j];
    }
    // No cell in this row can improve, so no later row can come under `max`.
    if (rowBest > max) return max + 1;
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[b.length];
}

/** Edit budget scaled to length — one slip in "HI" is not like one in "GOODMORNING". */
export function editBudget(length: number): number {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  return 2;
}

export interface Segmentation {
  words: string[];
  /** Total edit cost across the segments; 0 means every word matched exactly. */
  cost: number;
}

/**
 * Splits an unspaced letter run into dictionary words — "HOWAREYOU" into
 * "HOW ARE YOU". Signers spell continuously with no space gesture, so the
 * boundaries have to be inferred.
 *
 * Dynamic programming over prefixes: best[i] is the cheapest way to cover the
 * first i letters.
 */
export function segmentIntoWords(
  key: string,
  entries: VocabularyEntry[],
  maxWords = 6,
): Segmentation | null {
  if (key.length === 0) return null;

  // Index by length so each position only tries plausible spans.
  const byKey = new Map<string, VocabularyEntry>();
  let longest = 0;
  for (const entry of entries) {
    // Only single words participate; multi-word entries are matched whole
    // elsewhere and would double-count here.
    if (entry.wordCount !== 1) continue;
    if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
    if (entry.key.length > longest) longest = entry.key.length;
  }

  type Cell = { cost: number; words: string[] } | null;
  const best: Cell[] = new Array(key.length + 1).fill(null);
  best[0] = { cost: 0, words: [] };

  for (let i = 0; i < key.length; i += 1) {
    const prefix = best[i];
    if (!prefix) continue;
    if (prefix.words.length >= maxWords) continue;

    for (let len = 2; len <= longest && i + len <= key.length; len += 1) {
      const slice = key.slice(i, i + len);
      const match = byKey.get(slice);
      if (!match) continue;

      const end = i + len;
      // Longer words are preferred: covering the same letters with fewer,
      // longer words is almost always the intended reading.
      const candidateCost = prefix.cost + 1;
      const existing = best[end];
      if (!existing || candidateCost < existing.cost) {
        best[end] = { cost: candidateCost, words: [...prefix.words, match.phrase] };
      }
    }
  }

  const complete = best[key.length];
  if (!complete || complete.words.length === 0) return null;
  return { words: complete.words, cost: complete.cost };
}
