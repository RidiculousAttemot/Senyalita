import type {
  TranslationPipelineResult,
  PipelineStageResult,
  TranslationEvalRecord,
} from "./types";
import type {
  PipelineConfig,
  PipelineObserver,
  LanguageDetector,
  TextNormalizer,
  SentenceSegmenter,
  FslTranslator,
  GlossOptimizer,
  AnimationPlanner,
  CoarticulationController,
  ExpressionController,
  UnknownGlossHandler,
} from "./interfaces";

import { defaultLanguageDetector } from "./stages/LanguageDetector";
import { defaultTextNormalizer } from "./stages/TextNormalizer";
import { defaultSentenceSegmenter } from "./stages/SentenceSegmenter";
import { defaultFslTranslator } from "./stages/FslTranslator";
import { defaultGlossOptimizer } from "./stages/GlossOptimizer";
import { defaultAnimationPlanner } from "./stages/AnimationPlanner";
import { defaultCoarticulationBridge } from "./stages/CoarticulationBridge";
import { defaultExpressionController } from "./stages/ExpressionController";
import { defaultUnknownGlossHandler } from "./stages/UnknownGlossHandler";
import { globalMetricsCollector, computeMetrics } from "./utils/metrics";

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  stages: {
    languageDetector: defaultLanguageDetector,
    normalizer: defaultTextNormalizer,
    segmenter: defaultSentenceSegmenter,
    translator: defaultFslTranslator,
    glossOptimizer: defaultGlossOptimizer,
    animationPlanner: defaultAnimationPlanner,
    coarticulation: defaultCoarticulationBridge,
    expressionController: defaultExpressionController,
    unknownGlossHandler: defaultUnknownGlossHandler,
  },
  debugMode: false,
  collectMetrics: true,
};

export class PipelineOrchestrator {
  private config: PipelineConfig;
  private observers: PipelineObserver[] = [];

  constructor(config?: Partial<PipelineConfig>) {
    this.config = this.mergeConfig(DEFAULT_PIPELINE_CONFIG, config ?? {});
  }

  private mergeConfig(base: PipelineConfig, override: Partial<PipelineConfig>): PipelineConfig {
    return {
      ...base,
      ...override,
      stages: {
        ...base.stages,
        ...(override.stages ?? {}),
      },
    };
  }

  translate(input: string): TranslationPipelineResult {
    const startTime = performance.now();
    const stageResults: PipelineStageResult[] = [];

    const stages = this.config.stages;

    const langResult = this.runStage("LanguageDetector", () =>
      stages.languageDetector.detect(input, input.toLowerCase().split(/\s+/))
    , stageResults);

    const normalized = this.runStage("TextNormalizer", () =>
      stages.normalizer.normalize(input)
    , stageResults);

    const sentences = this.runStage("SentenceSegmenter", () =>
      stages.segmenter.segment(normalized.normalized)
    , stageResults);

    const glossSequence = this.runStage("FslTranslator", () =>
      stages.translator.translate(normalized.words, langResult.language)
    , stageResults);

    const optimizedGlosses = this.runStage("GlossOptimizer", () =>
      stages.glossOptimizer.optimize(glossSequence, langResult.language)
    , stageResults);

    const unknownResult = this.runStage("UnknownGlossHandler", () =>
      stages.unknownGlossHandler.handle(glossSequence)
    , stageResults);

    const plan = this.runStage("AnimationPlanner", () =>
      stages.animationPlanner.plan(optimizedGlosses, langResult.language)
    , stageResults);

    for (const o of optimizedGlosses) {
      const transition = stages.coarticulation.computeTransition(
        o.gloss,
        o.gloss
      );
    }

    for (const o of optimizedGlosses) {
      o.expressionTag = stages.expressionController.getExpressionTag(
        o.gloss,
        input,
        langResult.language
      );
    }

    const totalProcessingTimeMs = Math.round(performance.now() - startTime);

    const metrics = computeMetrics(
      unknownResult.unhandled.length,
      unknownResult.handled.filter((h) => h.strategy === "placeholder").length,
      glossSequence.length,
      glossSequence.map((g) => g.confidence),
      plan.totalDuration,
    );

    const result: TranslationPipelineResult = {
      originalText: input,
      normalized,
      language: langResult,
      sentences,
      glossSequence,
      optimizedGlosses,
      animationPlan: plan,
      unknownGlosses: unknownResult.handled,
      stageResults,
      totalProcessingTimeMs,
      metrics: {
        ...metrics,
        inputLength: input.length,
        wordCount: normalized.words.length,
      },
    };

    if (this.config.collectMetrics) {
      const record: TranslationEvalRecord = {
        timestamp: Date.now(),
        input,
        glossSequence: glossSequence.map((g) => g.gloss),
        unknownWords: unknownResult.handled.map((h) => h.original),
        fallbackCount: unknownResult.handled.filter((h) => h.strategy !== "synonym").length,
        processingTimeMs: totalProcessingTimeMs,
        confidence: metrics.averageConfidence,
        planDuration: plan.totalDuration,
      };
      globalMetricsCollector.recordTranslation(record);

      for (const h of unknownResult.handled) {
        if (h.strategy !== "synonym") {
          globalMetricsCollector.recordFallback(h.resolvedGloss);
        }
      }
    }

    for (const obs of this.observers) {
      obs.onPipelineComplete?.(result);
    }

    return result;
  }

  private runStage<T>(name: string, fn: () => T, results: PipelineStageResult[]): T {
    const stageStart = performance.now();
    const result: PipelineStageResult = {
      stageName: name,
      durationMs: 0,
      success: true,
    };

    try {
      const output = fn();
      result.durationMs = Math.round(performance.now() - stageStart);
      result.data = output;
      results.push(result);
      return output;
    } catch (error) {
      result.durationMs = Math.round(performance.now() - stageStart);
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
      results.push(result);
      throw error;
    }
  }

  setConfig(config: Partial<PipelineConfig>): void {
    this.config = this.mergeConfig(this.config, config);
  }

  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  replaceStage<K extends keyof PipelineConfig["stages"]>(
    key: K,
    stage: PipelineConfig["stages"][K]
  ): void {
    this.config.stages[key] = stage;
  }

  getStage<K extends keyof PipelineConfig["stages"]>(
    key: K
  ): PipelineConfig["stages"][K] {
    return this.config.stages[key];
  }

  subscribe(observer: PipelineObserver): () => void {
    this.observers.push(observer);
    return () => {
      const idx = this.observers.indexOf(observer);
      if (idx >= 0) this.observers.splice(idx, 1);
    };
  }

  clearContext(): void {
    if (this.config.stages.translator.clearContext) {
      this.config.stages.translator.clearContext();
    }
  }
}

export const globalPipeline = new PipelineOrchestrator();
