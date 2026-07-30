import { PhraseDetector } from "./PhraseDetector";
import type { SentenceType, PlaybackSegment } from "../types";

interface ChunkGroup {
  originalText: string;
  indices: number[];
  type: "phrase" | "gloss_group";
}

export class SentenceChunker {
  private phraseDetector: PhraseDetector;

  constructor(phraseDetector?: PhraseDetector) {
    this.phraseDetector = phraseDetector ?? new PhraseDetector();
  }

  detectSentenceType(text: string): SentenceType {
    const upper = text.toUpperCase().trim();
    const greetings = ["HELLO", "HI", "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING", "NICE TO MEET YOU"];
    for (const g of greetings) {
      if (upper.includes(g)) return "greeting";
    }
    const farewells = ["GOODBYE", "BYE", "SEE YOU", "GOOD NIGHT", "TAKE CARE"];
    for (const f of farewells) {
      if (upper.includes(f)) return "greeting";
    }
    if (text.trim().endsWith("?")) return "question";
    if (text.trim().endsWith("!")) return "exclamation";
    if (upper.startsWith("IMPERATIVE") || ["STOP", "GO", "COME", "LOOK", "LISTEN", "SIT", "STAND"].some(c => upper.startsWith(c))) return "command";
    return "statement";
  }

  chunkIntoGroups(glosses: string[]): ChunkGroup[] {
    const phraseMatches = this.phraseDetector.detectPhrases(glosses);
    const usedIndices = new Set<number>();
    const groups: ChunkGroup[] = [];

    const sortedMatches = phraseMatches.sort((a, b) => b.phrase.phrase.split(" ").length - a.phrase.phrase.split(" ").length);

    for (const match of sortedMatches) {
      if (match.indices.some((i) => usedIndices.has(i))) continue;
      for (const i of match.indices) usedIndices.add(i);
      groups.push({
        originalText: match.phrase.phrase,
        indices: match.indices,
        type: "phrase",
      });
    }

    for (let i = 0; i < glosses.length; i++) {
      if (usedIndices.has(i)) continue;

      const groupIndices = [i];
      usedIndices.add(i);

      let j = i + 1;
      while (j < glosses.length && !usedIndices.has(j)) {
        const nextIsStandalone = (j - groupIndices[groupIndices.length - 1]) <= 1;
        const nextHasNoPhrase = !phraseMatches.some((m) => m.indices.includes(j));
        if (nextIsStandalone && nextHasNoPhrase) {
          groupIndices.push(j);
          usedIndices.add(j);
          j++;
        } else {
          break;
        }
      }

      groups.push({
        originalText: groupIndices.map((idx) => glosses[idx]).join(" "),
        indices: groupIndices,
        type: groupIndices.length > 1 ? "gloss_group" : "gloss_group",
      });
    }

    return groups.sort((a, b) => a.indices[0] - b.indices[0]);
  }

  getPhraseDetector(): PhraseDetector {
    return this.phraseDetector;
  }
}
