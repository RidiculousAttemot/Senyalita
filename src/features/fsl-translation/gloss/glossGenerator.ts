import type { FslGlossWord, FslTranslationResult, LanguageDetectionResult, TranslationIntent, TranslationContext } from "../types";
import { globalDictionary } from "../dictionary/gestureDictionary";
import { globalResolver } from "../dictionary/unknownWordResolver";
import { applyGrammarRules } from "../grammar/fslGrammar";

export interface GlossGeneratorOptions {
  useGrammar: boolean;
  useContext: boolean;
  defaultLanguage?: "en" | "tl" | "mixed";
}

export class GlossGenerator {
  private context: TranslationContext = {
    previousInputs: [],
    previousGlosses: [],
    previousIntents: [],
    topic: [],
  };

  generate(
    words: string[],
    language: LanguageDetectionResult,
    intent: TranslationIntent,
    options?: Partial<GlossGeneratorOptions>,
  ): FslTranslationResult {
    const startTime = performance.now();
    const opts: GlossGeneratorOptions = {
      useGrammar: true,
      useContext: false,
      ...options,
    };

    const resolved: FslGlossWord[] = [];
    const unknownWords: string[] = [];

    for (const word of words) {
      const resolution = globalResolver.resolve(word);
      resolved.push({
        original: word,
        gloss: resolution.resolvedGloss,
        resolution,
      });

      if (resolution.strategy !== "direct" && resolution.strategy !== "synonym") {
        unknownWords.push(word);
      }
    }

    let glossTokens = resolved.map((g) => g.gloss);

    if (opts.useGrammar) {
      glossTokens = applyGrammarRules(glossTokens, language.language);
    }

    const contextUsed = opts.useContext && this.hasContext();

    const result: FslTranslationResult = {
      originalText: words.join(" "),
      detectedLanguage: language,
      glossSequence: glossTokens.map((g, i) => ({
        ...resolved[i],
        gloss: g,
      })),
      glossText: glossTokens.join(" "),
      intent,
      contextUsed,
      processingTimeMs: Math.round(performance.now() - startTime),
    };

    this.updateContext(result);

    return result;
  }

  private updateContext(result: FslTranslationResult): void {
    this.context.previousInputs.push(result.originalText);
    this.context.previousGlosses.push(result.glossText);
    this.context.previousIntents.push(result.intent);

    if (this.context.previousInputs.length > 10) {
      this.context.previousInputs.shift();
      this.context.previousGlosses.shift();
      this.context.previousIntents.shift();
    }
  }

  setContext(ctx: TranslationContext): void {
    this.context = ctx;
  }

  getContext(): TranslationContext {
    return { ...this.context };
  }

  hasContext(): boolean {
    return this.context.previousInputs.length > 0;
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
