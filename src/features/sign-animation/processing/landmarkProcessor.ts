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

  console.log(`[Processing] Input: ${rawFrames.length} frames at ${sourceFps} source FPS`);

  let frames = [...rawFrames];
  const inputFrameCount = frames.length;

  if (opts.repairMissing && frames.length > 0) {
    const before = frames.length;
    frames = repairMissingFrames(frames);
    console.log(`[Processing] Repair: ${frames.length - before} frames added/repaired`);
  }
  const repairedCount = frames.length - inputFrameCount;

  if (opts.smoothMotion && frames.length > 0) {
    frames = smoothLandmarkSequence(frames, opts.smoothingConfig);
    console.log(`[Processing] Smoothing applied`);
  }

  frames = normalizeFrameSequence(frames, opts.targetFps);
  console.log(`[Processing] Normalized: ${frames.length} frames at ${opts.targetFps} FPS`);

  console.log(`[Asset] Creating GestureAnimationAsset...`);
  const asset = createGestureAnimationAsset({
    frames,
    fps: opts.targetFps,
    label: opts.label,
    language: opts.language,
    signerId: opts.signerId,
    source: opts.source,
  });

  console.log(`[Asset] Created: duration=${asset.duration}ms, frameCount=${asset.frames.length}, fps=${asset.fps}`);
  console.log(`[Asset] Pose frames: ${asset.frames.filter((f) => (f.poseLandmarks?.length ?? 0) > 0).length}`);
  console.log(`[Asset] Face frames: ${asset.frames.filter((f) => (f.faceLandmarks?.length ?? 0) > 0).length}`);
  console.log(`[Asset] Hand frames: ${asset.frames.filter((f) => f.landmarks.length > 0).length}`);

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
