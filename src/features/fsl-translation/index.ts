export { FslTranslationEngine, globalEngine } from "./engine/fslTranslationEngine";
export type { TranslationOptions } from "./engine/fslTranslationEngine";
export { GestureDictionary, globalDictionary } from "./dictionary/gestureDictionary";
export { UnknownWordResolver, globalResolver } from "./dictionary/unknownWordResolver";
export type { UnknownWordReport } from "./dictionary/unknownWordResolver";
export { GlossGenerator } from "./gloss/glossGenerator";
export type { GlossGeneratorOptions } from "./gloss/glossGenerator";
export { detectLanguage } from "./gloss/languageDetector";
export { detectIntent } from "./intent/intentDetector";
export { normalizeText } from "./normalizer";
export { tokenize } from "./tokenizer";
export { applyGrammarRules, getGrammarRules, addGrammarRule } from "./grammar/fslGrammar";
export { useFslTranslation } from "./hooks/useFslTranslation";
export type { UseFslTranslationOptions, FslTranslationState } from "./hooks/useFslTranslation";

export type {
  FslTranslationResult,
  FslGlossWord,
  UnknownResolution,
  DictionaryEntry,
  GrammarRule,
  LanguageDetectionResult,
  DetectedLanguage,
  NormalizedText,
  TranslationIntent,
  TranslationContext,
} from "./types";
