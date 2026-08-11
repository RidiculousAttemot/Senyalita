import type { GlossTranslation, OptimizedGloss, DetectedLanguage } from "../types";
import type { GlossOptimizer as IGlossOptimizer } from "../interfaces";

const FILLER_WORDS = new Set([
  "uh", "um", "ah", "like", "well", "so", "actually", "basically",
  "literally", "honestly", "seriously", "you know", "i mean",
  "sort of", "kind of", "anyway", "whatever", "just",
]);

const DUPLICATE_GLOSSES = new Map<string, string>([
  ["I", "I"],
  ["YOU", "YOU"],
  ["HE", "HE"],
  ["SHE", "SHE"],
  ["IT", "IT"],
  ["WE", "WE"],
  ["THEY", "THEY"],
  ["YES", "YES"],
  ["NO", "NO"],
  ["NOT", "NOT"],
  ["IS", "IS"],
  ["AM", "AM"],
  ["ARE", "ARE"],
  ["WAS", "WAS"],
  ["WERE", "WERE"],
  ["BE", "BE"],
  ["HAVE", "HAVE"],
  ["HAS", "HAS"],
  ["HAD", "HAD"],
  ["DO", "DO"],
  ["DOES", "DOES"],
  ["DID", "DID"],
]);

const FSL_ORDER_VERB_SUBJECT = new Set([
  "COME", "GO", "STOP", "EAT", "DRINK", "SLEEP", "WORK",
  "WANT", "NEED", "HAVE", "HELP", "LIKE", "LOVE", "SEE",
  "HEAR", "KNOW", "UNDERSTAND",
]);

export class GlossOptimizerService implements IGlossOptimizer {
  readonly name = "GlossOptimizer";

  optimize(glosses: GlossTranslation[], _language: DetectedLanguage): OptimizedGloss[] {
    let filtered = this.removeFillers(glosses);
    filtered = this.collapseDuplicates(filtered);
    filtered = this.applyFslWordOrder(filtered, _language);
    filtered = this.minimizeTransitions(filtered);

    return filtered.map((g) => ({
      original: g.original,
      gloss: g.gloss,
      confidence: g.confidence,
      strategy: g.strategy,
      category: g.category,
      animationKey: g.animationKey,
      expressionTag: g.expressionTag ?? "neutral",
      isFiller: false,
      isDuplicate: false,
    }));
  }

  private removeFillers(glosses: GlossTranslation[]): GlossTranslation[] {
    return glosses.filter((g) => !FILLER_WORDS.has(g.original.toLowerCase()));
  }

  private collapseDuplicates(glosses: GlossTranslation[]): GlossTranslation[] {
    const result: GlossTranslation[] = [];

    for (let i = 0; i < glosses.length; i++) {
      const current = glosses[i];
      const prev = result[result.length - 1];

      if (prev && this.areGlossesCompatible(prev.gloss, current.gloss)) {
        continue;
      }

      result.push(current);
    }

    return result;
  }

  private areGlossesCompatible(a: string, b: string): boolean {
    const aUpper = a.toUpperCase();
    const bUpper = b.toUpperCase();

    if (aUpper === bUpper) return true;

    const aBase = DUPLICATE_GLOSSES.get(aUpper) ?? aUpper;
    const bBase = DUPLICATE_GLOSSES.get(bUpper) ?? bUpper;
    if (aBase === bBase) return true;

    return false;
  }

  private applyFslWordOrder(glosses: GlossTranslation[], _language: DetectedLanguage): GlossTranslation[] {
    if (glosses.length < 2) return glosses;

    const timeLabels = new Set([
      "TODAY", "TOMORROW", "YESTERDAY", "NOW", "LATER",
      "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
      "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
      "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
      "MORNING", "AFTERNOON", "EVENING", "NIGHT",
    ]);

    const timeMarkers = glosses.filter((g) => timeLabels.has(g.gloss.toUpperCase()));
    const nonTime = glosses.filter((g) => !timeLabels.has(g.gloss.toUpperCase()));

    if (_language === "tl" || _language === "mixed") {
      const verbs = nonTime.filter((g) => FSL_ORDER_VERB_SUBJECT.has(g.gloss.toUpperCase()));
      const nonVerbs = nonTime.filter((g) => !FSL_ORDER_VERB_SUBJECT.has(g.gloss.toUpperCase()));
      return [...timeMarkers, ...verbs, ...nonVerbs];
    }

    return [...timeMarkers, ...nonTime];
  }

  private minimizeTransitions(glosses: GlossTranslation[]): GlossTranslation[] {
    return glosses;
  }
}

export const defaultGlossOptimizer = new GlossOptimizerService();
