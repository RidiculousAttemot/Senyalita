import { describe, it, expect } from "vitest";
import { SequenceBuffer, type HandData } from "../buffer";

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

  it("returns a 30*126 float array once minimum frames are met", () => {
    const buffer = new SequenceBuffer();
    for (let i = 0; i < 5; i += 1) {
      buffer.append(makeHand(0.1, 0.2, 0.3), null);
    }
    const out = buffer.sampleTemporal();
    expect(out).not.toBeNull();
    expect(out?.length).toBe(30 * 126);
  });

  it("returns 30*126 even when more frames are available", () => {
    const buffer = new SequenceBuffer();
    for (let i = 0; i < 30; i += 1) {
      buffer.append(makeHand(0.1, 0.2, 0.3), null);
    }
    const out = buffer.sampleTemporal();
    expect(out).not.toBeNull();
    expect(out?.length).toBe(30 * 126);
  });

  it("caps the internal frame queue at SEQUENCE_LENGTH", () => {
    const buffer = new SequenceBuffer();
    for (let i = 0; i < 100; i += 1) {
      buffer.append(makeHand(0.1, 0.2, 0.3), null);
    }
    expect(buffer.length).toBe(30);
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
