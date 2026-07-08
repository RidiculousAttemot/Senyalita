import type { FslTranslationResult, NormalizedText, TranslationIntent } from "../types";
import { normalizeText } from "../normalizer";
import { detectLanguage } from "../gloss/languageDetector";
import { detectIntent } from "../intent/intentDetector";
import { GlossGenerator } from "../gloss/glossGenerator";
import { tokenize } from "../tokenizer";
import { globalResolver } from "../dictionary/unknownWordResolver";

export interface TranslationOptions {
  useGrammar?: boolean;
  useContext?: boolean;
}

export class FslTranslationEngine {
  private glossGenerator = new GlossGenerator();

  translate(input: string, options?: TranslationOptions): FslTranslationResult {
    const startTime = performance.now();

    const normalized = normalizeText(input);
    const tokenized = tokenize(normalized.cleaned);
    const language = detectLanguage(tokenized.tokens);
    const intent = detectIntent(tokenized.tokens, normalized.cleaned);

    const result = this.glossGenerator.generate(
      normalized.words,
      language,
      intent,
      {
        useGrammar: options?.useGrammar ?? true,
        useContext: options?.useContext ?? false,
      },
    );

    result.processingTimeMs = Math.round(performance.now() - startTime);
    result.originalText = input;

    return result;
  }

  setContext(context: import("../types").TranslationContext): void {
    this.glossGenerator.setContext(context);
  }

  getContext(): import("../types").TranslationContext {
    return this.glossGenerator.getContext();
  }

  hasContext(): boolean {
    return this.glossGenerator.hasContext();
  }

  clearContext(): void {
    this.glossGenerator.clearContext();
  }

  getUnknownWords(): Array<{ word: string; count: number }> {
    return globalResolver.getUnknownWords();
  }

  clearUnknownLog(): void {
    globalResolver.clearLog();
  }

  getGlossGenerator(): GlossGenerator {
    return this.glossGenerator;
  }
}

export const globalEngine = new FslTranslationEngine();
