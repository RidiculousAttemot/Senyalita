/**
 * Publish-time validation for landmark animation assets.
 *
 * Thresholds and required fields were derived from the 37 extracted FSL
 * alphabet/digit assets rather than assumed:
 *
 *   frames    137 .. 240
 *   fps       30 (constant)
 *   duration  4533 .. 7967 ms
 *   hands     18 assets use two hands, 19 use exactly one
 *   pose      present in all 37
 *   face      present in all 37
 *
 * The one-hand figure is the important one: requiring both hands would reject
 * 19 of 37 signs, including most of the alphabet, because one-handed
 * fingerspelling is normal in FSL. So a hand requirement is "at least one".
 *
 * Failures are split into errors (block publishing, the asset cannot render
 * usefully) and warnings (publishable, but the renderer will degrade — e.g.
 * ExactLandmarkRenderer skips the face mesh below 50 face landmarks).
 */

/** Below this a "sign" is too short to read as a gesture rather than a glitch. */
export const MIN_FRAMES = 10;
/** MediaPipe face mesh is 478 points; the renderer needs a usable subset. */
export const MIN_FACE_LANDMARKS_FOR_MESH = 50;

export interface AnimationValidationIssue {
  code: string;
  message: string;
}

export interface AnimationValidationResult {
  valid: boolean;
  errors: AnimationValidationIssue[];
  warnings: AnimationValidationIssue[];
  stats: {
    frameCount: number;
    fps: number;
    durationMs: number;
    maxHandsInAnyFrame: number;
    framesWithHands: number;
    hasPose: boolean;
    hasFaceMesh: boolean;
  };
}

interface FrameLike {
  landmarks?: Array<{ landmarks?: unknown[] }>;
  poseLandmarks?: unknown[];
  faceLandmarks?: unknown[];
}

interface AssetLike {
  label?: unknown;
  fps?: unknown;
  duration?: unknown;
  totalFrames?: unknown;
  frames?: unknown;
}

export function validateAnimationAsset(
  asset: unknown,
  options: { gloss?: string; expectedVersion?: number; previousVersion?: number } = {},
): AnimationValidationResult {
  const errors: AnimationValidationIssue[] = [];
  const warnings: AnimationValidationIssue[] = [];

  const empty: AnimationValidationResult["stats"] = {
    frameCount: 0, fps: 0, durationMs: 0,
    maxHandsInAnyFrame: 0, framesWithHands: 0,
    hasPose: false, hasFaceMesh: false,
  };

  if (!asset || typeof asset !== "object") {
    return { valid: false, errors: [{ code: "asset_missing", message: "No landmark animation was supplied." }], warnings, stats: empty };
  }

  const a = asset as AssetLike;
  const frames = Array.isArray(a.frames) ? (a.frames as FrameLike[]) : null;

  if (!frames) {
    errors.push({ code: "frames_missing", message: "The animation has no frames array." });
  } else if (frames.length === 0) {
    errors.push({ code: "frames_empty", message: "The animation contains no frames." });
  }

  const fps = typeof a.fps === "number" ? a.fps : 0;
  const durationMs = typeof a.duration === "number" ? a.duration : 0;
  const frameCount = frames?.length ?? 0;

  if (!(fps > 0)) errors.push({ code: "fps_invalid", message: `Frame rate must be greater than zero (got ${String(a.fps)}).` });
  if (!(durationMs > 0)) errors.push({ code: "duration_invalid", message: `Duration must be greater than zero (got ${String(a.duration)}).` });
  if (frames && frameCount < MIN_FRAMES) {
    errors.push({ code: "too_few_frames", message: `Animations need at least ${MIN_FRAMES} frames; this one has ${frameCount}.` });
  }

  let maxHands = 0;
  let framesWithHands = 0;
  let hasPose = false;
  let maxFace = 0;

  for (const frame of frames ?? []) {
    const hands = Array.isArray(frame?.landmarks)
      ? frame.landmarks.filter((h) => Array.isArray(h?.landmarks) && h.landmarks.length > 0)
      : [];
    if (hands.length > 0) framesWithHands++;
    if (hands.length > maxHands) maxHands = hands.length;
    if (Array.isArray(frame?.poseLandmarks) && frame.poseLandmarks.length > 0) hasPose = true;
    const face = Array.isArray(frame?.faceLandmarks) ? frame.faceLandmarks.length : 0;
    if (face > maxFace) maxFace = face;
  }

  // At least one hand — NOT both. Roughly half of FSL fingerspelling is
  // one-handed, so requiring two would reject valid signs.
  if (frames && frames.length > 0 && maxHands === 0) {
    errors.push({ code: "no_hands", message: "No hand landmarks were detected in any frame." });
  }
  if (frames && frames.length > 0 && framesWithHands > 0 && framesWithHands < frameCount * 0.25) {
    warnings.push({
      code: "sparse_hands",
      message: `Hands appear in only ${framesWithHands} of ${frameCount} frames — the sign may be partly out of shot.`,
    });
  }
  if (!hasPose && frames && frames.length > 0) {
    warnings.push({ code: "no_pose", message: "No pose landmarks — the avatar's body will be estimated rather than tracked." });
  }
  if (maxFace < MIN_FACE_LANDMARKS_FOR_MESH && frames && frames.length > 0) {
    warnings.push({ code: "no_face_mesh", message: "No usable face mesh — non-manual expression will not render." });
  }

  const gloss = options.gloss ?? (typeof a.label === "string" ? a.label : "");
  if (!gloss || !gloss.trim()) {
    errors.push({ code: "gloss_missing", message: "A canonical gloss is required." });
  }

  // Versions must advance; re-publishing an existing number would collide with
  // the (asset_id, version) unique constraint.
  if (options.expectedVersion !== undefined) {
    const previous = options.previousVersion ?? 0;
    if (!Number.isInteger(options.expectedVersion) || options.expectedVersion <= 0) {
      errors.push({ code: "version_invalid", message: "Version must be a positive integer." });
    } else if (options.expectedVersion <= previous) {
      errors.push({
        code: "version_not_incremented",
        message: `Version must be greater than the current version (${previous}); got ${options.expectedVersion}.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      frameCount,
      fps,
      durationMs,
      maxHandsInAnyFrame: maxHands,
      framesWithHands,
      hasPose,
      hasFaceMesh: maxFace >= MIN_FACE_LANDMARKS_FOR_MESH,
    },
  };
}
