import type { GestureAnimationAsset } from "@/features/sign-animation/types";

/**
 * Coordinate precision for a published landmark asset.
 *
 * Four, matching PRECISION in scripts/seed-animation-assets.mjs, which produced
 * all 37 assets already in the library. The Animation Studio published raw
 * float64 instead, so a sign made in the browser was about twice the size of the
 * identical sign made by the script — the same data, carrying seventeen
 * significant figures of a number that is only meaningful to four.
 *
 * Landmarks are normalised to 0-1, so the fourth decimal place is a tenth of a
 * pixel on a 1000px canvas:
 *
 *   0.3959202170372009  ->  0.3959
 *
 * Measured on a 160-frame asset with the face mesh kept in full: 6.01 MB ->
 * 2.87 MB, a 52% reduction with nothing removed.
 *
 * That matters beyond disk. The landmark JSON is sent in the request body when
 * publishing, and a Vercel function request is capped at 4.5 MB. THANK YOU
 * serialised to 7,552,771 bytes, so it published on localhost and could not
 * publish in production at all. Quantised it is roughly 3.6 MB and fits.
 *
 * This trims digits, never points. Every hand, pose and face landmark survives,
 * and the frame count is untouched — nothing here changes what is drawn.
 */
export const LANDMARK_PRECISION = 4;

const factor = 10 ** LANDMARK_PRECISION;

/** Rounds to LANDMARK_PRECISION decimal places. */
const q = (n: number): number => Math.round(n * factor) / factor;

type Point = { x: number; y: number; z: number };
const roundPoint = (p: Point): Point => ({ x: q(p.x), y: q(p.y), z: q(p.z) });

/**
 * Narrow check that `quantiseAsset` can walk this value.
 *
 * Deliberately minimal — it asks only for what the quantiser touches. The route
 * has its own, stricter guard, and that one is the gate for what may be stored;
 * duplicating it here would mean two definitions of "valid asset" drifting
 * apart. This one only decides whether trimming digits is possible.
 */
export function isQuantisableAsset(value: unknown): value is GestureAnimationAsset {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { frames?: unknown }).frames)
  );
}

/**
 * Returns a copy of `asset` with every coordinate quantised.
 *
 * Structure, frame count and landmark count are preserved exactly. Timestamps
 * go to 2dp — they are milliseconds, so a hundredth of a millisecond was never
 * meaningful either.
 */
export function quantiseAsset(asset: GestureAnimationAsset): GestureAnimationAsset {
  return {
    ...asset,
    frames: asset.frames.map((frame) => ({
      ...frame,
      timestamp: Math.round(frame.timestamp * 100) / 100,
      landmarks: frame.landmarks.map((hand) => ({
        ...hand,
        landmarks: hand.landmarks.map(roundPoint),
      })),
      ...(frame.poseLandmarks ? { poseLandmarks: frame.poseLandmarks.map(roundPoint) } : {}),
      ...(frame.faceLandmarks ? { faceLandmarks: frame.faceLandmarks.map(roundPoint) } : {}),
    })),
  };
}
