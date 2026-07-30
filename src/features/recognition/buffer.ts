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
 *
 * Alphabet and gesture clips fill that window differently, and the difference
 * is why letters worked while motion signs did not:
 *
 * - Alphabet clips come from static images (originalFrameCount = 1) replicated
 *   across all 120 slots, so a letter is invariant to how long it is held.
 * - Gesture clips are real video, *time-normalised* — a 1.4s clip captured at
 *   30fps is interpolated so the movement spans the whole 120-frame window.
 *
 * Capturing at a true 30fps and zero-padding the tail reproduces the alphabet
 * layout but not the gesture layout: a 42-frame "THANK YOU" lands in slots
 * 0-41 and leaves 78 slots empty, so the model sees the movement at roughly
 * three times the speed it was trained on. Measured against the served model,
 * that drops THANK YOU from 88.3% to 9.0% (predicting DARK).
 *
 * So a gesture span is resampled to span the full window, mirroring training's
 * interpolation. Spans are marked externally by the caller from MotionDetector
 * transitions, because motion has to be measured on raw landmarks — this
 * buffer only ever sees wrist-centred, max-abs scaled features, a space in
 * which a hand travelling across the body registers no movement at all.
 *
 * With no gesture marked the raw window is used unchanged, so the alphabet
 * path is byte-for-byte what it was.
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

/**
 * MotionDetector needs START_FRAMES of movement before it will call a gesture,
 * so onset is already that far behind by the time the caller marks it. Rewind
 * by the same amount rather than clipping the start of the movement.
 */
const GESTURE_ONSET_LOOKBACK = 3;

/**
 * Shortest span still treated as a gesture, from the 5th percentile of gesture
 * durations in the training data (measured over datasets/processed/
 * fsl_unified_v4 test split: min 17, p5 31, median 43, p95 61 frames).
 *
 * It guards the trailing trim. A held letter looks exactly like a gesture that
 * has finished — movement, then stillness — and motion alone cannot tell them
 * apart. Trimming the stillness off a letter removes the letter itself: a
 * 5-frame reach into a 15-frame hold was read as "t" at 12% once its hold was
 * cut, against "b" at 74% with the hold intact. Trimming only while the
 * remainder is still gesture-length keeps both cases right.
 */
const MIN_GESTURE_FRAMES = 31;

type GestureSpan = { start: number; end: number };

export type HandData = {
  landmarks: Array<{ x: number; y: number; z: number }>;
  handedness?: string;
};

export class SequenceBuffer {
  private frames: Float32Array[] = [];
  private gestureStart: number | null = null;
  private completedGesture: GestureSpan | null = null;

  reset(): void {
    this.frames = [];
    this.gestureStart = null;
    this.completedGesture = null;
  }

  append(leftHand: HandData | null, rightHand: HandData | null): void {
    const features = normalizeLandmarks(
      leftHand?.landmarks ?? null,
      rightHand?.landmarks ?? null
    );

    this.frames.push(features);

    if (this.frames.length > SEQUENCE_LENGTH) {
      this.frames.shift();
      // Every marked index refers to a slot that just moved down by one.
      if (this.gestureStart !== null) {
        this.gestureStart = Math.max(0, this.gestureStart - 1);
      }
      if (this.completedGesture !== null) {
        const start = this.completedGesture.start - 1;
        const end = this.completedGesture.end - 1;
        // Once its tail has aged out the span no longer describes a gesture.
        this.completedGesture = end <= 0 ? null : { start: Math.max(0, start), end };
      }
    }
  }

  get length(): number {
    return this.frames.length;
  }

  /** Called when MotionDetector reports idle -> gesturing. */
  markGestureStart(): void {
    this.gestureStart = Math.max(0, this.frames.length - GESTURE_ONSET_LOOKBACK);
    this.completedGesture = null;
  }

  /**
   * Called when MotionDetector reports gesturing -> idle. The detector only
   * declares the end after `trailingIdleFrames` still frames, so those are
   * trimmed back off — left in, they dilute the gesture across the resampled
   * window (GOOD MORNING read as GIRL at 30% untrimmed, 86% trimmed).
   *
   * The trim stops at MIN_GESTURE_FRAMES so it can never eat a held letter.
   */
  markGestureEnd(trailingIdleFrames = 0): void {
    if (this.gestureStart === null) return;

    const span = this.frames.length - this.gestureStart;
    const trim = Math.min(trailingIdleFrames, Math.max(0, span - MIN_GESTURE_FRAMES));

    this.completedGesture = {
      start: this.gestureStart,
      end: this.frames.length - trim,
    };
    this.gestureStart = null;
  }

  /** The span to resample, or null to fall back to the raw capture window. */
  private activeGesture(): GestureSpan | null {
    const span = this.completedGesture
      ?? (this.gestureStart === null
        ? null
        : { start: this.gestureStart, end: this.frames.length });

    if (span === null) return null;
    return span.end - span.start >= MINIMUM_FRAMES ? span : null;
  }

  /**
   * Stretches a captured span across the trained window, so a gesture reaches
   * the model at the temporal scale training interpolated it to. Each trained
   * window index maps proportionally onto the span, which is the same result
   * as resampling the span to SEQUENCE_LENGTH and then reading those indices.
   */
  private resampleGesture({ start, end }: GestureSpan): Float32Array {
    const sampled = new Float32Array(TEMPORAL_STEPS * FEATURE_DIMENSION);
    const span = end - start;

    for (let step = 0; step < TEMPORAL_STEPS; step += 1) {
      const windowIndex = TEMPORAL_FRAME_INDICES[step];
      const offset = span === 1
        ? 0
        : Math.min(
          span - 1,
          Math.round((windowIndex * (span - 1)) / (SEQUENCE_LENGTH - 1)),
        );
      sampled.set(this.frames[start + offset], step * FEATURE_DIMENSION);
    }

    return sampled;
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
    const gesture = this.activeGesture();
    return gesture
      ? this.resampleGesture(gesture)
      : this.sampleAtTrainedIndices();
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
    // full, so callers can weight a prediction made on partial evidence. A
    // gesture still in progress is also partial evidence — its span is
    // stretched to fill the window before the movement has finished.
    const gesture = this.activeGesture();
    return {
      sample: gesture
        ? this.resampleGesture(gesture)
        : this.sampleAtTrainedIndices(),
      usedEarly: this.completedGesture === null
        && this.frames.length < SEQUENCE_LENGTH,
      frameCount: this.frames.length,
    };
  }
}
