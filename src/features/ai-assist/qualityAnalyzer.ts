import type { GestureAnimationAsset, AnimationFrame, LandmarkPoint } from "@/features/sign-animation/types";

export interface QualityIssue {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  details?: string;
}

export interface QualityAnalysis {
  score: number;
  issues: QualityIssue[];
  recommendations: string[];
  metrics: {
    missingFrameCount: number;
    jitterScore: number;
    noiseLevel: number;
    lowConfidenceFrames: number;
    /** Count of frames where every comparable hand stayed still. */
    frozenFrames: number;
    /**
     * frozenFrames as a percentage of the frames actually compared, 0-100.
     *
     * Exposed so consumers stop deriving it themselves: smartValidator was
     * recomputing frozenFrames/frameCount, a different denominator from the one
     * used for the warning here, so the two could disagree about the same asset.
     */
    frozenPercent: number;
    cameraShake: number;
    occlusionScore: number;
    handContinuity: number;
    poseContinuity: number;
    faceContinuity: number;
  };
}

/**
 * Movement below this, in normalised landmark units, counts as no movement.
 *
 * Deliberately unchanged while fixing the ratio: it is tight, and it is applied
 * to `landmarks[0]` only — the wrist. A sign whose wrist is planted while the
 * fingers articulate therefore reads as frozen even though it is not. That is a
 * real limitation of this metric and worth revisiting, but widening the sample
 * to all 21 points shifts every quality score, which is a separate change from
 * making the percentage arithmetically possible.
 */
const FROZEN_DISTANCE = 0.0005;

