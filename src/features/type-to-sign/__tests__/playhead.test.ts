import { describe, expect, it } from "vitest";
import { computePlayhead, type PlayheadClip } from "../playhead";
import type { PlaybackProgress } from "@/features/sign-animation/player/SignAnimationPlayer";

/**
 * The stage's clock and scrubber against what is actually playing.
 *
 * The readout used to be assembled from two callbacks that do not fire
 * together: the clip index from `onGestureChange`, which lands the instant a
 * clip changes, and the time within that clip from `onProgress`, throttled to
 * one push every 100ms. Between the two, the clock added the new clip's offset
 * to the old clip's time and jumped forward by most of a clip before snapping
 * back -- once per sign boundary, so eight times in a nine-letter word.
 *
 * These cases are the disagreements that were visible on screen, so they are
 * written as "what should the viewer read at this instant", not as assertions
 * about which callback won.
 */

/** Three one-second clips at 30fps: 90 frames, 3.0s. */
const clip = (durationMs: number, fps = 30): PlayheadClip => ({
  asset: { duration: durationMs, totalFrames: Math.round((durationMs / 1000) * fps), fps },
});

const clips = [clip(1000), clip(1000), clip(1000)];

const at = (index: number, clipTime: number): PlaybackProgress => ({
  index, clipTime, clipDuration: clips[index].asset.duration / 1000, total: clips.length, fps: 30,
});

describe("playhead", () => {
  it("reads elapsed time straight through a sequence", () => {
    expect(computePlayhead(clips, at(0, 0.5), 0, false).elapsedSeconds).toBeCloseTo(0.5);
    expect(computePlayhead(clips, at(1, 0.5), 1, false).elapsedSeconds).toBeCloseTo(1.5);
    expect(computePlayhead(clips, at(2, 0.5), 2, false).elapsedSeconds).toBeCloseTo(2.5);
  });

  it("does not jump when the index callback runs ahead of the progress sample", () => {
    // The regression. onGestureChange has already reported clip 1; the newest
    // progress sample is still clip 0, near its end. Reading the fallback index
    // against that time gave 1.0 + 0.98 = 1.98s -- most of a clip ahead of the
    // 0.98s actually playing, and it snapped back on the next sample.
    const playhead = computePlayhead(clips, at(0, 0.98), 1, false);
    expect(playhead.index).toBe(0);
    expect(playhead.elapsedSeconds).toBeCloseTo(0.98);
  });

  it("never runs backwards across a clip boundary", () => {
    // Samples in playback order must be non-decreasing, whatever the index
    // callback has reported in between.
    const samples = [at(0, 0.9), at(0, 0.99), at(1, 0.0), at(1, 0.1)];
    const staleIndexes = [0, 1, 1, 1];
    const times = samples.map((p, i) => computePlayhead(clips, p, staleIndexes[i], false).elapsedSeconds);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    }
  });

  it("pins a finished sequence to the end", () => {
    // The engine's closing tick returns before its frame callback, so the last
    // sample is up to 100ms short and no further one arrives. Left alone, the
    // sign ended with the scrubber stopped before the end and the clock never
    // reaching the duration printed beside it.
    const playhead = computePlayhead(clips, at(2, 0.94), 2, true);
    expect(playhead.elapsedSeconds).toBeCloseTo(3);
    expect(playhead.frameNumber).toBe(playhead.frameTotal);
    expect(playhead.frameTotal).toBe(90);
  });

  it("keeps the scrubber inside its track", () => {
    // The scrubber is a controlled range over [0, frameTotal - 1].
    const first = computePlayhead(clips, at(0, 0), 0, false);
    expect(first.frameNumber).toBe(1);

    const last = computePlayhead(clips, at(2, 1), 2, false);
    expect(last.frameNumber).toBeLessThanOrEqual(last.frameTotal);
  });

  it("clamps a sample that overshoots its own clip", () => {
    // The engine can sample fractionally past a clip's duration before it
    // switches; that time belongs to this clip, not the next one's offset.
    const playhead = computePlayhead(clips, at(1, 1.4), 1, false);
    expect(playhead.elapsedSeconds).toBeCloseTo(2);
    expect(playhead.clipProgress).toBe(1);
  });

  it("falls back to the gesture index until the first sample lands", () => {
    // Between loadSequence and the first throttled push there is no progress at
    // all, and the stage still has to name the sign it is showing.
    expect(computePlayhead(clips, null, 2, false).index).toBe(2);
    expect(computePlayhead(clips, null, 2, false).elapsedSeconds).toBeCloseTo(2);
  });

  it("survives an empty sequence and an out-of-range index", () => {
    expect(computePlayhead([], null, 0, false).frameTotal).toBe(0);
    expect(computePlayhead([], null, 3, true).elapsedSeconds).toBe(0);
    // Clips can shrink under a stale sample while a new translation streams in.
    expect(computePlayhead(clips, at(2, 0.5), 9, false).index).toBe(2);
  });

  it("handles clips of different lengths and frame rates", () => {
    const mixed = [clip(500, 30), clip(2000, 24), clip(1000, 60)];
    const playhead = computePlayhead(mixed, { ...at(1, 1), clipDuration: 2, fps: 24 }, 1, false);
    expect(playhead.totalSeconds).toBeCloseTo(3.5);
    expect(playhead.elapsedSeconds).toBeCloseTo(1.5);
    // 15 frames of clip 0, then 24 into clip 1, 1-based.
    expect(playhead.frameNumber).toBe(15 + 24 + 1);
    expect(playhead.frameTotal).toBe(15 + 48 + 60);
  });
});
