import type { AnimationFrame } from "../types";
import { mapHolisticResultToFrame } from "../processing";

type HolisticResultLike = Parameters<typeof mapHolisticResultToFrame>[0];

type VideoFrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export interface ExtractionProgress {
  currentFrame: number;
  totalFrames: number;
  progress: number;
  frame?: AnimationFrame;
}

export interface HolisticExtractionOptions {
  modelAssetPath?: string;
  wasmPath?: string;
  videoPath?: string;
}

export interface ExtractedAnimationSequence {
  duration: number;
  frames: AnimationFrame[];
  sourceFps: number;
  /** Original video dimensions for pixel-space rendering */
  imageWidth?: number;
  imageHeight?: number;
  /** Path/URL to source video */
  videoPath?: string;
}

const DEFAULT_MODEL_ASSET_PATH = "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task";
const DEFAULT_WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

export function mapHolisticVideoResult(result: HolisticResultLike, timestamp: number): AnimationFrame | null {
  const frame = mapHolisticResultToFrame(result, timestamp);
  const hasLandmarks = frame.landmarks.length > 0 || (frame.poseLandmarks ?? []).length > 0 || (frame.faceLandmarks ?? []).length > 0;

  return hasLandmarks ? frame : null;
}

export async function extractLandmarksFromVideo(
  video: HTMLVideoElement,
  options: HolisticExtractionOptions = {},
  onProgress?: (progress: ExtractionProgress) => void,
): Promise<ExtractedAnimationSequence> {
  if (typeof window === "undefined") {
    throw new Error("Landmark extraction is available only in a browser.");
  }
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    throw new Error("The source video must have a valid duration before extraction.");
  }

  console.log(`[Holistic] Loading MediaPipe with duration=${video.duration}s, dimensions=${video.videoWidth}x${video.videoHeight}`);

  const { FilesetResolver, HolisticLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(options.wasmPath ?? DEFAULT_WASM_PATH);
  let landmarker;
  try {
    console.log("[Holistic] Attempting GPU delegate...");
    landmarker = await HolisticLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: options.modelAssetPath ?? process.env.NEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_URL ?? DEFAULT_MODEL_ASSET_PATH,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
    });
    console.log("[Holistic] GPU delegate initialized successfully");
  } catch {
    console.warn("[Holistic] GPU failed, falling back to CPU");
    landmarker = await HolisticLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: options.modelAssetPath ?? process.env.NEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_URL ?? DEFAULT_MODEL_ASSET_PATH,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
    });
    console.log("[Holistic] CPU delegate initialized");
  }

  const sourceFps = 30;
  const totalFrames = Math.max(1, Math.ceil(video.duration * sourceFps));
  const frames: AnimationFrame[] = [];
  const sourceVideo = video as VideoFrameCallbackVideo;
  let lastCapturedTime = -1;
  let callbackHandle: number | undefined;
  let animationFrameHandle: number | undefined;
  let stopped = false;

  console.log(`[Extraction] Starting: ${totalFrames} total frames expected`);

  try {
    video.currentTime = 0;
    await video.play();

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        stopped = true;
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onError);
        if (callbackHandle !== undefined) sourceVideo.cancelVideoFrameCallback?.(callbackHandle);
        if (animationFrameHandle !== undefined) window.cancelAnimationFrame(animationFrameHandle);
      };
      const onEnded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("The source video could not be decoded during landmark extraction."));
      };
      const capture = (timestamp: number) => {
        if (stopped) return;
        if (video.currentTime !== lastCapturedTime) {
          lastCapturedTime = video.currentTime;
          const result = landmarker.detectForVideo(video, timestamp);
          const frame = mapHolisticVideoResult(result, timestamp);
          if (frame) frames.push(frame);
          const currentFrame = Math.min(totalFrames, Math.max(1, Math.round(video.currentTime * sourceFps)));
          onProgress?.({ currentFrame, totalFrames, progress: currentFrame / totalFrames, frame: frame ?? undefined });
        }
        scheduleCapture();
      };
      const scheduleCapture = () => {
        if (stopped) return;
        if (sourceVideo.requestVideoFrameCallback) {
          callbackHandle = sourceVideo.requestVideoFrameCallback(capture);
        } else {
          animationFrameHandle = window.requestAnimationFrame(capture);
        }
      };

      video.addEventListener("ended", onEnded, { once: true });
      video.addEventListener("error", onError, { once: true });
      scheduleCapture();
    });
  } finally {
    video.pause();
    landmarker.close();
  }

  console.log(`[Extraction] Complete: ${frames.length}/${totalFrames} frames extracted`);
  if (frames.length === 0) {
    console.warn("[Extraction] No frames were extracted — video may be blank or unreadable");
  }

  return {
    duration: video.duration,
    frames,
    sourceFps,
    imageWidth: video.videoWidth || undefined,
    imageHeight: video.videoHeight || undefined,
    videoPath: options.videoPath,
  };
}