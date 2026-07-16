export { categorizeConfidence, categorizeRecognition, shouldAcceptPrediction, shouldQueueForReview, shouldFlagAsHardCase, detectUnknownGesture } from "./confidenceMonitor";
export type { ConfidenceLevel, CategorizedRecognition } from "./types";

export { isUnknownGesture, createUnknownRecord, shouldDisplayUnknown } from "./unknownGestureDetector";
export type { UnknownGestureRecord } from "./unknownGestureDetector";

export { createTranslationFeedback, analyzeMissingAnimations, prioritizeMissingAnimations } from "./translationFeedback";
export type { TranslationFailure } from "./translationFeedback";

export { analyzeDatasetBalance, rankByPriority, calculateDatasetGrowth } from "./datasetRecommender";
export type { ClassCount } from "./datasetRecommender";

export { shouldSuggestRetraining, generateRetrainingSuggestion } from "./retrainingSuggester";
export type { RetrainingCriteria } from "./retrainingSuggester";
