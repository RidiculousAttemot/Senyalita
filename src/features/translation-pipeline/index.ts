export { PipelineOrchestrator, globalPipeline, DEFAULT_PIPELINE_CONFIG } from "./PipelineOrchestrator";
export type { PipelineConfig, PipelineObserver } from "./interfaces";

export { LanguageDetectorService, defaultLanguageDetector } from "./stages/LanguageDetector";
export { TextNormalizerService, defaultTextNormalizer } from "./stages/TextNormalizer";
export { SentenceSegmenterService, defaultSentenceSegmenter } from "./stages/SentenceSegmenter";
export { FslTranslatorService, defaultFslTranslator } from "./stages/FslTranslator";
export { GlossOptimizerService, defaultGlossOptimizer } from "./stages/GlossOptimizer";
export { AnimationPlannerService, defaultAnimationPlanner } from "./stages/AnimationPlanner";
export { CoarticulationBridgeService, defaultCoarticulationBridge } from "./stages/CoarticulationBridge";
export { ExpressionControllerService, defaultExpressionController } from "./stages/ExpressionController";
export { UnknownGlossHandlerService, defaultUnknownGlossHandler } from "./stages/UnknownGlossHandler";

export { globalMetricsCollector, computeMetrics } from "./utils/metrics";

export type {
  DetectedLanguage,
  LanguageDetectionResult,
  NormalizationResult,
  SentenceSegment,
  GlossTranslation,
  OptimizedGloss,
  ExpressionTag,
  AnimationPlanItem,
  AnimationPlan,
  TimelineSegment,
  TimelineTransition,
  UnknownGlossResult,
  PipelineStageResult,
  TranslationPipelineResult,
  TranslationMetrics,
  TranslationContext,
  TranslationEvalRecord,
  TranslationCoverageStats,
  PlaybackAction,
} from "./types";

export type {
  LanguageDetector,
  TextNormalizer,
  SentenceSegmenter,
  FslTranslator,
  GlossOptimizer,
  AnimationPlanner,
  CoarticulationController,
  ExpressionController,
  UnknownGlossHandler,
  NeuralMtAdapter,
  SignWritingAdapter,
  LLMTranslationAdapter,
} from "./interfaces";
