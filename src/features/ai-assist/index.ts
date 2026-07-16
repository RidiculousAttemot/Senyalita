export { suggestGloss } from "./glossSuggestion";
export type { GlossSuggestionResult, GlossSuggestion } from "./glossSuggestion";

export { generateMetadata } from "./metadataGenerator";
export type { AnimationMetadata } from "./metadataGenerator";

export { analyzeQuality } from "./qualityAnalyzer";
export type { QualityAnalysis, QualityIssue } from "./qualityAnalyzer";

export { optimizeAnimation } from "./animationOptimizer";
export type { OptimizationResult } from "./animationOptimizer";

export { validateAsset } from "./smartValidator";
export type { ValidationResult, ValidationVerdict, ValidationCheck } from "./smartValidator";

export { compareVersions } from "./versionComparator";
export type { VersionDiff } from "./versionComparator";

export { detectMissingAnimations } from "./missingAnimationDetector";
export type { MissingAnimationEntry, CoverageReport } from "./missingAnimationDetector";
