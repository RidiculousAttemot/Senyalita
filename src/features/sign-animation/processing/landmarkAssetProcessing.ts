import type { AnimationFrame, AnimationQualityMetrics, GestureAnimationAsset } from "../types";
import { AnimationQualityEvaluator } from "../engine/qualityEvaluation";

type HolisticLandmark = { x: number; y: number; z: number };

type HolisticResultLike = {
  faceLandmarks: HolisticLandmark[][];
  leftHandLandmarks: HolisticLandmark[][];
  poseLandmarks: HolisticLandmark[][];
  rightHandLandmarks: HolisticLandmark[][];
};

export interface CreateGestureAnimationAssetInput {
  frames: AnimationFrame[];
  fps: number;
  label: string;
  language?: string;
  signerId?: string;
  source?: string;
}

const cloneFrame = (frame: AnimationFrame, timestamp: number): AnimationFrame => ({
  ...frame,
  timestamp,
  landmarks: frame.landmarks.map((hand) => ({
    landmarks: hand.landmarks.map((point) => ({ ...point })),
    side: hand.side,
  })),
  poseLandmarks: frame.poseLandmarks?.map((point) => ({ ...point })),
  faceLandmarks: frame.faceLandmarks?.map((point) => ({ ...point })),
});

export function repairMissingFrames(frames: AnimationFrame[]): AnimationFrame[] {
  return frames.map((frame, index) => {
    if (frame.landmarks.length > 0) return cloneFrame(frame, frame.timestamp);

    const previous = frames.slice(0, index).reverse().find((candidate) => candidate.landmarks.length > 0);
    const next = frames.slice(index + 1).find((candidate) => candidate.landmarks.length > 0);
    const replacement = previous ?? next;

    return replacement ? cloneFrame(replacement, frame.timestamp) : cloneFrame(frame, frame.timestamp);
  });
}

export function mapHolisticResultToFrame(result: HolisticResultLike, timestamp: number): AnimationFrame {
  const cloneLandmarks = (landmarks: HolisticLandmark[] | undefined) => landmarks?.map((landmark) => ({ ...landmark })) ?? [];
  const leftHand = cloneLandmarks(result.leftHandLandmarks[0]);
  const rightHand = cloneLandmarks(result.rightHandLandmarks[0]);

  return {
    timestamp,
    landmarks: [
      ...(leftHand.length > 0 ? [{ landmarks: leftHand, side: "left" as const }] : []),
      ...(rightHand.length > 0 ? [{ landmarks: rightHand, side: "right" as const }] : []),
    ],
    poseLandmarks: cloneLandmarks(result.poseLandmarks[0]),
    faceLandmarks: cloneLandmarks(result.faceLandmarks[0]),
  };
}

export function normalizeFrameSequence(frames: AnimationFrame[], fps: number): AnimationFrame[] {
  if (frames.length === 0) return [];
  if (!Number.isFinite(fps) || fps <= 0) throw new Error("FPS must be greater than zero.");

  const orderedFrames = [...frames].sort((left, right) => left.timestamp - right.timestamp);
  const startTimestamp = orderedFrames[0].timestamp;
  const endTimestamp = orderedFrames[orderedFrames.length - 1].timestamp;
  const interval = 1000 / fps;
  const normalized: AnimationFrame[] = [];

  for (let timestamp = startTimestamp; timestamp < endTimestamp; timestamp += interval) {
    const nearest = orderedFrames.reduce((best, candidate) => (
      Math.abs(candidate.timestamp - timestamp) < Math.abs(best.timestamp - timestamp) ? candidate : best
    ));
    normalized.push(cloneFrame(nearest, Math.round(timestamp)));
  }

  normalized.push(cloneFrame(orderedFrames[orderedFrames.length - 1], endTimestamp));
  return normalized;
}

export function createGestureAnimationAsset(input: CreateGestureAnimationAssetInput): GestureAnimationAsset {
  if (input.frames.length === 0) throw new Error("At least one extracted frame is required.");

  const frames = normalizeFrameSequence(repairMissingFrames(input.frames), input.fps);
  const duration = Math.max(0, frames[frames.length - 1].timestamp - frames[0].timestamp);

  return {
    label: input.label,
    language: input.language ?? "FSL",
    fps: input.fps,
    duration,
    totalFrames: frames.length,
    frames,
    metadata: {
      signerId: input.signerId,
      source: input.source ?? "landmark-video-extraction",
      featureDimension: 3,
      sequenceLength: frames.length,
      version: 1,
    },
  };
}

export function scoreAnimationQuality(asset: GestureAnimationAsset): AnimationQualityMetrics {
  return new AnimationQualityEvaluator().evaluate(asset);
}