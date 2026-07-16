import type { AnimationFrame, GestureAnimationAsset } from "../types";
import { repairMissingFrames, normalizeFrameSequence, createGestureAnimationAsset, scoreAnimationQuality } from "./landmarkAssetProcessing";
import { smoothLandmarkSequence } from "../interpolation/oneEuroFilter";
import type { OneEuroConfig } from "../interpolation/oneEuroFilter";

export interface LandmarkProcessingOptions {
  targetFps: number;
  label: string;
  smoothMotion?: boolean;
  smoothingConfig?: Partial<OneEuroConfig>;
  repairMissing?: boolean;
  language?: string;
  signerId?: string;
  source?: string;
}

const DEFAULT_OPTIONS: LandmarkProcessingOptions = {
  targetFps: 30,
  label: "UNTITLED",
  smoothMotion: true,
  repairMissing: true,
  language: "FSL",
  source: "landmark-video-extraction",
};

export interface LandmarkProcessingResult {
  asset: GestureAnimationAsset;
  frames: AnimationFrame[];
  quality: ReturnType<typeof scoreAnimationQuality>;
  processingStats: {
    inputFrames: number;
    repairedFrames: number;
    smoothedFrames: number;
    outputFrames: number;
    durationMs: number;
    processingTimeMs: number;
  };
}

export function processExtractedFrames(
  rawFrames: AnimationFrame[],
  sourceFps: number,
  options?: Partial<LandmarkProcessingOptions>,
): LandmarkProcessingResult {
  const startTime = performance.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let frames = [...rawFrames];
  const inputFrameCount = frames.length;

  if (opts.repairMissing && frames.length > 0) {
    frames = repairMissingFrames(frames);
  }
  const repairedCount = frames.length - inputFrameCount;

  if (opts.smoothMotion && frames.length > 0) {
    frames = smoothLandmarkSequence(frames, opts.smoothingConfig);
  }

  frames = normalizeFrameSequence(frames, opts.targetFps);

  const asset = createGestureAnimationAsset({
    frames,
    fps: opts.targetFps,
    label: opts.label,
    language: opts.language,
    signerId: opts.signerId,
    source: opts.source,
  });

  const quality = scoreAnimationQuality(asset);

  return {
    asset,
    frames,
    quality,
    processingStats: {
      inputFrames: inputFrameCount,
      repairedFrames: Math.max(0, repairedCount),
      smoothedFrames: frames.length,
      outputFrames: frames.length,
      durationMs: asset.duration,
      processingTimeMs: Math.round(performance.now() - startTime),
    },
  };
}
