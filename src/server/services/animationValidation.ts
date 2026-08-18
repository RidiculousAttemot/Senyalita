/**
 * Publish-time validation for landmark animation assets — typed wrapper.
 *
 * The RULES live in src/lib/animationValidationRules.mjs, not here. Two callers
 * need them and only one of them can read TypeScript: the studio publish route
 * (TS) and scripts/seed-animation-assets.mjs (plain ESM). TypeScript consumes
 * JS happily; JS cannot consume TS without an experimental flag, so the shared
 * definition has to be the .mjs and this file has to be the wrapper.
 *
 * That direction matters. The seeder previously had no validation at all, and a
 * malformed asset -- no frames, no fps, no duration -- published cleanly to
 * production and rendered nothing. A second, seeder-local copy of the rules
 * would have drifted toward exactly that, because the seeder is the path nobody
 * watches.
 *
 * It lives under src/ rather than scripts/ because .vercelignore and
 * .dockerignore both exclude scripts/ — app code importing from there builds
 * locally and fails on deploy.
 *
 * The interfaces stay here: types cannot live in a .mjs. Callers of this module
 * see an unchanged API.
 */

import {
  MIN_FRAMES as RULES_MIN_FRAMES,
  MIN_FACE_LANDMARKS_FOR_MESH as RULES_MIN_FACE,
  validateAnimationAsset as validateRules,
} from "@/lib/animationValidationRules.mjs";

/** Below this a "sign" is too short to read as a gesture rather than a glitch. */
export const MIN_FRAMES: number = RULES_MIN_FRAMES;
/** MediaPipe face mesh is 478 points; the renderer needs a usable subset. */
export const MIN_FACE_LANDMARKS_FOR_MESH: number = RULES_MIN_FACE;

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

export function validateAnimationAsset(
  asset: unknown,
  options: { gloss?: string; expectedVersion?: number; previousVersion?: number } = {},
): AnimationValidationResult {
  return validateRules(asset, options) as AnimationValidationResult;
}
