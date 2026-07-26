import { describe, expect, it } from "vitest";
import { measureAssetAccuracy, projectLandmark } from "../landmarkAccuracy";
import type { AnimationFrame, GestureAnimationAsset, LandmarkPoint } from "../../types";

const IMAGE_W = 1920;
const IMAGE_H = 1080;

function point(x: number, y: number): LandmarkPoint {
  return { x, y, z: 0 };
}

// 0.02 normalised units per frame is roughly how far a hand travels between
// frames at 30fps, i.e. ~21px on a 1080-tall source.
function frame(offset: number): AnimationFrame {
  return {
    timestamp: offset,
    poseLandmarks: Array.from({ length: 33 }, (_, i) => point(0.2 + i * 0.01, 0.3 + offset * 0.02)),
    faceLandmarks: Array.from({ length: 5 }, (_, i) => point(0.45 + i * 0.002, 0.2)),
    landmarks: [
      { side: "left", landmarks: Array.from({ length: 21 }, (_, i) => point(0.6 + i * 0.005, 0.5)) },
    ],
  };
}

function asset(frames: AnimationFrame[]): GestureAnimationAsset {
  return {
    label: "TEST",
    language: "FSL",
    fps: 30,
    duration: (frames.length / 30) * 1000,
    totalFrames: frames.length,
    frames,
    imageWidth: IMAGE_W,
    imageHeight: IMAGE_H,
    metadata: { featureDimension: 3, sequenceLength: frames.length, version: 1 },
  };
}

describe("projectLandmark", () => {
  it("preserves aspect ratio with a single uniform scale", () => {
    const p = { canvasWidth: 640, canvasHeight: 640, imageWidth: IMAGE_W, imageHeight: IMAGE_H };
    // A square in source pixels must stay square on canvas.
    const a = projectLandmark(point(0.25, 0.25), p);
    const b = projectLandmark(point(0.75, 0.25), p);
    const c = projectLandmark(point(0.25, 0.25 + (0.5 * IMAGE_W) / IMAGE_H), p);

    const widthPx = b.x - a.x;
    const heightPx = c.y - a.y;
    expect(widthPx).toBeCloseTo(heightPx, 6);
  });

  it("letterboxes rather than stretching a 16:9 source into a square stage", () => {
    const p = { canvasWidth: 640, canvasHeight: 640, imageWidth: IMAGE_W, imageHeight: IMAGE_H };
    const topLeft = projectLandmark(point(0, 0), p);
    const bottomRight = projectLandmark(point(1, 1), p);

    expect(topLeft.x).toBeCloseTo(0, 6);
    expect(bottomRight.x).toBeCloseTo(640, 6);
    // Vertical bands, content vertically centred.
    expect(topLeft.y).toBeGreaterThan(0);
    expect(bottomRight.y).toBeLessThan(640);
    expect(topLeft.y).toBeCloseTo(640 - bottomRight.y, 6);
  });

  it("keeps a landmark off the left edge off the left edge", () => {
    const p = { canvasWidth: 640, canvasHeight: 360, imageWidth: IMAGE_W, imageHeight: IMAGE_H };
    // Original framing is preserved: out-of-frame stays out of frame.
    expect(projectLandmark(point(-0.05, 0.5), p).x).toBeLessThan(0);
    expect(projectLandmark(point(1.05, 0.5), p).x).toBeGreaterThan(640);
  });
});

describe("measureAssetAccuracy", () => {
  it("reports zero error when playback replays the extracted frames verbatim", () => {
    const frames = [frame(0), frame(1), frame(2)];
    const report = measureAssetAccuracy(asset(frames), frames, 628, 785);

    expect(report.averageJointErrorPx).toBe(0);
    expect(report.maxJointErrorPx).toBe(0);
    expect(report.playbackDriftFrames).toBe(0);
    expect(report.passed).toBe(true);
    expect(report.totalJointsCompared).toBe(3 * (33 + 5 + 21));
  });

  it("fails when playback interpolates between frames", () => {
    const frames = [frame(0), frame(1), frame(2)];
    const midpoint: AnimationFrame = {
      timestamp: 0.5,
      poseLandmarks: frames[0].poseLandmarks!.map((p, i) => ({
        x: (p.x + frames[1].poseLandmarks![i].x) / 2,
        y: (p.y + frames[1].poseLandmarks![i].y) / 2,
        z: 0,
      })),
      faceLandmarks: frames[0].faceLandmarks,
      landmarks: frames[0].landmarks,
    };
    const report = measureAssetAccuracy(asset(frames), [frames[0], midpoint, frames[2]], 628, 785);

    expect(report.averageJointErrorPx).toBeGreaterThan(0);
    expect(report.passed).toBe(false);
    expect(report.worstFrameIndex).toBe(1);
  });

  it("flags dropped frames as playback drift", () => {
    const frames = [frame(0), frame(1), frame(2), frame(3)];
    const report = measureAssetAccuracy(asset(frames), frames.slice(0, 3), 628, 785);

    expect(report.playbackDriftFrames).toBe(-1);
    expect(report.passed).toBe(false);
  });
});
