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
export async function createHandLandmarker(
  landmarkerOptions: Record<string, unknown>,
) {
  const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

  try {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL, delegate: "GPU" },
      ...landmarkerOptions,
    });
  } catch {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL, delegate: "CPU" },
      ...landmarkerOptions,
    });
  }
}
