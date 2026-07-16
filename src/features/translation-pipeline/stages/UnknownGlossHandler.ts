import type { GlossTranslation, UnknownGlossResult } from "../types";
import type { UnknownGlossHandler as IUnknownGlossHandler } from "../interfaces";
import { globalDictionary } from "@/features/fsl-translation/dictionary/gestureDictionary";

const FALLBACK_PLACEHOLDER = "UNKNOWN";

const CATEGORY_FALLBACK: Record<string, string> = {
  greeting: "HELLO",
  farewell: "BYE",
  politeness: "THANK YOU",
  affirmation: "YES",
  negation: "NO",
  emotion: "HAPPY",
  description: "GOOD",
  family: "FAMILY",
  people: "PERSON",
  food: "FOOD",
  drink: "WATER",
  time: "NOW",
  number: "ONE",
  color: "BLUE",
  question: "WHAT",
  location: "HERE",
  action: "GO",
  pronoun: "I",
  conjunction: "AND",
  preposition: "WITH",
  adverb: "VERY",
  determiner: "THIS",
  verb: "DO",
  health: "GOOD",
  healthcare: "HELP",
  identity: "PERSON",
  relationship: "FRIEND",
  order: "FIRST",
  general: "GOOD",
};

const SYNONYM_FALLBACK_ENABLED = true;
const CATEGORY_FALLBACK_ENABLED = true;
const FINGERSPELLING_FALLBACK_ENABLED = true;

export class UnknownGlossHandlerService implements IUnknownGlossHandler {
  readonly name = "UnknownGlossHandler";

  handle(glosses: GlossTranslation[]): { handled: UnknownGlossResult[]; unhandled: string[] } {
    const handled: UnknownGlossResult[] = [];
    const unhandled: string[] = [];

    for (const gloss of glosses) {
      if (gloss.strategy !== "direct" && gloss.strategy !== "synonym") {
        const result = this.resolveUnknown(gloss);
        if (result) {
          handled.push(result);
        } else {
          unhandled.push(gloss.gloss);
        }
      }
    }

    return { handled, unhandled };
  }

  private resolveUnknown(gloss: GlossTranslation): UnknownGlossResult | null {
    if (SYNONYM_FALLBACK_ENABLED) {
      const synonyms = globalDictionary.findSynonyms(gloss.original);
      if (synonyms.length > 0) {
        for (const syn of synonyms) {
          const synEntry = globalDictionary.lookup(syn);
          if (synEntry?.animationAsset) {
            return {
              original: gloss.original,
              resolvedGloss: synEntry.gloss,
              strategy: "synonym",
              confidence: 0.6,
              animationKey: synEntry.animationAsset,
            };
          }
        }
      }
    }

    if (CATEGORY_FALLBACK_ENABLED) {
      const category = gloss.category ?? this.guessCategory(gloss.original);
      const fallback = CATEGORY_FALLBACK[category];
      if (fallback) {
        const entry = globalDictionary.lookup(fallback.toLowerCase());
        if (entry?.animationAsset) {
          return {
            original: gloss.original,
            resolvedGloss: entry.gloss,
            strategy: "parent_category",
            confidence: 0.4,
            animationKey: entry.animationAsset,
          };
        }
      }
    }

    if (FINGERSPELLING_FALLBACK_ENABLED && gloss.original.length > 0) {
      const firstLetter = gloss.original[0].toUpperCase();
      if (/^[A-Z]$/.test(firstLetter)) {
        const letterEntry = globalDictionary.lookup(firstLetter);
        if (letterEntry?.animationAsset) {
          return {
            original: gloss.original,
            resolvedGloss: firstLetter,
            strategy: "fingerspelling",
            confidence: 0.3,
            animationKey: letterEntry.animationAsset,
          };
        }
      }
    }

    return {
      original: gloss.original,
      resolvedGloss: FALLBACK_PLACEHOLDER,
      strategy: "placeholder",
      confidence: 0.1,
      animationKey: undefined,
    };
  }

  private guessCategory(word: string): string {
    const greeting = ["hello", "hi", "hey", "morning", "afternoon", "evening", "kumusta", "kamusta"];
    const farewell = ["bye", "goodbye", "paalam", "see"];
    const politeness = ["thank", "thanks", "salamat", "please", "sorry", "pakisuyo"];
    const question = ["what", "where", "when", "why", "how", "who", "which", "ano", "saan", "bakit", "kailan", "paano", "sino"];
    const emotion = ["happy", "sad", "angry", "love", "like", "hate", "masaya", "malungkot", "galit"];
    const family = ["father", "mother", "son", "daughter", "brother", "sister", "uncle", "aunt", "tatay", "nanay"];
    const food = ["rice", "bread", "food", "eat", "drink", "kanin", "tinapay", "pagkain"];
    const time = ["today", "tomorrow", "yesterday", "now", "later", "ngayon", "bukas", "kahapon"];
    const number = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "isa", "dalawa", "tatlo"];
    const color = ["red", "blue", "green", "yellow", "black", "white", "pula", "asul", "berde"];

    const lower = word.toLowerCase();
    if (greeting.includes(lower)) return "greeting";
    if (farewell.includes(lower)) return "farewell";
    if (politeness.includes(lower)) return "politeness";
    if (question.includes(lower)) return "question";
    if (emotion.includes(lower)) return "emotion";
    if (family.includes(lower)) return "family";
    if (food.includes(lower)) return "food";
    if (time.includes(lower)) return "time";
    if (number.includes(lower)) return "number";
    if (color.includes(lower)) return "color";
    return "general";
  }
}

export const defaultUnknownGlossHandler = new UnknownGlossHandlerService();
