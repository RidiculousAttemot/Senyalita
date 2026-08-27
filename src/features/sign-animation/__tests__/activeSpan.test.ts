import { describe, expect, it } from "vitest";
import { activeSpan, trimToActiveSpan } from "../activeSpan";
import type { AnimationFrame, GestureAnimationAsset } from "../types";

/**
 * Built rather than fetched, so the thresholds are exercised at known values.
 * The real assets these numbers came from are measured in the script that
 * produced them; what matters here is the shape of the decision.
 */
const point = (x: number, y: number) => ({ x, y, z: 0 });

/** A frame whose tracked pose points all sit at the same offset. */
function frameAt(offset: number, index: number): AnimationFrame {
  const pose = Array.from({ length: 33 }, () => point(0.5, 0.5));
  // 11..16 are the tracked points; move them together.
  for (const i of [11, 12, 13, 14, 15, 16]) pose[i] = point(0.5 + offset, 0.5 + offset);
  return { timestamp: index * (1000 / 30), landmarks: [], poseLandmarks: pose };
}

/** still frames, then moving frames, then still frames. */
function clip(lead: number, moving: number, trail: number): AnimationFrame[] {
  const frames: AnimationFrame[] = [];
  let i = 0;
  for (let n = 0; n < lead; n++) frames.push(frameAt(0, i++));
  for (let n = 0; n < moving; n++) frames.push(frameAt((n + 1) * 0.02, i++));
  const held = moving * 0.02;
  for (let n = 0; n < trail; n++) frames.push(frameAt(held, i++));
  return frames;
}

const asset = (frames: AnimationFrame[]): GestureAnimationAsset => ({
  label: "TEST",
  language: "fsl",
  fps: 30,
  duration: (frames.length / 30) * 1000,
  totalFrames: frames.length,
  frames,
  metadata: { featureDimension: 3, sequenceLength: frames.length, version: 1 },
});

describe("activeSpan", () => {
  it("finds the moving stretch and drops the rest at both ends", () => {
    const span = activeSpan(clip(12, 60, 12));
    expect(span.trimmed).toBe(true);
    // Lead and trail margins are kept deliberately, so this is a window around
    // the movement rather than an exact boundary.
    expect(span.start).toBeGreaterThan(3);
    expect(span.start).toBeLessThan(14);
    expect(span.end).toBeGreaterThan(66);
    expect(span.end).toBeLessThan(80);
  });

  it("returns the whole clip when nothing moves", () => {
    // The failure that matters: a still clip must not trim to nothing and
    // leave the panel with no frames to draw.
    const frames = clip(60, 0, 0);
    const span = activeSpan(frames);
    expect(span).toEqual({ start: 0, end: frames.length - 1, trimmed: false });
  });

  it("returns the whole clip when it is too short to judge", () => {
    const frames = clip(2, 4, 2);
    expect(activeSpan(frames).trimmed).toBe(false);
  });

  it("keeps a clip that moves from its first frame to its last", () => {
    const span = activeSpan(clip(0, 80, 0));
    expect(span.start).toBe(0);
    expect(span.end).toBe(79);
  });

  it("refuses to trim a held handshape down to the moment it is lowered", () => {
    /**
     * The alphabet, and the reason there is a floor at all.
     *
     * A letter is a static handshape: the signer holds it, so pose velocity
     * reads the whole sign as idle and the only movement is the arm coming
     * down at the end. Surveyed across all 130 published assets, the detector
     * kept 15 of R's 214 frames -- it threw the letter away and kept the exit.
     *
     * Six word signs were not enough to see this; every one of them moved.
     */
    const frames = clip(180, 25, 0);
    const span = activeSpan(frames);
    expect(span.trimmed, "a held sign must be left alone, not cut to its exit").toBe(false);
    expect(span.start).toBe(0);
    expect(span.end).toBe(frames.length - 1);
  });

  it("never retains less than the floor, whatever the velocity profile", () => {
    // The property, rather than one shape of clip: whenever it does trim, what
    // survives is most of the clip. A future asset with an unusual profile
    // cannot be trimmed into nothing without this failing.
    for (const [lead, moving, trail] of [
      [180, 25, 0], [200, 20, 0], [98, 60, 6], [40, 60, 40], [12, 100, 12], [0, 90, 0],
    ] as Array<[number, number, number]>) {
      const frames = clip(lead, moving, trail);
      const span = activeSpan(frames);
      const retained = (span.end - span.start + 1) / frames.length;
      expect(retained, `clip(${lead},${moving},${trail}) retained ${(retained * 100).toFixed(1)}%`)
        .toBeGreaterThanOrEqual(0.65);
    }
  });
});

describe("trimToActiveSpan", () => {
  it("moves totalFrames and duration together", () => {
    // PlaybackEngine indexes by proportion of duration, so if these disagree
    // the sign plays at the wrong rate rather than failing visibly.
    const trimmed = trimToActiveSpan(asset(clip(12, 60, 12)));
    expect(trimmed.totalFrames).toBe(trimmed.frames.length);
    expect(trimmed.duration).toBeCloseTo((trimmed.frames.length / 30) * 1000, 5);
    expect(trimmed.totalFrames).toBeLessThan(84);
  });

  it("rebases timestamps to zero", () => {
    expect(trimToActiveSpan(asset(clip(12, 60, 12))).frames[0].timestamp).toBe(0);
  });

  it("advances sourceOffsetSeconds by the frames it removed", () => {
    // Overlay and Human modes seek the recording to this offset. Trimming the
    // front without moving it would desync the skeleton from the video.
    const original = asset(clip(12, 60, 12));
    const trimmed = trimToActiveSpan(original);
    const dropped = trimmed.trim!.startFrame;
    expect(trimmed.sourceOffsetSeconds).toBeCloseTo(dropped / 30, 6);
  });

  it("does not mutate the asset it was given", () => {
    // The loader caches by gloss and hands the same object to every caller;
    // trimming in place would trim the translator's copy too.
    const original = asset(clip(12, 60, 12));
    const before = original.frames.length;
    trimToActiveSpan(original);
    expect(original.frames.length).toBe(before);
    expect(original.totalFrames).toBe(before);
    expect(original.trim).toBeUndefined();
  });

  it("returns the very same object when there is nothing to cut", () => {
    // Callers apply this unconditionally, so the no-op case must be free.
    const original = asset(clip(0, 80, 0));
    expect(trimToActiveSpan(original)).toBe(original);
  });
});
