import type { AnimationFrame, GestureAnimationAsset, LandmarkPoint } from "../types";

export interface AccuracyProjection {
  canvasWidth: number;
  canvasHeight: number;
  imageWidth: number;
  imageHeight: number;
}

export interface FrameAccuracy {
  frameIndex: number;
  averageJointErrorPx: number;
  maxJointErrorPx: number;
  comparedJoints: number;
}

export interface AccuracyReport {
  frames: FrameAccuracy[];
  averageJointErrorPx: number;
  maxJointErrorPx: number;
  worstFrameIndex: number;
  playbackDriftFrames: number;
  totalJointsCompared: number;
  /** True when every gate in the brief is met. */
  passed: boolean;
}

export const ACCURACY_TARGET_AVG_PX = 2;

/**
 * Reproduces ExactLandmarkRenderer's projection: one uniform scale plus a
 * letterbox offset. Kept in this module so the validator measures the
 * documented contract rather than importing the renderer's private internals.
 */
export function projectLandmark(
  lm: LandmarkPoint,
  p: AccuracyProjection,
): { x: number; y: number } {
  const scale = Math.min(p.canvasWidth / p.imageWidth, p.canvasHeight / p.imageHeight);
  const offsetX = (p.canvasWidth - p.imageWidth * scale) / 2;
  const offsetY = (p.canvasHeight - p.imageHeight * scale) / 2;
  return {
    x: offsetX + lm.x * p.imageWidth * scale,
    y: offsetY + lm.y * p.imageHeight * scale,
  };
}

/** Maps a projected canvas point back to source-video pixels. */
function unproject(
  point: { x: number; y: number },
  p: AccuracyProjection,
): { x: number; y: number } {
  const scale = Math.min(p.canvasWidth / p.imageWidth, p.canvasHeight / p.imageHeight);
  const offsetX = (p.canvasWidth - p.imageWidth * scale) / 2;
  const offsetY = (p.canvasHeight - p.imageHeight * scale) / 2;
  return {
    x: (point.x - offsetX) / scale,
    y: (point.y - offsetY) / scale,
  };
}

function collectFrameLandmarks(frame: AnimationFrame): LandmarkPoint[] {
  const out: LandmarkPoint[] = [];
  if (frame.poseLandmarks) out.push(...frame.poseLandmarks);
  if (frame.faceLandmarks) out.push(...frame.faceLandmarks);
  for (const hand of frame.landmarks) {
    if (hand.landmarks) out.push(...hand.landmarks);
  }
  return out;
}

/**
 * Compares every landmark the renderer would draw against the extracted value,
 * measured in source-video pixels. Any non-zero error means the playback path
 * altered the capture — normalisation, smoothing or interpolation.
 */
export function measureAssetAccuracy(
  asset: GestureAnimationAsset,
  renderedFrames: AnimationFrame[],
  canvasWidth: number,
  canvasHeight: number,
): AccuracyReport {
  const projection: AccuracyProjection = {
    canvasWidth,
    canvasHeight,
    imageWidth: asset.imageWidth ?? canvasWidth,
    imageHeight: asset.imageHeight ?? canvasHeight,
  };

  const frames: FrameAccuracy[] = [];
  let errorSum = 0;
  let jointCount = 0;
  let globalMax = 0;
  let worstFrameIndex = -1;

  const compared = Math.min(asset.frames.length, renderedFrames.length);
  for (let i = 0; i < compared; i++) {
    const source = collectFrameLandmarks(asset.frames[i]);
    const rendered = collectFrameLandmarks(renderedFrames[i]);
    const n = Math.min(source.length, rendered.length);

    let frameSum = 0;
    let frameMax = 0;
    for (let j = 0; j < n; j++) {
      const expected = projectLandmark(source[j], projection);
      const actual = projectLandmark(rendered[j], projection);
      const back = unproject(actual, projection);
      const expectedSrc = unproject(expected, projection);
      const dx = back.x - expectedSrc.x;
      const dy = back.y - expectedSrc.y;
      const dist = Math.hypot(dx, dy);
      frameSum += dist;
      if (dist > frameMax) frameMax = dist;
    }

    const avg = n > 0 ? frameSum / n : 0;
    frames.push({
      frameIndex: i,
      averageJointErrorPx: avg,
      maxJointErrorPx: frameMax,
      comparedJoints: n,
    });

    errorSum += frameSum;
    jointCount += n;
    if (frameMax > globalMax) {
      globalMax = frameMax;
      worstFrameIndex = i;
    }
  }

  const playbackDriftFrames = renderedFrames.length - asset.frames.length;
  const averageJointErrorPx = jointCount > 0 ? errorSum / jointCount : 0;

  return {
    frames,
    averageJointErrorPx,
    maxJointErrorPx: globalMax,
    worstFrameIndex,
    playbackDriftFrames,
    totalJointsCompared: jointCount,
    passed: averageJointErrorPx < ACCURACY_TARGET_AVG_PX && playbackDriftFrames === 0,
  };
}
