import { normalizeLandmarks } from "./normalize";

const SEQUENCE_LENGTH = 30;
const FEATURE_DIMENSION = 126;
const TEMPORAL_STEPS = 30;
const MINIMUM_FRAMES = 5;
const EARLY_MIN_FRAMES = 8;
const EARLY_HIGH_CONFIDENCE = 0.85;

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

  sampleTemporal(): Float32Array | null {
    if (this.frames.length < MINIMUM_FRAMES) {
      return null;
    }

    const available = Math.min(this.frames.length, SEQUENCE_LENGTH);
    const recent = this.frames.slice(-available);
    const sampled = new Float32Array(TEMPORAL_STEPS * FEATURE_DIMENSION);

    for (let step = 0; step < TEMPORAL_STEPS; step += 1) {
      const frameIndex = Math.round(
        (step * (available - 1)) / (TEMPORAL_STEPS - 1)
      );
      const frame = recent[frameIndex];
      const destOffset = step * FEATURE_DIMENSION;
      for (let j = 0; j < FEATURE_DIMENSION; j += 1) {
        sampled[destOffset + j] = frame[j];
      }
    }

    return sampled;
  }

  adaptiveSample(highConfidenceThreshold = EARLY_HIGH_CONFIDENCE): {
    sample: Float32Array | null;
    usedEarly: boolean;
    frameCount: number;
  } {
    if (this.frames.length < MINIMUM_FRAMES) {
      return { sample: null, usedEarly: false, frameCount: this.frames.length };
    }

    const canEarly = this.frames.length >= EARLY_MIN_FRAMES;
    if (!canEarly) {
      return {
        sample: this.sampleTemporal(),
        usedEarly: false,
        frameCount: this.frames.length,
      };
    }

    const available = Math.min(this.frames.length, SEQUENCE_LENGTH);
    const recent = this.frames.slice(-available);
    const sampled = new Float32Array(TEMPORAL_STEPS * FEATURE_DIMENSION);

    for (let step = 0; step < TEMPORAL_STEPS; step += 1) {
      const frameIndex = Math.round(
        (step * (available - 1)) / (TEMPORAL_STEPS - 1)
      );
      const frame = recent[frameIndex];
      const destOffset = step * FEATURE_DIMENSION;
      for (let j = 0; j < FEATURE_DIMENSION; j += 1) {
        sampled[destOffset + j] = frame[j];
      }
    }

    return { sample: sampled, usedEarly: available < SEQUENCE_LENGTH, frameCount: available };
  }
}
