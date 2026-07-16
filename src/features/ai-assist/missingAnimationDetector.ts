import { WORD_TO_GLOSS } from "@/features/gesture-mapping/glossDictionary";

export interface MissingAnimationEntry {
  word: string;
  gloss: string;
  priority: "high" | "medium" | "low";
  reason: string;
}

export interface CoverageReport {
  totalGlosses: number;
  coveredGlosses: number;
  missingGlosses: number;
  coveragePercent: number;
  missingEntries: MissingAnimationEntry[];
}

export function detectMissingAnimations(
  existingGlosses: string[],
  frequencyMap?: Record<string, number>,
): CoverageReport {
  const uniqueExisting = new Set(existingGlosses.map((g) => g.toUpperCase()));
  const allGlosses = new Set<string>();
  const wordToGlossOut: Record<string, string> = {};

  for (const [word, gloss] of Object.entries(WORD_TO_GLOSS)) {
    const upper = gloss.toUpperCase();
    allGlosses.add(upper);
    wordToGlossOut[word] = upper;
  }

  const covered = new Set<string>();
  for (const g of allGlosses) {
    if (uniqueExisting.has(g)) covered.add(g);
  }

  const missingEntries: MissingAnimationEntry[] = [];
  for (const [word, gloss] of Object.entries(wordToGlossOut)) {
    if (!covered.has(gloss)) {
      const freq = frequencyMap?.[word.toLowerCase()] ?? 0;
      const priority: "high" | "medium" | "low" =
        freq > 100 ? "high"
        : freq > 20 ? "medium"
        : "low";
      const reason =
        freq > 0
          ? `Used ${freq} time(s) in translations`
          : "Listed in gloss dictionary";
      missingEntries.push({ word, gloss, priority, reason });
    }
  }

  missingEntries.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  return {
    totalGlosses: allGlosses.size,
    coveredGlosses: covered.size,
    missingGlosses: missingEntries.length,
    coveragePercent: Math.round((covered.size / allGlosses.size) * 100),
    missingEntries,
  };
}
