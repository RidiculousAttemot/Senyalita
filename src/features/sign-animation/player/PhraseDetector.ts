import type { PhraseEntry } from "../types";

const PHRASE_MAP: PhraseEntry[] = [
  { phrase: "GOOD MORNING", canonicalKey: "GOOD_MORNING", type: "greeting" },
  { phrase: "GOOD AFTERNOON", canonicalKey: "GOOD_AFTERNOON", type: "greeting" },
  { phrase: "GOOD EVENING", canonicalKey: "GOOD_EVENING", type: "greeting" },
  { phrase: "HOW ARE YOU", canonicalKey: "HOW_ARE_YOU", type: "question" },
  { phrase: "THANK YOU", canonicalKey: "THANK_YOU", type: "politeness" },
  { phrase: "I LOVE YOU", canonicalKey: "I_LOVE_YOU", type: "common" },
  { phrase: "SEE YOU TOMORROW", canonicalKey: "SEE_YOU_TOMORROW", type: "farewell" },
  { phrase: "WHAT IS YOUR NAME", canonicalKey: "WHAT_IS_YOUR_NAME", type: "question" },
  { phrase: "PLEASE HELP ME", canonicalKey: "PLEASE_HELP_ME", type: "politeness" },
  { phrase: "NICE TO MEET YOU", canonicalKey: "NICE_TO_MEET_YOU", type: "greeting" },
  { phrase: "I AM FINE", canonicalKey: "IM_FINE", type: "common" },
  { phrase: "THANK YOU VERY MUCH", canonicalKey: "THANK_YOU_VERY_MUCH", type: "politeness" },
  { phrase: "YOU ARE WELCOME", canonicalKey: "YOU_ARE_WELCOME", type: "politeness" },
  { phrase: "SEE YOU LATER", canonicalKey: "SEE_YOU_LATER", type: "farewell" },
  { phrase: "TAKE CARE", canonicalKey: "TAKE_CARE", type: "farewell" },
  { phrase: "HOW MUCH", canonicalKey: "HOW_MUCH", type: "question" },
  { phrase: "WHERE IS", canonicalKey: "WHERE_IS", type: "question" },
  { phrase: "I DONT KNOW", canonicalKey: "DONT_KNOW", type: "common" },
  { phrase: "I DONT UNDERSTAND", canonicalKey: "DONT_UNDERSTAND", type: "common" },
  { phrase: "CAN YOU HELP ME", canonicalKey: "CAN_YOU_HELP_ME", type: "politeness" },
  { phrase: "I NEED HELP", canonicalKey: "I_NEED_HELP", type: "politeness" },
  { phrase: "WHAT TIME", canonicalKey: "WHAT_TIME", type: "question" },
  { phrase: "HOW OLD ARE YOU", canonicalKey: "HOW_OLD_ARE_YOU", type: "question" },
  { phrase: "WHERE DO YOU LIVE", canonicalKey: "WHERE_DO_YOU_LIVE", type: "question" },
  { phrase: "I AM SORRY", canonicalKey: "SORRY", type: "politeness" },
  { phrase: "GOOD LUCK", canonicalKey: "GOOD_LUCK", type: "common" },
  { phrase: "HAPPY BIRTHDAY", canonicalKey: "HAPPY_BIRTHDAY", type: "common" },
  { phrase: "MERRY CHRISTMAS", canonicalKey: "MERRY_CHRISTMAS", type: "common" },
];

export class PhraseDetector {
  private phrases: PhraseEntry[];
  private phraseLookup: Map<string, PhraseEntry>;

  constructor() {
    this.phrases = PHRASE_MAP;
    this.phraseLookup = new Map();
    for (const entry of this.phrases) {
      this.phraseLookup.set(entry.phrase, entry);
    }
  }

  detectPhrases(glosses: string[]): Array<{ phrase: PhraseEntry; indices: number[] }> {
    const result: Array<{ phrase: PhraseEntry; indices: number[] }> = [];
    const joined = glosses.join(" ");
    for (const entry of this.phrases) {
      const searchPhrase = entry.phrase;
      const searchTokens = searchPhrase.split(" ");
      for (let i = 0; i <= glosses.length - searchTokens.length; i++) {
        const slice = glosses.slice(i, i + searchTokens.length).join(" ");
        if (slice === searchPhrase) {
          result.push({ phrase: entry, indices: Array.from({ length: searchTokens.length }, (_, j) => i + j) });
        }
      }
    }
    return result;
  }

  detectPhrasesInText(text: string): PhraseEntry[] {
    const upper = text.toUpperCase().replace(/[^\w\s]/g, "");
    const found: PhraseEntry[] = [];
    for (const entry of this.phrases) {
      if (upper.includes(entry.phrase)) {
        found.push(entry);
      }
    }
    return found;
  }

  isPhrase(text: string): boolean {
    const normalized = text.toUpperCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    return this.phraseLookup.has(normalized);
  }

  getPhrase(text: string): PhraseEntry | null {
    const normalized = text.toUpperCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    return this.phraseLookup.get(normalized) ?? null;
  }

  getAllPhrases(): PhraseEntry[] {
    return [...this.phrases];
  }

  addPhrase(entry: PhraseEntry): void {
    this.phrases.push(entry);
    this.phraseLookup.set(entry.phrase, entry);
  }
}
