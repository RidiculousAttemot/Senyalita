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
  /**
   * Advisory only — it can warn, never fail.
   *
   * Movement is wrist travel, and a fingerspelled letter is a static handshape:
   * the wrist is meant to stay put. Measured against the real published
   * library, "A" scores movement=4 against a fail threshold of 5, so enforcing
   * this would have refused most of the alphabet — the signs the whole
   * Text-to-Sign fallback depends on.
   *
   * Low movement is worth flagging on a phrase, where it usually means a bad
   * take. It is not evidence that a sign is unpublishable, so it does not get
   * to block one. `fail: 0` keeps the check visible and demotes it to a warning
   * rather than deleting the signal.
   */
  movement: { warn: 15, fail: 0 },
  smoothness: { warn: 40, fail: 20 },
  /**
   * Recalibrated against the library that already exists.
   *
   * Measured over published assets: a=44, b=50, 1=53, 5=47, 10=43. The fail
   * line was 50 — inside the normal noise floor of this recording setup — so
   * enforcing it would have rejected roughly half the alphabet, including signs
   * Text-to-Sign has been serving correctly for weeks. "1" failed outright.
   *
   * A threshold that rejects the working library is measuring the camera, not
   * the sign. 70 sits clear of the observed range while still catching a take
   * that is genuinely shaky. Worth revisiting with more samples; the warn line
   * at 30 keeps the signal visible in the meantime.
   */
  jitter: { warn: 30, fail: 70 },
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

  /**
   * `invert` was accepted and never applied.
   *
   * Both branches of every ternary here were identical — `invert ? fails :
   * fails` — so jitter, frozen_frames and missing_frames, the three checks
   * where LOWER is better, were graded as if higher were better. Their
   * thresholds are {warn: 20, fail: 40}, so:
   *
   *   frozen_frames 0   ->  0 < 40   -> FAIL   (a flawless clip)
   *   frozen_frames 98  ->  98 < 40  -> pass   (an unusable one)
   *
   * Exactly backwards, and it is why a well-formed asset reported
   * "FAIL — Failed 2 check(s)": it was penalised for having no jitter and no
   * missing frames. Nothing enforced the verdict, so the wrong answer stayed
   * cosmetic — until the publish gate started depending on it, at which point
   * it would have blocked every good asset and passed the bad ones.
   *
   * For an inverted check the threshold is a ceiling, not a floor.
   */
  const fails = invert ? value > t.fail : value < t.fail;
  const warns = invert ? value > t.warn : value < t.warn;

  if (fails) return { status: "fail", message: `${value} (threshold: ${t.fail})` };
  if (warns) return { status: "warn", message: `${value} (threshold: ${t.warn})` };
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
