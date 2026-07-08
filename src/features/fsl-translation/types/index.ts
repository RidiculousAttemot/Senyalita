export type DetectedLanguage = "en" | "tl" | "mixed";

export interface LanguageDetectionResult {
  language: DetectedLanguage;
  confidence: number;
}

export interface NormalizedText {
  original: string;
  cleaned: string;
  words: string[];
}

export type TranslationIntent =
  | "greeting"
  | "farewell"
  | "question"
  | "statement"
  | "request"
  | "affirmation"
  | "negation"
  | "unknown";

export interface UnknownResolution {
  strategy: "direct" | "synonym" | "related" | "fingerspelling";
  originalWord: string;
  resolvedGloss: string;
  confidence: number;
  animationAsset?: string;
}

export interface FslGlossWord {
  original: string;
  gloss: string;
  resolution: UnknownResolution;
}

export interface FslTranslationResult {
  originalText: string;
  detectedLanguage: LanguageDetectionResult;
  glossSequence: FslGlossWord[];
  glossText: string;
  intent: TranslationIntent;
  contextUsed: boolean;
  processingTimeMs: number;
}

export interface DictionaryEntry {
  label: string;
  gloss: string;
  synonyms: string[];
  english: string[];
  filipino: string[];
  category: string;
  animationAsset?: string;
  referenceVideo?: string;
  suggestedReplies?: string[];
}

export interface GrammarRule {
  name: string;
  pattern: string[];
  replacement: string[];
  priority: number;
  languages: Array<"en" | "tl" | "mixed">;
  description: string;
}

export interface TranslationContext {
  previousInputs: string[];
  previousGlosses: string[];
  previousIntents: TranslationIntent[];
  topic: string[];
}
