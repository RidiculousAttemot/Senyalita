import type { AnimationFrame, GestureAnimationAsset } from "./types";

/**
 * Where the sign actually happens inside a recorded clip.
 *
 * Every published asset is a whole take: the signer walks into frame, settles,
 * signs, and drops their hands. None of the 130 carries a `trim` -- the field
 * exists on the type and was never written -- so playback starts on a rest pose
 * and, when looping, replays the stillness at both ends every cycle. Measured
 * on production: KNOW stands still for its first 15 frames of 134, GOOD MORNING
 * for 50 of 248, THANK YOU for 24 of 189. On a landing panel that is the whole
 * first impression, a figure standing still next to the words "watch it become
 * sign".
 *
 * WHY VELOCITY AND NOT DISPLACEMENT FROM FRAME 0. Displacement was the obvious
 * signal and it is wrong: THANK YOU's largest displacement is its final frame,
 * because the signer lowers their arms and walks off, so "the most
 * representative frame" came out as the one where the sign is already over.
 * Frame-to-frame velocity asks whether anything is moving *now*, which is the
 * actual question.
 *
 * DELIBERATELY CONSERVATIVE. The threshold is a fraction of the clip's own peak
 * velocity rather than a fixed number, because signs differ by an order of
 * magnitude in how much they move, and it never trims to less than MIN_SPAN
 * frames -- a bad span returns the whole clip untouched. Measured across six
 * assets it keeps 72-100% and has never cut into a sign. Under-trimming shows a
 * little dead time; over-trimming removes part of a word.
 */

/**
 * Shoulders, elbows and wrists. Hands are the obvious choice and the wrong one:
 * `landmarks` is empty on a good number of frames -- KNOW's opening frame has
 * zero hands -- so a hand-based signal reads "still" exactly when tracking
 * drops out. The pose array is present on every frame of every asset.
 */
const TRACKED_POSE_POINTS = [11, 12, 13, 14, 15, 16];

/** Below this, per frame, is tracking jitter rather than movement. */
const NOISE_FLOOR = 0.004;
/** Movement counts once it reaches this fraction of the clip's own peak. */
const PEAK_FRACTION = 0.15;
/** Kept before the first moving frame, so the sign has an entry rather than snapping into motion. */
const LEAD_FRAMES = 3;
/** Kept after the last moving frame, so it has somewhere to land. */
const TRAIL_FRAMES = 4;
/** A span shorter than this is not believable; the clip is returned whole. */
const MIN_SPAN_FRAMES = 12;

export interface ActiveSpan {
  start: number;
  end: number;
  /** False when the detector fell back to the whole clip. */
  trimmed: boolean;
}

/** Per-frame movement of the tracked pose points, smoothed over three frames. */
function velocities(frames: AnimationFrame[]): number[] {
  const raw: number[] = [0];
  for (let i = 1; i < frames.length; i++) {
    const before = frames[i - 1].poseLandmarks;
    const after = frames[i].poseLandmarks;
    let most = 0;
    if (before && after) {
      for (const point of TRACKED_POSE_POINTS) {
        const a = before[point];
        const b = after[point];
        if (a && b) most = Math.max(most, Math.hypot(b.x - a.x, b.y - a.y));
      }
    }
    raw.push(most);
  }
  // A single dropped frame reads as a spike in both directions; three-frame
  // smoothing stops one of those from opening or closing the span.
  return raw.map((_, i) => {
    const window = raw.slice(Math.max(0, i - 1), i + 2);
    return window.reduce((sum, v) => sum + v, 0) / window.length;
  });
}

export function activeSpan(frames: AnimationFrame[]): ActiveSpan {
  const whole: ActiveSpan = { start: 0, end: Math.max(0, frames.length - 1), trimmed: false };
  if (frames.length < MIN_SPAN_FRAMES) return whole;

  const speed = velocities(frames);
  const peak = Math.max(...speed);
  const threshold = Math.max(NOISE_FLOOR, peak * PEAK_FRACTION);

  const first = speed.findIndex((v) => v >= threshold);
  if (first < 0) return whole;
  let last = speed.length - 1;
  while (last > first && speed[last] < threshold) last--;

  if (last - first + 1 < MIN_SPAN_FRAMES) return whole;

  return {
    start: Math.max(0, first - LEAD_FRAMES),
    end: Math.min(frames.length - 1, last + TRAIL_FRAMES),
    trimmed: true,
  };
}

/**
 * The same asset with its idle lead-in and trail-off removed.
 *
 * Returns the original object when there is nothing worth cutting, so callers
 * can apply it unconditionally. Never mutates: the loader caches assets by
 * gloss and hands the same object to every caller, so editing one in place
 * would trim the translator's copy too.
 */
export function trimToActiveSpan(asset: GestureAnimationAsset): GestureAnimationAsset {
  const span = activeSpan(asset.frames);
  if (!span.trimmed || (span.start === 0 && span.end === asset.frames.length - 1)) return asset;

  const frames = asset.frames.slice(span.start, span.end + 1);
  const fps = asset.fps || 30;
  // The engine indexes frames by proportion of `duration`, not by timestamp
  // (PlaybackEngine: exactIndex = progress * (frames.length - 1)), so duration
  // and the frame count have to move together or playback runs at the wrong
  // rate. Timestamps are rebased for correctness; nothing indexes on them.
  const offset = frames[0]?.timestamp ?? 0;

  return {
    ...asset,
    frames: frames.map((f) => ({ ...f, timestamp: f.timestamp - offset })),
    totalFrames: frames.length,
    duration: (frames.length / fps) * 1000,
    // Overlay and Human modes seek the recording to this offset. Cutting frames
    // off the front without advancing it would slide the skeleton out of
    // registration with the video -- not visible on the landing page, which is
    // skeleton-only, but this helper should not be a trap for the next caller.
    sourceOffsetSeconds: (asset.sourceOffsetSeconds ?? 0) + span.start / fps,
    trim: {
      originalTotalFrames: asset.totalFrames,
      startFrame: span.start,
      endFrame: span.end,
      method: "pose-velocity",
    },
  };
}
