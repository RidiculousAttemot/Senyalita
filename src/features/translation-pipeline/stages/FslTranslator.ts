import type { GlossTranslation, TranslationContext, DetectedLanguage } from "../types";
import type { FslTranslator as IFslTranslator } from "../interfaces";
import { globalDictionary } from "@/features/fsl-translation/dictionary/gestureDictionary";
import { globalResolver } from "@/features/fsl-translation/dictionary/unknownWordResolver";
import { applyGrammarRules } from "@/features/fsl-translation/grammar/fslGrammar";
import { resolveDisplayLabel, type LabelLanguage } from "@/features/fsl-translation/dictionary/displayLabel";

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
    // The window is bounded by the longest form the dictionary actually holds,
    // asked of the dictionary rather than hardcoded.
    const maxWindow = globalDictionary.maxPhraseWords();

    for (let i = 0; i < words.length; ) {
      let match: ReturnType<typeof globalDictionary.lookup> | undefined;
      let span = 0;

      for (let n = Math.min(maxWindow, words.length - i); n >= 1; n--) {
        const phrase = words.slice(i, i + n).join(" ").toLowerCase().trim();
        const hit = globalDictionary.lookup(phrase);
        if (hit) {
          match = hit;
          span = n;
          break;
        }
      }

      if (match) {
        const form = words.slice(i, i + span).join(" ");
        resolved.push({
          original: form,
          gloss: match.gloss,
          confidence: 0.95,
          strategy: "direct",
          category: match.category,
          // The gloss stays the animation key. displayLabel is presentation
          // only and never reaches asset resolution.
          animationKey: match.animationAsset ?? match.gloss,
          displayLabel: resolveDisplayLabel(
            match,
            language as LabelLanguage,
            globalDictionary.matchSource(form),
          ),
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
      // Grammar can rewrite a gloss. A label derived from the old one would
      // then name a different sign, so it only survives an unchanged gloss.
      displayLabel: resolved[i] && g === resolved[i].gloss ? resolved[i].displayLabel : undefined,
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
