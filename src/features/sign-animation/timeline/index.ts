import type { GestureAnimationAsset, AnimationFrame } from "../types";
import { interpolateHands } from "../interpolation";

export function getFrameAtTime(
  asset: GestureAnimationAsset,
  time: number,
): AnimationFrame {
  const { frames, duration } = asset;
  if (!frames || frames.length === 0) {
    return { timestamp: 0, landmarks: [] };
  }
  if (frames.length === 1) return frames[0];

  const clampedTime = Math.max(0, Math.min(time, duration));
  const progress = duration > 0 ? clampedTime / duration : 0;
  const totalFrames = frames.length;

  const exactIndex = progress * (totalFrames - 1);
  const indexA = Math.floor(exactIndex);
  const indexB = Math.min(indexA + 1, totalFrames - 1);
  const t = exactIndex - indexA;

  if (indexA === indexB || t === 0) return frames[indexA];

  const blended = interpolateHands(
    frames[indexA].landmarks,
    frames[indexB].landmarks,
    t,
  );
  return { timestamp: clampedTime, landmarks: blended };
}

export function getFrameIndexAtTime(
  asset: GestureAnimationAsset,
  time: number,
): number {
  if (!asset.frames || asset.frames.length === 0) return 0;
  const progress = asset.duration > 0 ? time / asset.duration : 0;
  return Math.min(
    Math.floor(progress * asset.frames.length),
    asset.frames.length - 1,
  );
}
