import type { GlossTranslation, TranslationContext, DetectedLanguage } from "../types";
import type { FslTranslator as IFslTranslator } from "../interfaces";
import { maxPhraseWords, resolvePhrase, type PhraseMatch } from "@/features/fsl-translation/dictionary/phraseResolver";
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

    // Longest match first, consuming every token the match covered.
    //
    // This used to walk one word at a time and call lookup() with a single
    // token, which made every multi-word key in the dictionary unreachable.
    // "thank you" did not match as a phrase at all: token 1 "thank" matched --
    // it is also a synonym of THANK YOU -- and "you" was left to resolve on its
    // own, so the user got THANK YOU followed by a fingerspelled Y-O-U. 57
    // multi-word forms have at least one token that resolves standalone, so
    // this was never specific to THANK YOU.
    //
    // The window is bounded by the longest form either store actually holds,
    // asked of them rather than hardcoded. Admin-added phrases count: bounded
    // by the source dictionary alone, an alias longer than anything in it would
    // never be offered for lookup and would look unsaved.
    const maxWindow = maxPhraseWords();

    for (let i = 0; i < words.length; ) {
      let match: PhraseMatch | undefined;
      let span = 0;

      for (let n = Math.min(maxWindow, words.length - i); n >= 1; n--) {
        const phrase = words.slice(i, i + n).join(" ").toLowerCase().trim();
        // One resolver, so precedence between admin-added and built-in
        // mappings is stated once; see dictionary/phraseResolver.ts.
        const hit = resolvePhrase(phrase);
        if (hit) {
          match = hit;
          span = n;
          break;
        }
      }

      if (match) {
        resolved.push({
          original: words.slice(i, i + span).join(" "),
          gloss: match.gloss,
          confidence: 0.95,
          strategy: "direct",
          category: match.category,
          animationKey: match.animationKey,
        });
        i += span;
        continue;
      }

      const word = words[i];
      const resolution = globalResolver.resolve(word);
      resolved.push({
        original: word,
        gloss: resolution.resolvedGloss,
        confidence: resolution.confidence,
        strategy: resolution.strategy,
        animationKey: resolution.animationAsset ?? resolution.resolvedGloss,
      });
      i += 1;
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
