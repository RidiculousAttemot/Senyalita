import type { PlaybackProgress } from "@/features/sign-animation/player/SignAnimationPlayer";

/**
 * Where the sequence is, as one reading taken from one sample.
 *
 * The viewer used to assemble this from two independent callbacks: the clip
 * index from `onGestureChange` and the time within that clip from `onProgress`.
 * They do not fire together. `onGestureChange` lands the instant a clip
 * changes; `onProgress` is throttled to one push every 100ms, because at 60fps
 * it was re-rendering the whole stage on every frame next to a 1080p decode.
 *
 * So for up to 100ms after every clip boundary the two disagreed, and the
 * readout added the head of the new clip's offset to the tail of the old
 * clip's time: the clock and the scrubber jumped forward by most of a clip and
 * then snapped back. One boundary per sign — eight visible jumps in a
 * nine-letter fingerspelled word, which is most of what this screen plays.
 *
 * `PlaybackProgress` already carries the engine's own index, sampled at the
 * same instant as `clipTime`. Reading both from it is what makes the two agree
 * by construction, and it is why this takes a progress sample rather than an
 * index and a time.
 *
 * Extracted from the component so it is reachable from a test. The arithmetic
 * is the whole bug; behind a canvas and a requestAnimationFrame loop it is not
 * something a test can get at, and a test that reimplemented it would keep
 * passing when this regressed.
 */

/** Just the asset facts the arithmetic needs. `AnimationClip` satisfies it. */
export interface PlayheadClip {
  asset: { duration: number; totalFrames: number; fps: number };
}

export interface Playhead {
  /** Clip the playhead is inside. */
  index: number;
  /** Seconds into the whole sequence. */
  elapsedSeconds: number;
  totalSeconds: number;
  /** 1-based frame across the whole sequence, for the scrubber. */
  frameNumber: number;
  frameTotal: number;
  /** 0..1 through the current clip, for the timeline chips. */
  clipProgress: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const empty: Playhead = {
  index: 0, elapsedSeconds: 0, totalSeconds: 0, frameNumber: 0, frameTotal: 0, clipProgress: 0,
};

export function computePlayhead(
  clips: PlayheadClip[],
  progress: PlaybackProgress | null,
  /** Last index from `onGestureChange`, used until the first progress sample lands. */
  fallbackIndex: number,
  finished: boolean,
): Playhead {
  if (clips.length === 0) return empty;

  const frameTotal = clips.reduce((sum, c) => sum + c.asset.totalFrames, 0);
  const totalSeconds = clips.reduce((sum, c) => sum + c.asset.duration, 0) / 1000;
  const lastIndex = clips.length - 1;

  // A finished sequence sits at the end, and has to be pinned there rather than
  // left wherever the last sample fell. The engine's closing tick returns
  // before its frame callback -- that is how it stops -- so the final position
  // is never pushed, and the throttle means the last one that was is up to
  // 100ms of playback short. Without this the sign ends with the scrubber
  // stopped near but not at the end, and the clock never reaching the duration
  // printed next to it.
  if (finished) {
    return {
      index: lastIndex, elapsedSeconds: totalSeconds, totalSeconds,
      frameNumber: frameTotal, frameTotal, clipProgress: 1,
    };
  }

  const index = clamp(progress?.index ?? fallbackIndex, 0, lastIndex);
  const clip = clips[index];
  const clipSeconds = clip.asset.duration / 1000;
  // Clamped to its own clip: a sample taken between a clip ending and the next
  // one being reported would otherwise spill past the boundary it belongs to.
  const clipTime = clamp(progress?.clipTime ?? 0, 0, clipSeconds);

  const before = clips.slice(0, index);
  const framesBefore = before.reduce((sum, c) => sum + c.asset.totalFrames, 0);
  const secondsBefore = before.reduce((sum, c) => sum + c.asset.duration, 0) / 1000;
  const localFrame = Math.min(
    Math.max(0, clip.asset.totalFrames - 1),
    Math.round(clipTime * clip.asset.fps),
  );

  return {
    index,
    elapsedSeconds: Math.min(totalSeconds, secondsBefore + clipTime),
    totalSeconds,
    frameNumber: Math.min(frameTotal, framesBefore + localFrame + 1),
    frameTotal,
    clipProgress: clipSeconds > 0 ? clipTime / clipSeconds : 0,
  };
}
