/**
 * Types for the shared validation rules.
 *
 * The rules are plain ESM so the seeder can import them; this gives TypeScript
 * callers the same surface. Keep the two in step -- the .mjs is the source of
 * truth for behaviour, this file only describes it.
 */
export const MIN_FRAMES: number;
export const MIN_FACE_LANDMARKS_FOR_MESH: number;

export function validateAnimationAsset(
  asset: unknown,
  options?: { gloss?: string; expectedVersion?: number; previousVersion?: number },
): {
  valid: boolean;
  errors: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  stats: {
    frameCount: number;
    fps: number;
    durationMs: number;
    maxHandsInAnyFrame: number;
    framesWithHands: number;
    hasPose: boolean;
    hasFaceMesh: boolean;
  };
};
