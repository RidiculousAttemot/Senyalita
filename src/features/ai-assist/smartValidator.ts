import type { GestureAnimationAsset } from "@/features/sign-animation/types";
import { generateMetadata, type AnimationMetadata } from "./metadataGenerator";
import { analyzeQuality, type QualityAnalysis } from "./qualityAnalyzer";

export type ValidationVerdict = "pass" | "warn" | "fail";
export type ValidationCheck =
  | "frame_count"
  | "duration"
  | "fps"
  | "hand_visibility"
  | "landmark_completeness"
  | "movement"
  | "smoothness"
  | "jitter"
  | "frozen_frames"
  | "missing_frames"
  | "dominant_hand";

export interface ValidationResult {
  verdict: ValidationVerdict;
  score: number;
  checks: Record<ValidationCheck, { status: ValidationVerdict; value: number | string | boolean; message: string }>;
  qualityAnalysis: QualityAnalysis;
  metadata: AnimationMetadata;
  summary: string;
}

const THRESHOLDS: Record<string, { warn: number; fail: number }> = {
  frame_count: { warn: 15, fail: 10 },
  fps: { warn: 20, fail: 15 },
  hand_visibility: { warn: 40, fail: 20 },
  landmark_completeness: { warn: 60, fail: 40 },
  movement: { warn: 15, fail: 5 },
  smoothness: { warn: 40, fail: 20 },
  jitter: { warn: 30, fail: 50 },
  missing_frames: { warn: 20, fail: 50 },
  frozen_frames: { warn: 20, fail: 40 },
};

function validateThreshold(
  check: ValidationCheck,
  value: number,
  invert = false,
): { status: ValidationVerdict; message: string } {
  const t = THRESHOLDS[check];
  if (!t) return { status: "pass", message: "OK" };

  const passes = invert ? value >= t.fail : value >= t.warn;
  const fails = invert ? value < t.fail : value < t.fail;
  const warn = invert
    ? (value >= t.warn && value < t.fail)
    : (value >= t.fail && value < t.warn);

  if (invert ? fails : fails) return { status: "fail", message: `${value} (threshold: ${t.fail})` };
  if (invert ? warn : warn) return { status: "warn", message: `${value} (threshold: ${t.warn})` };
  return { status: "pass", message: `${value} OK` };
}

export function validateAsset(asset: GestureAnimationAsset): ValidationResult {
  const metadata = generateMetadata(asset);
  const quality = analyzeQuality(asset);

  const checks: ValidationResult["checks"] = {
    frame_count: { ...validateThreshold("frame_count", metadata.frameCount), value: metadata.frameCount },
    duration: { status: "pass", value: metadata.durationMs, message: `${metadata.durationMs}ms OK` },
    fps: { ...validateThreshold("fps", metadata.fps), value: metadata.fps },
    hand_visibility: { ...validateThreshold("hand_visibility", metadata.handVisibility), value: metadata.handVisibility },
    landmark_completeness: { ...validateThreshold("landmark_completeness", metadata.landmarkCompleteness), value: metadata.landmarkCompleteness },
    movement: { ...validateThreshold("movement", metadata.movementScore), value: metadata.movementScore },
    smoothness: { ...validateThreshold("smoothness", metadata.motionSmoothness), value: metadata.motionSmoothness },
    jitter: { ...validateThreshold("jitter", quality.metrics.jitterScore, true), value: quality.metrics.jitterScore },
    // Uses the ratio analyzeQuality already computed rather than deriving a
    // second one. This divided a per-hand count by frameCount, so a two-handed
    // sign could report a frozen percentage above 100 — and could disagree with
    // the warning shown beside it, which used a different denominator.
    frozen_frames: { ...validateThreshold("frozen_frames", quality.metrics.frozenPercent, true), value: quality.metrics.frozenPercent },
    missing_frames: { ...validateThreshold("missing_frames", quality.metrics.missingFrameCount / Math.max(1, metadata.frameCount) * 100, true), value: Math.round(quality.metrics.missingFrameCount / Math.max(1, metadata.frameCount) * 100) },
    dominant_hand: { status: "pass", value: metadata.dominantHand, message: `Dominant: ${metadata.dominantHand}` },
  };

  const hasFail = Object.values(checks).some((c) => c.status === "fail");
  const hasWarn = Object.values(checks).some((c) => c.status === "warn");

  let weightedScore = 100;
  const weights: Record<string, number> = {
    frame_count: 10, fps: 10, hand_visibility: 15, landmark_completeness: 15,
    movement: 10, smoothness: 10, jitter: 10, frozen_frames: 5,
    missing_frames: 10, dominant_hand: 5,
  };

  for (const [key, check] of Object.entries(checks)) {
    const w = weights[key] ?? 5;
    if (check.status === "fail") weightedScore -= w;
    else if (check.status === "warn") weightedScore -= w * 0.5;
  }

  const verdict: ValidationVerdict = hasFail ? "fail" : hasWarn ? "warn" : "pass";

  let summary: string;
  if (verdict === "pass") summary = "All validation checks passed";
  else if (verdict === "warn") summary = `Passed with ${Object.values(checks).filter((c) => c.status === "warn").length} warning(s)`;
  else summary = `Failed ${Object.values(checks).filter((c) => c.status === "fail").length} check(s)`;

  return { verdict, score: Math.max(0, weightedScore), checks, qualityAnalysis: quality, metadata, summary };
}
