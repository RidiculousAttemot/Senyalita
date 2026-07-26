import { describe, it, expect } from "vitest";
// Imported rather than duplicated: local copies of these went stale twice —
// once at 30 and again at 45. temporalAlignment.test.ts checks the exported
// values against the model config itself.
import {
  SequenceBuffer,
  SEQUENCE_LENGTH,
  FEATURE_DIMENSION,
  TEMPORAL_STEPS,
  type HandData,
} from "../buffer";

const makeHand = (wristX: number, wristY: number, wristZ: number): HandData => ({
  landmarks: Array.from({ length: 21 }, (_, i) => ({
    x: wristX + i * 0.01,
    y: wristY + i * 0.01,
    z: wristZ + i * 0.01
  }))
});

describe("SequenceBuffer", () => {
  it("starts empty", () => {
    const buffer = new SequenceBuffer();
    expect(buffer.length).toBe(0);
    expect(buffer.sampleTemporal()).toBeNull();
  });

  it("rejects sampling below the minimum frame threshold", () => {
    const buffer = new SequenceBuffer();
    for (let i = 0; i < 4; i += 1) {
      buffer.append(makeHand(0.1, 0.2, 0.3), null);
    }
    expect(buffer.length).toBe(4);
    expect(buffer.sampleTemporal()).toBeNull();
  });

  it("returns a TEMPORAL_STEPS*126 float array once minimum frames are met", () => {
    const buffer = new SequenceBuffer();
    for (let i = 0; i < 5; i += 1) {
      buffer.append(makeHand(0.1, 0.2, 0.3), null);
    }
    const out = buffer.sampleTemporal();
    expect(out).not.toBeNull();
    expect(out?.length).toBe(TEMPORAL_STEPS * FEATURE_DIMENSION);
  });

  it("returns TEMPORAL_STEPS*126 even when more frames are available", () => {
    const buffer = new SequenceBuffer();
    for (let i = 0; i < 30; i += 1) {
      buffer.append(makeHand(0.1, 0.2, 0.3), null);
    }
    const out = buffer.sampleTemporal();
    expect(out).not.toBeNull();
    expect(out?.length).toBe(TEMPORAL_STEPS * FEATURE_DIMENSION);
  });

  it("caps the internal frame queue at SEQUENCE_LENGTH", () => {
    const buffer = new SequenceBuffer();
    for (let i = 0; i < SEQUENCE_LENGTH + 50; i += 1) {
      buffer.append(makeHand(0.1, 0.2, 0.3), null);
    }
    expect(buffer.length).toBe(SEQUENCE_LENGTH);
  });

  it("treats null hands as zeros in the feature vector", () => {
    const buffer = new SequenceBuffer();
    for (let i = 0; i < 10; i += 1) {
      buffer.append(null, null);
    }
    const out = buffer.sampleTemporal();
    expect(out).not.toBeNull();
    expect(out!.every((v) => v === 0)).toBe(true);
  });

  it("resets the buffer", () => {
    const buffer = new SequenceBuffer();
    buffer.append(makeHand(0.1, 0.2, 0.3), null);
    expect(buffer.length).toBe(1);
    buffer.reset();
    expect(buffer.length).toBe(0);
  });
});
