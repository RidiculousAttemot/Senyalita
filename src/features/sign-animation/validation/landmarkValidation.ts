import type { AnimationFrame, LandmarkPoint, GestureAnimationAsset } from "../types";

export interface ValidationConfig {
  asset: GestureAnimationAsset;
  originalFrames: AnimationFrame[];
}

export interface LandmarkValidationResult {
  frameIndex: number;
  timestamp: number;
  poseErrors: JointError[];
  faceErrors: JointError[];
  leftHandErrors: JointError[];
  rightHandErrors: JointError[];
  averageJointError: number;
  maxJointError: number;
  missingLandmarks: number;
}

export interface JointError {
  index: number;
  original: { x: number; y: number; z: number };
  rendered: { x: number; y: number; z: number };
  error: number;
}

export interface ValidationSummary {
  totalFrames: number;
  averageJointError: number;
  maxJointError: number;
  averagePoseError: number;
  averageFaceError: number;
  averageLeftHandError: number;
  averageRightHandError: number;
  maxPoseError: number;
  maxFaceError: number;
  maxLeftHandError: number;
  maxRightHandError: number;
  totalMissingLandmarks: number;
  framesWithDrift: number;
  playbackDriftFrames: number;
  passed: boolean;
}

const POSE_LANDMARK_COUNT = 33;
const FACE_LANDMARK_COUNT = 468;
const HAND_LANDMARK_COUNT = 21;

function computeJointError(
  original: LandmarkPoint[],
  rendered: LandmarkPoint[]
): { errors: JointError[]; avg: number; max: number } {
  const errors: JointError[] = [];
  let sumError = 0;
  let maxError = 0;
  let count = 0;

  for (let i = 0; i < original.length; i++) {
    const orig = original[i];
    const rend = rendered[i];
    if (!orig || !rend) continue;

    const dx = orig.x - rend.x;
    const dy = orig.y - rend.y;
    const dz = orig.z - rend.z;
    const error = Math.sqrt(dx * dx + dy * dy + dz * dz);

    errors.push({ index: i, original: orig, rendered: rend, error });
    sumError += error;
    maxError = Math.max(maxError, error);
    count++;
  }

  return {
    errors,
    avg: count > 0 ? sumError / count : 0,
    max: maxError,
  };
}

