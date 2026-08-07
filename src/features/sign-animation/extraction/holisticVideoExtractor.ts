import type { AnimationFrame } from "../types";
import { mapHolisticResultToFrame } from "../processing";

type HolisticResultLike = Parameters<typeof mapHolisticResultToFrame>[0];

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

  console.log(`[Extraction] Starting: ${totalFrames} total frames expected`);

  /**
   * Seek to a timestamp and resolve once the frame there is actually decoded.
   *
   * `seeked` fires when currentTime has moved, which can be slightly before the
   * new frame is available to draw; readyState >= HAVE_CURRENT_DATA is the
   * condition that matters for detectForVideo. The timeout keeps one
   * undecodable frame from stalling the whole extraction -- it is skipped and
   * reported instead.
   */
  const seekTo = (time: number) =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        clearTimeout(timer);
        resolve(ok);
      };
      const onSeeked = () => {
        if (video.readyState >= 2) done(true);
        else video.addEventListener("canplay", () => done(video.readyState >= 2), { once: true });
      };
      const onError = () => done(false);
      const timer = setTimeout(() => done(false), 3000);

      video.addEventListener("seeked", onSeeked, { once: true });
      video.addEventListener("error", onError, { once: true });
      video.currentTime = time;
    });

  try {
    // Paused and seeked, not played.
    //
    // This used to drive capture from requestVideoFrameCallback during
    // playback, gated on `video.currentTime !== lastCapturedTime`. That makes
    // the whole extraction depend on the element actually advancing: if
    // playback never starts -- an autoplay policy, an element paused by the
    // caller, a decoder that will not run in the background -- the guard is
    // true exactly once and the run "completes" with 1 of 189 frames and no
    // error. It also capped throughput at real time and silently dropped any
    // frame the compositor skipped.
    //
    // Seeking is deterministic: every frame index is visited exactly once,
    // nothing depends on playback, and a failed seek is reported rather than
    // quietly shortening the result.
    video.pause();

    let skipped = 0;
    for (let i = 0; i < totalFrames; i++) {
      // Clamp inside the media: seeking exactly to duration lands past the
      // last frame and never fires `seeked` on some decoders.
      const time = Math.min(i / sourceFps, Math.max(0, video.duration - 1 / (sourceFps * 2)));
      if (!(await seekTo(time))) {
        skipped++;
        continue;
      }

      // detectForVideo requires strictly increasing timestamps; media time in
      // milliseconds is monotonic across the loop by construction.
      const timestampMs = Math.round(time * 1000);
      const result = landmarker.detectForVideo(video, timestampMs);
      const frame = mapHolisticVideoResult(result, timestampMs);
      if (frame) frames.push(frame);

      onProgress?.({
        currentFrame: i + 1,
        totalFrames,
        progress: (i + 1) / totalFrames,
        frame: frame ?? undefined,
      });
    }

    if (skipped > 0) {
      console.warn(`[Extraction] ${skipped}/${totalFrames} frames could not be decoded and were skipped.`);
    }
  } finally {
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