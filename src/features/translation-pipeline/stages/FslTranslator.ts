import type { GlossTranslation, TranslationContext, DetectedLanguage } from "../types";
import type { FslTranslator as IFslTranslator } from "../interfaces";
import { globalDictionary } from "@/features/fsl-translation/dictionary/gestureDictionary";
import { globalResolver } from "@/features/fsl-translation/dictionary/unknownWordResolver";
import { applyGrammarRules } from "@/features/fsl-translation/grammar/fslGrammar";

export class FslTranslatorService implements IFslTranslator {
  readonly name = "FslTranslator";
  private context: TranslationContext = {
    previousInputs: [],
    previousGlosses: [],
    previousIntents: [],
    topic: [],
  };

  translate(words: string[], language: DetectedLanguage, context?: TranslationContext): GlossTranslation[] {
    const ctx = context ?? this.context;
    const resolved: GlossTranslation[] = [];

    for (const word of words) {
      const lower = word.toLowerCase().trim();
      const direct = globalDictionary.lookup(lower);

      if (direct) {
        resolved.push({
          original: word,
          gloss: direct.gloss,
          confidence: 0.95,
          strategy: "direct",
          category: direct.category,
          animationKey: direct.animationAsset ?? direct.gloss,
        });
        continue;
      }

      const resolution = globalResolver.resolve(word);
      resolved.push({
        original: word,
        gloss: resolution.resolvedGloss,
        confidence: resolution.confidence,
        strategy: resolution.strategy,
        animationKey: resolution.animationAsset ?? resolution.resolvedGloss,
      });
    }

    let glossTokens = resolved.map((g) => g.gloss);
    glossTokens = applyGrammarRules(glossTokens, language);

    const mapped: GlossTranslation[] = glossTokens.map((g, i) => ({
      ...resolved[i],
      gloss: g,
    }));

    if (ctx) {
      ctx.previousInputs.push(words.join(" "));
      ctx.previousGlosses.push(glossTokens.join(" "));
      if (ctx.previousInputs.length > 10) {
        ctx.previousInputs.shift();
        ctx.previousGlosses.shift();
      }
    }

    return mapped;
  }

  setContext(context: TranslationContext): void {
    this.context = context;
  }

  getContext(): TranslationContext {
    return { ...this.context };
  }

  clearContext(): void {
    this.context = {
      previousInputs: [],
      previousGlosses: [],
      previousIntents: [],
      topic: [],
    };
  }
}

export const defaultFslTranslator = new FslTranslatorService();