export function analyzeQuality(asset: GestureAnimationAsset): QualityAnalysis {
  const { frames, fps, duration } = asset;
  const issues: QualityIssue[] = [];
  const recommendations: string[] = [];

  let missingFrameCount = 0;
  let frozenFrames = 0;
  /** Frames with at least one hand comparable against the previous frame. */
  let comparedFrames = 0;
  let lowConfidenceFrames = 0;
  let occlusionScore = 0;
  let cameraShake = 0;
  let totalMovement = 0;
  let movementComparisons = 0;
  let leftHandContinuity = 0;
  let rightHandContinuity = 0;
  let poseContinuity = 0;
  let faceContinuity = 0;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const hasLeft = frame.landmarks.some((h) => h.side === "left" && h.landmarks.length >= 21);
    const hasRight = frame.landmarks.some((h) => h.side === "right" && h.landmarks.length >= 21);
    const hasPose = (frame.poseLandmarks?.length ?? 0) > 0;
    const hasFace = (frame.faceLandmarks?.length ?? 0) > 0;

    if (!hasLeft && !hasRight && !hasPose) missingFrameCount++;

    if (i > 0) {
      const prev = frames[i - 1];
      const hasLeftPrev = prev.landmarks.some((h) => h.side === "left" && h.landmarks.length >= 21);
      const hasRightPrev = prev.landmarks.some((h) => h.side === "right" && h.landmarks.length >= 21);
      const hasPosePrev = (prev.poseLandmarks?.length ?? 0) > 0;
      const hasFacePrev = (prev.faceLandmarks?.length ?? 0) > 0;

      if (hasLeft === hasLeftPrev) leftHandContinuity++;
      if (hasRight === hasRightPrev) rightHandContinuity++;
      if (hasPose === hasPosePrev) poseContinuity++;
      if (hasFace === hasFacePrev) faceContinuity++;

      // A frame counts as frozen only when EVERY hand that could be compared
      // stayed put. This used to increment once per hand while the ratio below
      // divided by frame count, so a two-handed sign could report up to 200%
      // frozen — a percentage that cannot exist, from a metric surfaced to the
      // user as "High number of frozen frames (98%)".
      let handsCompared = 0;
      let anyHandMoved = false;

      for (let h = 0; h < Math.min(frame.landmarks.length, prev.landmarks.length); h++) {
        const a = frame.landmarks[h]?.landmarks?.[0];
        const b = prev.landmarks[h]?.landmarks?.[0];
        if (a && b) {
          const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
          totalMovement += dist;
          movementComparisons++;
          handsCompared++;
          if (dist >= FROZEN_DISTANCE) anyHandMoved = true;
        }
      }

      if (handsCompared > 0) {
        comparedFrames++;
        if (!anyHandMoved) frozenFrames++;
      }
    }
  }

  const missingRatio = frames.length > 0 ? missingFrameCount / frames.length : 0;
  // Denominator is frames that were actually compared, not every frame. The
  // first frame has no predecessor, and a frame with no tracked hand cannot be
  // judged still — counting either as "not frozen" understated long dropouts.
  const frozenRatio = comparedFrames > 0 ? frozenFrames / comparedFrames : 0;
  const leftContinuity = frames.length > 1 ? leftHandContinuity / (frames.length - 1) : 1;
  const rightContinuity = frames.length > 1 ? rightHandContinuity / (frames.length - 1) : 1;
  const poseCont = frames.length > 1 ? poseContinuity / (frames.length - 1) : 1;
  const faceCont = frames.length > 1 ? faceContinuity / (frames.length - 1) : 1;

  let jitterScore = 0;
  let jitterComparisons = 0;
  for (let i = 2; i < frames.length; i++) {
    const f0 = frames[i - 2];
    const f1 = frames[i - 1];
    const f2 = frames[i];
    for (let h = 0; h < Math.min(f0.landmarks.length, f2.landmarks.length); h++) {
      const lms0 = f0.landmarks[h]?.landmarks ?? [];
      const lms1 = f1.landmarks[h]?.landmarks ?? [];
      const lms2 = f2.landmarks[h]?.landmarks ?? [];
      for (let j = 0; j < Math.min(lms0.length, lms1.length, lms2.length); j++) {
        const dx0 = lms1[j].x - lms0[j].x;
        const dy0 = lms1[j].y - lms0[j].y;
        const dx1 = lms2[j].x - lms1[j].x;
        const dy1 = lms2[j].y - lms1[j].y;
        const angleDiff = Math.abs(Math.atan2(dy1, dx1) - Math.atan2(dy0, dx0));
        jitterScore += Math.min(1, angleDiff / Math.PI);
        jitterComparisons++;
      }
    }
  }
  const normalizedJitter = jitterComparisons > 0 ? jitterScore / jitterComparisons : 0;

  let noiseLevel = 0;
  let noiseComparisons = 0;
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    for (let h = 0; h < Math.min(prev.landmarks.length, curr.landmarks.length); h++) {
      const lmsP = prev.landmarks[h]?.landmarks ?? [];
      const lmsC = curr.landmarks[h]?.landmarks ?? [];
      for (let j = 0; j < Math.min(lmsP.length, lmsC.length); j++) {
        const dx = Math.abs(lmsC[j].x - lmsP[j].x);
        const dy = Math.abs(lmsC[j].y - lmsP[j].y);
        if (dx > 0.1 || dy > 0.1) {
          noiseLevel++;
        }
        noiseComparisons++;
      }
    }
  }
  const normalizedNoise = noiseComparisons > 0 ? noiseLevel / noiseComparisons : 0;

  if (missingRatio > 0.5) {
    issues.push({ severity: "error", category: "missing", message: `Too many missing frames (${Math.round(missingRatio * 100)}%)`, details: "More than 50% of frames have no landmarks" });
  } else if (missingRatio > 0.2) {
    issues.push({ severity: "warning", category: "missing", message: `Some frames missing landmarks (${Math.round(missingRatio * 100)}%)`, details: "Between 20-50% of frames lack landmarks" });
  }

  if (frozenRatio > 0.3) {
    issues.push({ severity: "warning", category: "frozen", message: `High number of frozen frames (${Math.round(frozenRatio * 100)}%)`, details: "Animation may contain long idle segments" });
  }

  if (normalizedJitter > 0.3) {
    issues.push({ severity: "warning", category: "jitter", message: "Landmark jitter detected", details: "Sudden movements between frames suggest noisy tracking" });
  }

  if (normalizedNoise > 0.05) {
    issues.push({ severity: "info", category: "noise", message: "Some landmark noise detected", details: "A few landmarks show erratic movement" });
  }

  if (leftContinuity < 0.5) {
    issues.push({ severity: "warning", category: "occlusion", message: "Left hand intermittently hidden", details: "Left hand appears and disappears between frames" });
    occlusionScore += 0.3;
  }
  if (rightContinuity < 0.5) {
    issues.push({ severity: "warning", category: "occlusion", message: "Right hand intermittently hidden", details: "Right hand appears and disappears between frames" });
    occlusionScore += 0.3;
  }
  if (faceCont < 0.3) {
    issues.push({ severity: "info", category: "occlusion", message: "Face landmarks mostly missing", details: "Face was not visible for most frames" });
    occlusionScore += 0.2;
  }
  if (poseCont < 0.3) {
    issues.push({ severity: "info", category: "occlusion", message: "Body pose mostly missing", details: "Upper body was not visible for most frames" });
    occlusionScore += 0.2;
  }

  if (frames.length < 10) {
    issues.push({ severity: "error", category: "length", message: `Too few frames (${frames.length})`, details: "Animation is too short for sign language" });
  }
  if (fps < 15) {
    issues.push({ severity: "warning", category: "fps", message: `Low frame rate (${fps} FPS)`, details: "Low FPS may cause jerky playback" });
  }
  if (frames.length > 0 && (frames[frames.length - 1].timestamp - frames[0].timestamp) < 1000) {
    issues.push({ severity: "warning", category: "duration", message: "Animation duration is very short", details: "Less than 1 second of animation data" });
  }

  const movementScore = movementComparisons > 0
    ? Math.min(1, totalMovement / movementComparisons / 0.03)
    : 0;
  if (movementScore < 0.1) {
    issues.push({ severity: "warning", category: "movement", message: "Very little hand movement detected", details: "Animation may be mostly static" });
  }

  if (issues.length === 0) {
    recommendations.push("Animation quality is excellent — no issues detected");
  } else {
    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");
    if (errors.length > 0) recommendations.push(`Fix ${errors.length} error(s) before publishing`);
    if (warnings.length > 0) recommendations.push(`Review ${warnings.length} warning(s) for potential issues`);
    if (missingRatio > 0) recommendations.push("Consider re-recording with better lighting and camera stability");
    if (frozenRatio > 0.3) recommendations.push("Trim idle segments at the beginning and end of the video");
    if (normalizedJitter > 0.3) recommendations.push("Enable landmark smoothing to reduce jitter");
    if (leftContinuity < 0.5 || rightContinuity < 0.5) recommendations.push("Ensure both hands remain visible throughout the signing");
  }

  const continuityScore = (leftContinuity + rightContinuity + poseCont + faceCont) / 4;
  const qualityScore = Math.round(
    Math.max(0, Math.min(100,
      (1 - missingRatio) * 25 +
      (1 - normalizedJitter) * 20 +
      (1 - normalizedNoise) * 10 +
      (1 - frozenRatio) * 10 +
      continuityScore * 15 +
      movementScore * 10 +
      (fps >= 24 ? 10 : fps >= 15 ? 5 : 0)
    ))
  );

  return {
    score: qualityScore,
    issues,
    recommendations,
    metrics: {
      missingFrameCount,
      jitterScore: Math.round(normalizedJitter * 100),
      noiseLevel: Math.round(normalizedNoise * 100),
      lowConfidenceFrames,
      frozenFrames,
      frozenPercent: Math.round(frozenRatio * 100),
      cameraShake: Math.round(cameraShake * 100),
      occlusionScore: Math.round(occlusionScore * 100),
      handContinuity: Math.round(((leftContinuity + rightContinuity) / 2) * 100),
      poseContinuity: Math.round(poseCont * 100),
      faceContinuity: Math.round(faceCont * 100),
    },
  };
}
