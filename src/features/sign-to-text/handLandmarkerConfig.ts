/**
 * Hand-landmarker configuration shared by every surface that feeds the
 * recognition buffer.
 *
 * These are not stylistic constants. The capture rate and the model build
 * determine what the sequence buffer sees, so anything measuring recognition
 * has to use the same values as the live path or it measures something else.
 * /evaluation drifted exactly this way: it ran the legacy MediaPipe Solutions
 * API with no capture throttle, so the accuracy it reported was not the
 * accuracy of the production pipeline.
 */

/** 30fps — the rate training clips were extracted at (scripts/extract-holistic-videos.mjs, ffmpeg fps=30). */
export const CAPTURE_TARGET_FPS = 30;

/**
 * A small tolerance stops a camera running at a nominal 30fps from having
 * every other frame rejected by jitter.
 */
export const CAPTURE_INTERVAL_MS = 1000 / CAPTURE_TARGET_FPS - 2;

/**
 * Both of these are served from this origin rather than a third-party CDN.
 *
 * Measured on a cold production load of /translate: the WASM runtime is 10.9MB
 * and the hand-landmarker task 7.6MB, together 18.5MB — roughly fourteen times
 * the entire same-origin payload, and the two slowest requests by a wide margin.
 * Self-hosting does not shrink them; it removes a third-party dependency from
 * the critical path of a system demonstrated on venue wifi, and lets them be
 * served immutable from the same edge as everything else. Same reasoning as
 * self-hosting Inter in 0c2ad36b.
 *
 * public/mediapipe/wasm/ is copied verbatim from
 * node_modules/@mediapipe/tasks-vision/wasm, so the runtime always matches the
 * installed API version — pinning a CDN URL to a version string is what lets
 * those two drift apart. Both the SIMD and no-SIMD builds are shipped;
 * FilesetResolver picks one at load time, so a visitor downloads only the
 * variant their browser supports.
 */
export const HAND_LANDMARKER_MODEL_URL = process.env.NEXT_PUBLIC_MEDIAPIPE_HAND_MODEL_URL
  ?? "/models/mediapipe/hand_landmarker.task";

export const MEDIAPIPE_WASM_URL = "/mediapipe/wasm";

/**
 * Longest edge of the frame handed to MediaPipe.
 *
 * Detection cost scales with pixel count, and `width: { ideal: 640 }` is only a
 * hint — a phone is free to hand back 1280x720 or 1920x1080, which is 4-9x the
 * work per frame. On a mid-range Android this showed as 1-2 FPS, where the
 * model needs 30 to match the rate its training clips were extracted at, so
 * recognition could not work at all.
 *
 * 480px on the long edge keeps hands comfortably resolvable — MediaPipe's own
 * hand model runs at 224x224 internally — while cutting the work enough to
 * matter. Landmarks come back normalised to 0-1, so nothing downstream cares
 * what resolution produced them.
 */
export const DETECT_MAX_EDGE = 480;

/**
 * Downscales into a reused offscreen canvas and returns it, or returns the
 * video untouched when it is already small enough. Allocating a canvas per
 * frame would trade one cost for another.
 */
export function createDetectionSurface() {
  let canvas: HTMLCanvasElement | null = null;
  let context: CanvasRenderingContext2D | null = null;

  return (video: HTMLVideoElement): HTMLVideoElement | HTMLCanvasElement => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return video;

    const longest = Math.max(w, h);
    if (longest <= DETECT_MAX_EDGE) return video;

    const scale = DETECT_MAX_EDGE / longest;
    const tw = Math.round(w * scale);
    const th = Math.round(h * scale);

    if (!canvas) {
      canvas = document.createElement("canvas");
      context = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
    }
    if (!context) return video;
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw;
      canvas.height = th;
    }
    context.drawImage(video, 0, 0, tw, th);
    return canvas;
  };
}

/** Bone pairs for drawing a hand skeleton over 21 landmarks. */
export const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17],
];

/**
 * Creates a HandLandmarker, preferring the GPU delegate and falling back to
 * CPU. The fallback is load-bearing: GPU creation throws outright on machines
 * without a usable WebGL context, and without it the camera simply never starts.
 */
let activeDelegate: "GPU" | "CPU" | null = null;

/**
 * Which delegate the running landmarker actually got.
 *
 * Worth surfacing: the CPU fallback is roughly an order of magnitude slower,
 * and because the fallback is silent a device quietly running on CPU looks
 * identical to one that is simply slow. On mobile that is the difference
 * between "needs a smaller frame" and "needs a different approach entirely".
 */
export const getActiveDelegate = () => activeDelegate;

export async function createHandLandmarker(
  landmarkerOptions: Record<string, unknown>,
) {
  const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

  try {
    const landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL, delegate: "GPU" },
      ...landmarkerOptions,
    });
    activeDelegate = "GPU";
    return landmarker;
  } catch {
    const landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL, delegate: "CPU" },
      ...landmarkerOptions,
    });
    activeDelegate = "CPU";
    console.warn(
      "[handLandmarker] GPU delegate unavailable, running on CPU. Expect roughly "
      + "an order of magnitude slower detection.",
    );
    return landmarker;
  }
}
