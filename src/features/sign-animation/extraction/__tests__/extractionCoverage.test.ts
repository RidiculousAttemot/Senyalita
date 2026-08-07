import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Extraction must visit every frame of the source, not just the first one.
 *
 * The previous loop played the video and captured from
 * requestVideoFrameCallback, gated on `video.currentTime !== lastCapturedTime`.
 * That made the whole run depend on the element actually advancing. When it
 * did not -- an autoplay policy, an element the caller had paused, a decoder
 * that will not run in the background -- the guard passed exactly once and the
 * extraction "succeeded" with 1 of 189 frames, no error, and a 0ms asset whose
 * only frame was the clip's first (hands not yet raised, so zero hand
 * landmarks). A silent 99.5% data loss reported as success.
 *
 * These tests drive a fake video element, so they assert the property that
 * broke: frame coverage, independent of playback.
 */

const FPS = 30;

/** A video element that only ever moves when someone seeks it. */
function fakeVideo(durationSeconds: number, opts: { failSeekAt?: number[] } = {}) {
  const listeners = new Map<string, Array<() => void>>();
  const el = {
    duration: durationSeconds,
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480,
    _currentTime: 0,
    playCalls: 0,
    seekedTimes: [] as number[],
    get currentTime() {
      return this._currentTime;
    },
    set currentTime(t: number) {
      this._currentTime = t;
      this.seekedTimes.push(t);
      const fail = opts.failSeekAt?.includes(this.seekedTimes.length - 1);
      queueMicrotask(() => {
        for (const fn of listeners.get(fail ? "error" : "seeked") ?? []) fn();
      });
    },
    play() {
      this.playCalls++;
      return Promise.resolve();
    },
    pause() {},
    addEventListener(type: string, fn: () => void) {
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn));
    },
  };
  return el as unknown as HTMLVideoElement & { playCalls: number; seekedTimes: number[] };
}

const detectForVideo = vi.fn();

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  HolisticLandmarker: {
    createFromOptions: vi.fn(async () => ({
      detectForVideo,
      close: vi.fn(),
    })),
  },
}));

// One hand landmark is enough for mapHolisticResultToFrame to keep the frame.
const landmarkSet = () => Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
detectForVideo.mockImplementation(() => ({
  leftHandLandmarks: [landmarkSet()],
  rightHandLandmarks: [],
  poseLandmarks: [],
  faceLandmarks: [],
}));

afterEach(() => {
  detectForVideo.mockClear();
});

describe("extractLandmarksFromVideo frame coverage", () => {
  it("captures every frame of the source, not just the first", async () => {
    const { extractLandmarksFromVideo } = await import("../holisticVideoExtractor");
    const video = fakeVideo(6.3);
    const expected = Math.ceil(6.3 * FPS); // 189

    const result = await extractLandmarksFromVideo(video);

    // The exact regression: this returned 1.
    expect(result.frames.length, "extraction captured fewer frames than the source has").toBe(expected);
    expect(detectForVideo).toHaveBeenCalledTimes(expected);
  });

  it("does not depend on playback to advance the video", async () => {
    const { extractLandmarksFromVideo } = await import("../holisticVideoExtractor");
    const video = fakeVideo(1);

    await extractLandmarksFromVideo(video);

    // Nothing may hinge on play() succeeding -- that dependency is what let an
    // autoplay policy silently truncate the run.
    expect(video.playCalls, "extraction should not require playback").toBe(0);
    expect(video.seekedTimes.length).toBe(FPS);
  });

  it("reports monotonically increasing progress across the whole clip", async () => {
    const { extractLandmarksFromVideo } = await import("../holisticVideoExtractor");
    const video = fakeVideo(2);
    const seen: number[] = [];

    await extractLandmarksFromVideo(video, {}, (p) => seen.push(p.currentFrame));

    expect(seen[0]).toBe(1);
    expect(seen[seen.length - 1]).toBe(Math.ceil(2 * FPS));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it("skips an undecodable frame instead of stopping the run", async () => {
    const { extractLandmarksFromVideo } = await import("../holisticVideoExtractor");
    const video = fakeVideo(1, { failSeekAt: [5, 6] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await extractLandmarksFromVideo(video);

    // Two bad frames must cost two frames, not the other 28.
    expect(result.frames.length).toBe(FPS - 2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("could not be decoded"));
    warn.mockRestore();
  });

  it("never seeks past the end of the media", async () => {
    const { extractLandmarksFromVideo } = await import("../holisticVideoExtractor");
    const video = fakeVideo(1);

    await extractLandmarksFromVideo(video);

    // Seeking exactly to duration lands past the last frame and never fires
    // `seeked` on some decoders, which would hang the final iteration.
    for (const t of video.seekedTimes) expect(t).toBeLessThan(1);
  });
});
