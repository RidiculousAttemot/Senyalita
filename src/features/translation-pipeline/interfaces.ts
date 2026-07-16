import type {
  LanguageDetectionResult,
  NormalizationResult,
  SentenceSegment,
  GlossTranslation,
  OptimizedGloss,
  AnimationPlan,
  UnknownGlossResult,
  TranslationPipelineResult,
  TranslationContext,
} from "./types";

export interface LanguageDetector {
  name: string;
  detect(input: string, words: string[]): LanguageDetectionResult;
  setConfig?(config: Record<string, unknown>): void;
}

export interface TextNormalizer {
  name: string;
  normalize(input: string): NormalizationResult;
  setConfig?(config: Record<string, unknown>): void;
}

export interface SentenceSegmenter {
  name: string;
  segment(input: string): SentenceSegment[];
  setConfig?(config: Record<string, unknown>): void;
}

export interface FslTranslator {
  name: string;
  translate(words: string[], language: DetectedLanguage, context?: TranslationContext): GlossTranslation[];
  setContext?(context: TranslationContext): void;
  getContext?(): TranslationContext;
  clearContext?(): void;
}

import type { DetectedLanguage } from "./types";

export interface GlossOptimizer {
  name: string;
  optimize(glosses: GlossTranslation[], language: DetectedLanguage): OptimizedGloss[];
  setConfig?(config: Record<string, unknown>): void;
}

export interface AnimationPlanner {
  name: string;
  plan(glosses: OptimizedGloss[], language: DetectedLanguage): AnimationPlan;
  setConfig?(config: Record<string, unknown>): void;
}

export interface CoarticulationController {
  name: string;
  computeTransition(fromGloss: string, toGloss: string): { duration: number; blendType: string };
  setConfig?(config: Record<string, unknown>): void;
}

export interface ExpressionController {
  name: string;
  getExpressionTag(gloss: string, context: string, language: DetectedLanguage): import("./types").ExpressionTag;
  setConfig?(config: Record<string, unknown>): void;
}

export interface UnknownGlossHandler {
  name: string;
  handle(glosses: GlossTranslation[]): { handled: UnknownGlossResult[]; unhandled: string[] };
  setConfig?(config: Record<string, unknown>): void;
}

export interface PipelineStage {
  name: string;
  enabled: boolean;
  execute(input: unknown, context?: Record<string, unknown>): Promise<unknown> | unknown;
  setEnabled?(enabled: boolean): void;
}

export interface PipelineConfig {
  stages: {
    languageDetector: LanguageDetector;
    normalizer: TextNormalizer;
    segmenter: SentenceSegmenter;
    translator: FslTranslator;
    glossOptimizer: GlossOptimizer;
    animationPlanner: AnimationPlanner;
    coarticulation: CoarticulationController;
    expressionController: ExpressionController;
    unknownGlossHandler: UnknownGlossHandler;
  };
  debugMode?: boolean;
  collectMetrics?: boolean;
}

export interface PipelineObserver {
  onStageStart?(stageName: string, input: unknown): void;
  onStageComplete?(stageName: string, output: unknown, durationMs: number): void;
  onStageError?(stageName: string, error: Error): void;
  onPipelineComplete?(result: TranslationPipelineResult): void;
}

export interface NeuralMtAdapter {
  name: string;
  isAvailable(): boolean;
  translate(text: string, sourceLang: string, targetLang: string): Promise<string>;
  setModel?(modelPath: string): Promise<void>;
}

export interface SignWritingAdapter {
  name: string;
  glossToSignWriting(gloss: string): Promise<string>;
  signWritingToGloss(sw: string): Promise<string>;
}

export interface LLMTranslationAdapter {
  name: string;
  isAvailable(): boolean;
  translateWithLLM(text: string, context?: string): Promise<string>;
}
