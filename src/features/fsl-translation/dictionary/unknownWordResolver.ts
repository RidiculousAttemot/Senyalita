import type { UnknownResolution, DictionaryEntry } from "../types";
import { globalDictionary } from "./gestureDictionary";

export interface UnknownWordReport {
  word: string;
  resolved: UnknownResolution;
}

export class UnknownWordResolver {
  private unknownLog: Map<string, number> = new Map();

  resolve(word: string): UnknownResolution {
    const lower = word.toLowerCase().trim();

    const direct = globalDictionary.lookup(lower);
    if (direct) {
      return {
        strategy: "direct",
        originalWord: word,
        resolvedGloss: direct.gloss,
        confidence: 1,
        animationAsset: direct.animationAsset,
      };
    }

    const synEntry = globalDictionary.searchByEnglish(lower);
    if (synEntry.length > 0) {
      const best = synEntry[0];
      return {
        strategy: "synonym",
        originalWord: word,
        resolvedGloss: best.gloss,
        confidence: 0.8,
        animationAsset: best.animationAsset,
      };
    }

    const tlEntry = globalDictionary.searchByFilipino(lower);
    if (tlEntry.length > 0) {
      const best = tlEntry[0];
      return {
        strategy: "synonym",
        originalWord: word,
        resolvedGloss: best.gloss,
        confidence: 0.75,
        animationAsset: best.animationAsset,
      };
    }

    for (const entry of globalDictionary.getAllEntries()) {
      if (entry.synonyms.some((s) => s.toLowerCase() === lower)) {
        return {
          strategy: "synonym",
          originalWord: word,
          resolvedGloss: entry.gloss,
          confidence: 0.85,
          animationAsset: entry.animationAsset,
        };
      }
    }

    if (lower.length > 3) {
      const related = this.findRelatedBySubstring(lower);
      if (related) {
        return {
          strategy: "related",
          originalWord: word,
          resolvedGloss: related.gloss,
          confidence: 0.4,
          animationAsset: related.animationAsset,
        };
      }
    }

    this.logUnknown(word);

    if (lower.length === 1 && /^[a-z]$/.test(lower)) {
      const label = lower.toUpperCase();
      const entry = globalDictionary.lookup(label);
      if (entry) {
        return {
          strategy: "fingerspelling",
          originalWord: word,
          resolvedGloss: label,
          confidence: 0.9,
          animationAsset: entry.animationAsset,
        };
      }
    }

    return {
      strategy: "fingerspelling",
      originalWord: word,
      resolvedGloss: lower.toUpperCase(),
      confidence: 0.3,
    };
  }

  private findRelatedBySubstring(word: string): DictionaryEntry | undefined {
    const lower = word.toLowerCase();
    let best: DictionaryEntry | undefined;
    let bestScore = 0;

    for (const entry of globalDictionary.getAllEntries()) {
      for (const syn of entry.synonyms) {
        const synLower = syn.toLowerCase();
        if (synLower.includes(lower) || lower.includes(synLower)) {
          const score = Math.min(synLower.length, lower.length) / Math.max(synLower.length, lower.length);
          if (score > bestScore) {
            bestScore = score;
            best = entry;
          }
        }
      }
    }

    if (bestScore > 0.5) return best;
    return undefined;
  }

  private logUnknown(word: string): void {
    const lower = word.toLowerCase();
    this.unknownLog.set(lower, (this.unknownLog.get(lower) ?? 0) + 1);
  }

  getUnknownWords(): Array<{ word: string; count: number }> {
    return [...this.unknownLog.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);
  }

  clearLog(): void {
    this.unknownLog.clear();
  }
}

export const globalResolver = new UnknownWordResolver();
