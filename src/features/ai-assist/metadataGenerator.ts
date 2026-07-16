import type { GestureAnimationAsset, AnimationFrame } from "@/features/sign-animation/types";

export interface AnimationMetadata {
  durationMs: number;
  fps: number;
  frameCount: number;
  movementScore: number;
  dominantHand: "left" | "right" | "both" | "none";
  handVisibility: number;
  bodyVisibility: number;
  faceVisibility: number;
  landmarkCompleteness: number;
  motionSmoothness: number;
  estimatedDifficulty: "beginner" | "intermediate" | "advanced";
  averageHandSpeed: number;
  peakHandSpeed: number;
  stillnessRatio: number;
}

export function generateMetadata(asset: GestureAnimationAsset): AnimationMetadata {
  const { frames, fps, duration } = asset;
  const frameCount = frames.length;

  let leftHandFrames = 0;
  let rightHandFrames = 0;
  let bothHandsFrames = 0;
  let poseFrames = 0;
  let faceFrames = 0;
  let totalMovement = 0;
  let totalComparisons = 0;
  let stillnessCount = 0;
  let speeds: number[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const hasLeft = frame.landmarks.some((h) => h.side === "left" && h.landmarks.length >= 21);
    const hasRight = frame.landmarks.some((h) => h.side === "right" && h.landmarks.length >= 21);
    const hasPose = (frame.poseLandmarks?.length ?? 0) >= 11;
    const hasFace = (frame.faceLandmarks?.length ?? 0) > 0;

    if (hasLeft) leftHandFrames++;
    if (hasRight) rightHandFrames++;
    if (hasLeft && hasRight) bothHandsFrames++;
    if (hasPose) poseFrames++;
    if (hasFace) faceFrames++;

    if (i > 0) {
      const prev = frames[i - 1];
      for (let h = 0; h < Math.min(frame.landmarks.length, prev.landmarks.length); h++) {
        const a = frame.landmarks[h].landmarks[0];
        const b = prev.landmarks[h].landmarks[0];
        if (a && b) {
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dz = a.z - b.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          totalMovement += dist;
          totalComparisons++;
          speeds.push(dist);
          if (dist < 0.002) stillnessCount++;
        }
      }
    }
  }

  const movementScore = totalComparisons > 0
    ? Math.min(1, totalMovement / totalComparisons / 0.05)
    : 0;

  const handVisibility = frameCount > 0
    ? (leftHandFrames + rightHandFrames) / (frameCount * 2)
    : 0;

  const bodyVisibility = frameCount > 0 ? poseFrames / frameCount : 0;
  const faceVisibility = frameCount > 0 ? faceFrames / frameCount : 0;

  let totalLandmarkPoints = 0;
  let presentLandmarkPoints = 0;
  for (const frame of frames) {
    for (const hand of frame.landmarks) {
      for (const lm of hand.landmarks) {
        totalLandmarkPoints++;
        if (lm.x !== 0 || lm.y !== 0 || lm.z !== 0) presentLandmarkPoints++;
      }
    }
  }
  const landmarkCompleteness = totalLandmarkPoints > 0
    ? presentLandmarkPoints / totalLandmarkPoints
    : 0;

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
  const motionSmoothness = jitterComparisons > 0
    ? 1 - (jitterScore / jitterComparisons)
    : 0.5;

  const avgSpeed = speeds.length > 0
    ? speeds.reduce((s, v) => s + v, 0) / speeds.length
    : 0;
  const peakSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
  const stillnessRatio = speeds.length > 0 ? stillnessCount / speeds.length : 0;

  const dominantHand: "left" | "right" | "both" | "none" =
    leftHandFrames === 0 && rightHandFrames === 0 ? "none"
    : leftHandFrames > rightHandFrames * 1.2 ? "left"
    : rightHandFrames > leftHandFrames * 1.2 ? "right"
    : "both";

  const estimatedDifficulty: "beginner" | "intermediate" | "advanced" =
    movementScore > 0.7 && motionSmoothness > 0.7 && bothHandsFrames > frameCount * 0.5
      ? "advanced"
      : movementScore > 0.4 && motionSmoothness > 0.4
        ? "intermediate"
        : "beginner";

  return {
    durationMs: duration,
    fps,
    frameCount,
    movementScore: Math.round(movementScore * 100),
    dominantHand,
    handVisibility: Math.round(handVisibility * 100),
    bodyVisibility: Math.round(bodyVisibility * 100),
    faceVisibility: Math.round(faceVisibility * 100),
    landmarkCompleteness: Math.round(landmarkCompleteness * 100),
    motionSmoothness: Math.round(motionSmoothness * 100),
    estimatedDifficulty,
    averageHandSpeed: Math.round(avgSpeed * 10000) / 10000,
    peakHandSpeed: Math.round(peakSpeed * 10000) / 10000,
    stillnessRatio: Math.round(stillnessRatio * 100),
  };
}
