export type DetectedLanguage = "en" | "tl" | "mixed";

export interface LanguageDetectionResult {
  language: DetectedLanguage;
  confidence: number;
}

export interface NormalizationResult {
  original: string;
  normalized: string;
  cleaned: string;
  words: string[];
}

export interface SentenceSegment {
  text: string;
  index: number;
  type: "declarative" | "interrogative" | "exclamatory" | "imperative";
}

export interface GlossTranslation {
  original: string;
  gloss: string;
  confidence: number;
  strategy: "direct" | "synonym" | "related" | "fingerspelling" | "fallback" | "placeholder";
  category?: string;
  animationKey?: string;
  expressionTag?: ExpressionTag;
}

export interface OptimizedGloss {
  original: string;
  gloss: string;
  confidence: number;
  strategy: string;
  category?: string;
  animationKey?: string;
  expressionTag?: ExpressionTag;
  isFiller: boolean;
  isDuplicate: boolean;
  mergedFrom?: string[];
}

export type ExpressionTag =
  | "neutral"
  | "happy"
  | "questioning"
  | "sad"
  | "angry"
  | "surprised"
  | "emphatic"
  | "nodding"
  | "shaking";

export type PlaybackAction = "play" | "pause" | "transition" | "loop" | "stop";

export interface AnimationPlanItem {
  gloss: string;
  original: string;
  animationKey: string;
  confidence: number;
  startTime: number;
  duration: number;
  endTime: number;
  transitionIn: number;
  transitionOut: number;
  playbackSpeed: number;
  loop: boolean;
  loopCount: number;
  expressionTag: ExpressionTag;
  action: PlaybackAction;
  fallbackUsed: boolean;
  fallbackReason?: string;
}

export interface AnimationPlan {
  items: AnimationPlanItem[];
  totalDuration: number;
  timeline: {
    segments: TimelineSegment[];
    transitions: TimelineTransition[];
  };
}

export interface TimelineSegment {
  startTime: number;
  endTime: number;
  gloss: string;
  type: "gesture" | "pause" | "transition";
  label: string;
}

export interface TimelineTransition {
  fromGloss: string;
  toGloss: string;
  startTime: number;
  duration: number;
  blendType: "linear" | "ease" | "anticipate";
}

export interface UnknownGlossResult {
  original: string;
  resolvedGloss: string;
  strategy: "synonym" | "parent_category" | "fingerspelling" | "placeholder";
  confidence: number;
  animationKey?: string;
}

export interface PipelineStageResult {
  stageName: string;
  durationMs: number;
  success: boolean;
  error?: string;
  data?: unknown;
}

export interface TranslationPipelineResult {
  originalText: string;
  normalized: NormalizationResult;
  language: LanguageDetectionResult;
  sentences: SentenceSegment[];
  glossSequence: GlossTranslation[];
  optimizedGlosses: OptimizedGloss[];
  animationPlan: AnimationPlan;
  unknownGlosses: UnknownGlossResult[];
  stageResults: PipelineStageResult[];
  totalProcessingTimeMs: number;
  metrics: TranslationMetrics;
}

export interface TranslationMetrics {
  inputLength: number;
  wordCount: number;
  glossCount: number;
  unknownCount: number;
  fallbackCount: number;
  averageConfidence: number;
  totalDuration: number;
  coverage: number;
}

export interface TranslationContext {
  previousInputs: string[];
  previousGlosses: string[];
  previousIntents: string[];
  topic: string[];
}

export interface TranslationEvalRecord {
  timestamp: number;
  input: string;
  glossSequence: string[];
  unknownWords: string[];
  fallbackCount: number;
  processingTimeMs: number;
  confidence: number;
  planDuration: number;
}

export interface TranslationCoverageStats {
  totalRequests: number;
  uniqueInputs: number;
  totalGlossesGenerated: number;
  totalUnknownGlosses: number;
  totalFallbacks: number;
  averageConfidence: number;
  averageProcessingTime: number;
  averageSentenceLength: number;
  averagePlaybackDuration: number;
  mostRequestedTranslations: Array<{ text: string; count: number }>;
  glossFrequency: Record<string, number>;
  unknownWordsFrequency: Record<string, number>;
  fallbackFrequency: Record<string, number>;
  coverageRate: number;
}
