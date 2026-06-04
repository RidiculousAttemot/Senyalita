import { normalizeLandmarks } from "./normalize";

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const TEMPORAL_STEPS = 30;

export type HandData = {
  landmarks: Array<{ x: number; y: number; z: number }>;
  handedness?: string;
};

export class SequenceBuffer {
  private frames: Float32Array[] = [];

  reset(): void {
    this.frames = [];
  }

  append(leftHand: HandData | null, rightHand: HandData | null): void {
    const features = normalizeLandmarks(
      leftHand?.landmarks ?? null,
      rightHand?.landmarks ?? null
    );

    this.frames.push(features);

    if (this.frames.length > SEQUENCE_LENGTH) {
      this.frames.shift();
    }
  }

  get length(): number {
    return this.frames.length;
  }

  get isFull(): boolean {
    return this.frames.length >= SEQUENCE_LENGTH;
  }

  get progress(): number {
    return Math.min(this.frames.length, SEQUENCE_LENGTH);
  }

  sampleTemporal(): Float32Array | null {
    if (this.frames.length < SEQUENCE_LENGTH) {
      return null;
    }

    const recent = this.frames.slice(-SEQUENCE_LENGTH);
    const sampled = new Float32Array(TEMPORAL_STEPS * FEATURE_DIMENSION);

    for (let step = 0; step < TEMPORAL_STEPS; step += 1) {
      const frameIndex = Math.round(
        (step * (SEQUENCE_LENGTH - 1)) / (TEMPORAL_STEPS - 1)
      );
      const frame = recent[frameIndex];
      const destOffset = step * FEATURE_DIMENSION;
      for (let j = 0; j < FEATURE_DIMENSION; j += 1) {
        sampled[destOffset + j] = frame[j];
      }
    }

    return sampled;
  }
}
