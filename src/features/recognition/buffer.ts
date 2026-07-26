import { normalizeLandmarks } from "./normalize";

/**
 * Runtime must mirror the training pipeline or the model sees a distribution
 * it was never fitted on. Training (scripts/build-unified-dataset-v4.mjs)
 * pads or truncates each clip to a 120-frame window, then the model consumes
 * 35 frames drawn at fixed indices from that window
 * (models/fsl_unified/bilstm_v4/config.json →
 * architecture.recurrentLayers[0].temporalFrameIndices).
 *
 * The previous 45-frame rolling window with evenly-spaced sampling compressed
 * a ~4 second gesture into ~1.5 seconds of captured motion.
 */
export const SEQUENCE_LENGTH = 120;
export const FEATURE_DIMENSION = 126;
export const TEMPORAL_STEPS = 35;

/**
 * Verbatim from bilstm_v4 config. `temporalFrameIndices.test.ts` asserts this
 * still matches the model config, so retraining cannot silently desync them.
 */
export const TEMPORAL_FRAME_INDICES = [
  0, 4, 7, 11, 14, 18, 21, 25, 28, 32, 35, 39, 42, 46, 49, 53, 56, 60,
  63, 67, 70, 74, 77, 81, 84, 88, 91, 95, 98, 102, 105, 109, 112, 116, 119,
] as const;

export const MINIMUM_FRAMES = 5;
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

  /**
   * Reads the trained indices out of a 120-slot window whose leading slots hold
   * the captured frames and whose tail is zero — the same layout training used
   * when it padded short clips.
   */
  private sampleAtTrainedIndices(): Float32Array {
    const sampled = new Float32Array(TEMPORAL_STEPS * FEATURE_DIMENSION);

    for (let step = 0; step < TEMPORAL_STEPS; step += 1) {
      const sourceIndex = TEMPORAL_FRAME_INDICES[step];
      const frame = this.frames[sourceIndex];
      // Past the captured frames the slot stays zero, matching the tail
      // padding applied to short training clips.
      if (!frame) continue;
      sampled.set(frame, step * FEATURE_DIMENSION);
    }

    return sampled;
  }

  sampleTemporal(): Float32Array | null {
    if (this.frames.length < MINIMUM_FRAMES) {
      return null;
    }
    return this.sampleAtTrainedIndices();
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

    // Same layout either way; "early" only reports that the window is not yet
    // full, so callers can weight a prediction made on partial evidence.
    return {
      sample: this.sampleAtTrainedIndices(),
      usedEarly: this.frames.length < SEQUENCE_LENGTH,
      frameCount: this.frames.length,
    };
  }
}
