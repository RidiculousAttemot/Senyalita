import { describe, expect, it } from "vitest";
import {
  createGestureAnimationAsset,
  mapHolisticResultToFrame,
  normalizeFrameSequence,
  repairMissingFrames,
} from "../landmarkAssetProcessing";

describe("repairMissingFrames", () => {
  it("fills a missing hand frame from its nearest valid neighbor", () => {
    const frames = [
      { timestamp: 0, landmarks: [{ landmarks: [{ x: 0.2, y: 0.4, z: 0 }] }] },
      { timestamp: 33, landmarks: [] },
      { timestamp: 66, landmarks: [{ landmarks: [{ x: 0.6, y: 0.8, z: 0 }] }] },
    ];

    const repaired = repairMissingFrames(frames);

    expect(repaired[1].landmarks).toEqual(frames[0].landmarks);
  });

  it("retains hand identity and complete landmarks while repairing a missing frame", () => {
    const frames = [
      {
        timestamp: 0,
        landmarks: [{ landmarks: [{ x: 0.2, y: 0.4, z: 0 }], side: "right" as const }],
        poseLandmarks: [{ x: 0.3, y: 0.4, z: 0 }],
        faceLandmarks: [{ x: 0.4, y: 0.5, z: 0 }],
      },
      { timestamp: 33, landmarks: [] },
    ];

    const repaired = repairMissingFrames(frames);

    expect(repaired[1].landmarks[0].side).toBe("right");
    expect(repaired[1].poseLandmarks).toEqual(frames[0].poseLandmarks);
    expect(repaired[1].faceLandmarks).toEqual(frames[0].faceLandmarks);
  });
});

describe("mapHolisticResultToFrame", () => {
  it("preserves extracted pose, face, left hand, and right hand landmarks", () => {
    const frame = mapHolisticResultToFrame({
      faceLandmarks: [[{ x: 0.1, y: 0.2, z: 0 }]],
      leftHandLandmarks: [[{ x: 0.2, y: 0.3, z: 0 }]],
      poseLandmarks: [[{ x: 0.3, y: 0.4, z: 0 }]],
      rightHandLandmarks: [[{ x: 0.4, y: 0.5, z: 0 }]],
    }, 120);

    expect(frame.timestamp).toBe(120);
    expect(frame.poseLandmarks).toHaveLength(1);
    expect(frame.faceLandmarks).toHaveLength(1);
    expect(frame.landmarks).toHaveLength(2);
    expect(frame.landmarks.map((hand) => hand.side)).toEqual(["left", "right"]);
  });

  it("preserves a right-only hand as right-handed", () => {
    const frame = mapHolisticResultToFrame({
      faceLandmarks: [],
      leftHandLandmarks: [],
      poseLandmarks: [],
      rightHandLandmarks: [[{ x: 0.4, y: 0.5, z: 0 }]],
    }, 120);

    expect(frame.landmarks).toEqual([{ landmarks: [{ x: 0.4, y: 0.5, z: 0 }], side: "right" }]);
  });
});

describe("normalizeFrameSequence", () => {
  it("resamples frames onto a stable target FPS timeline", () => {
    const frames = [
      { timestamp: 0, landmarks: [{ landmarks: [{ x: 0.1, y: 0.1, z: 0 }] }] },
      { timestamp: 100, landmarks: [{ landmarks: [{ x: 0.9, y: 0.9, z: 0 }] }] },
    ];

    const normalized = normalizeFrameSequence(frames, 20);

    expect(normalized.map((frame) => frame.timestamp)).toEqual([0, 50, 100]);
    expect(normalized).toHaveLength(3);
  });
});

describe("createGestureAnimationAsset", () => {
  it("creates a versioned asset with repaired, FPS-normalized frames", () => {
    // Normalisation is the caller's step, not the factory's — both production
    // call sites (landmarkProcessor, VideoUploadTab) normalise first and then
    // construct. Mirroring that here keeps the test on the real contract.
    const normalized = normalizeFrameSequence(
      [
        { timestamp: 0, landmarks: [{ landmarks: [{ x: 0.1, y: 0.1, z: 0 }] }] },
        { timestamp: 100, landmarks: [{ landmarks: [{ x: 0.9, y: 0.9, z: 0 }] }] },
      ],
      20,
    );

    const asset = createGestureAnimationAsset({
      label: "HELLO",
      frames: normalized,
      fps: 20,
      source: "landmark-video-extraction",
    });

    expect(asset).toMatchObject({
      label: "HELLO",
      fps: 20,
      // Milliseconds: every consumer divides by 1000, and the animation-assets
      // API persists this straight into `duration_ms`.
      duration: 100,
      totalFrames: 3,
      metadata: { source: "landmark-video-extraction", version: 1 },
    });
  });
});