export function validateLandmarkAccuracy(
  asset: GestureAnimationAsset,
  renderedFrames: AnimationFrame[]
): { perFrame: LandmarkValidationResult[]; summary: ValidationSummary } {
  const originalFrames = asset.frames;
  const perFrame: LandmarkValidationResult[] = [];

  let totalAvgError = 0;
  let totalMaxError = 0;
  let totalPoseError = 0;
  let totalFaceError = 0;
  let totalLeftHandError = 0;
  let totalRightHandError = 0;
  let totalMaxPoseError = 0;
  let totalMaxFaceError = 0;
  let totalMaxLeftHandError = 0;
  let totalMaxRightHandError = 0;
  let totalMissing = 0;
  let framesWithDrift = 0;
  let playbackDriftFrames = 0;

  const minFrames = Math.min(originalFrames.length, renderedFrames.length);

  for (let i = 0; i < minFrames; i++) {
    const orig = originalFrames[i];
    const rend = renderedFrames[i];

    const timestampDiff = Math.abs(orig.timestamp - rend.timestamp);
    const frameDuration = asset.duration / asset.totalFrames;
    const isDrift = timestampDiff > frameDuration * 1.5;
    if (isDrift) playbackDriftFrames++;

    let missingCount = 0;

    const poseOrig = orig.poseLandmarks || [];
    const poseRend = rend.poseLandmarks || [];
    const poseResult = computeJointError(poseOrig, poseRend);
    missingCount += POSE_LANDMARK_COUNT - poseOrig.filter(p => p).length;

    const faceOrig = orig.faceLandmarks || [];
    const faceRend = rend.faceLandmarks || [];
    const faceResult = computeJointError(faceOrig, faceRend);
    missingCount += FACE_LANDMARK_COUNT - faceOrig.filter(p => p).length;

    const leftOrig = orig.landmarks.find(h => h.side === "left")?.landmarks || [];
    const leftRend = rend.landmarks.find(h => h.side === "left")?.landmarks || [];
    const leftResult = computeJointError(leftOrig, leftRend);
    missingCount += HAND_LANDMARK_COUNT - leftOrig.filter(p => p).length;

    const rightOrig = orig.landmarks.find(h => h.side === "right")?.landmarks || [];
    const rightRend = rend.landmarks.find(h => h.side === "right")?.landmarks || [];
    const rightResult = computeJointError(rightOrig, rightRend);
    missingCount += HAND_LANDMARK_COUNT - rightOrig.filter(p => p).length;

    const allErrors = [
      ...poseResult.errors,
      ...faceResult.errors,
      ...leftResult.errors,
      ...rightResult.errors,
    ];
    const avgError = allErrors.length > 0
      ? allErrors.reduce((s, e) => s + e.error, 0) / allErrors.length
      : 0;
    const maxError = allErrors.length > 0
      ? Math.max(...allErrors.map(e => e.error))
      : 0;

    if (avgError > 2) framesWithDrift++;

    perFrame.push({
      frameIndex: i,
      timestamp: orig.timestamp,
      poseErrors: poseResult.errors,
      faceErrors: faceResult.errors,
      leftHandErrors: leftResult.errors,
      rightHandErrors: rightResult.errors,
      averageJointError: avgError,
      maxJointError: maxError,
      missingLandmarks: missingCount,
    });

    totalAvgError += avgError;
    totalMaxError += maxError;
    totalPoseError += poseResult.avg;
    totalFaceError += faceResult.avg;
    totalLeftHandError += leftResult.avg;
    totalRightHandError += rightResult.avg;
    totalMaxPoseError = Math.max(totalMaxPoseError, poseResult.max);
    totalMaxFaceError = Math.max(totalMaxFaceError, faceResult.max);
    totalMaxLeftHandError = Math.max(totalMaxLeftHandError, leftResult.max);
    totalMaxRightHandError = Math.max(totalMaxRightHandError, rightResult.max);
    totalMissing += missingCount;
  }

  const frameCount = perFrame.length;
  const summary: ValidationSummary = {
    totalFrames: frameCount,
    averageJointError: frameCount > 0 ? totalAvgError / frameCount : 0,
    maxJointError: frameCount > 0 ? totalMaxError / frameCount : 0,
    averagePoseError: frameCount > 0 ? totalPoseError / frameCount : 0,
    averageFaceError: frameCount > 0 ? totalFaceError / frameCount : 0,
    averageLeftHandError: frameCount > 0 ? totalLeftHandError / frameCount : 0,
    averageRightHandError: frameCount > 0 ? totalRightHandError / frameCount : 0,
    maxPoseError: totalMaxPoseError,
    maxFaceError: totalMaxFaceError,
    maxLeftHandError: totalMaxLeftHandError,
    maxRightHandError: totalMaxRightHandError,
    totalMissingLandmarks: totalMissing,
    framesWithDrift,
    playbackDriftFrames,
    passed: (frameCount > 0 ? totalAvgError / frameCount : 0) < 2 && playbackDriftFrames === 0,
  };

  return { perFrame, summary };
}

export function printValidationReport(summary: ValidationSummary): void {
  console.log("=".repeat(60));
  console.log("LANDMARK ACCURACY VALIDATION REPORT");
  console.log("=".repeat(60));
  console.log(`Total Frames Validated: ${summary.totalFrames}`);
  console.log("");
  console.log("Joint Error (pixels):");
  console.log(`  Average: ${summary.averageJointError.toFixed(2)} (target: < 2)`);
  console.log(`  Maximum: ${summary.maxJointError.toFixed(2)}`);
  console.log("");
  console.log("Per-Category Average Error:");
  console.log(`  Pose (33):    ${summary.averagePoseError.toFixed(2)} px (max: ${summary.maxPoseError.toFixed(2)})`);
  console.log(`  Face (468):   ${summary.averageFaceError.toFixed(2)} px (max: ${summary.maxFaceError.toFixed(2)})`);
  console.log(`  Left Hand:    ${summary.averageLeftHandError.toFixed(2)} px (max: ${summary.maxLeftHandError.toFixed(2)})`);
  console.log(`  Right Hand:   ${summary.averageRightHandError.toFixed(2)} px (max: ${summary.maxRightHandError.toFixed(2)})`);
  console.log("");
  console.log(`Missing Landmarks: ${summary.totalMissingLandmarks}`);
  console.log(`Frames with >2px error: ${summary.framesWithDrift}`);
  console.log(`Playback Drift Frames: ${summary.playbackDriftFrames} (target: 0)`);
  console.log("");
  console.log(`OVERALL: ${summary.passed ? "✓ PASSED" : "✗ FAILED"}`);
  console.log("=".repeat(60));
}