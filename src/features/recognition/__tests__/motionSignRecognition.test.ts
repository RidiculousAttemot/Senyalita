import { readFileSync } from "node:fs";
import path from "node:path";
import * as tf from "@tensorflow/tfjs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  SequenceBuffer,
  FEATURE_DIMENSION,
  TEMPORAL_STEPS,
  TEMPORAL_FRAME_INDICES,
  SEQUENCE_LENGTH,
  type HandData,
} from "../buffer";
import { IDLE_FRAMES } from "../motionDetection";

/**
 * Drives the *served* model with real landmark sequences from the dataset, so a
 * motion sign can be exercised without a camera.
 *
 * The alphabet path and the gesture path diverge here for a structural reason:
 * alphabet training clips come from static images (originalFrameCount = 1)
 * replicated across the whole 120-frame window, so a letter is scale-invariant
 * in time. Gesture clips are real video, time-normalised so the movement spans
 * all 120 frames. SequenceBuffer captures at a true 30fps and zero-pads the
 * tail, which reproduces the alphabet layout but *not* the gesture layout.
 */

const MODEL_DIR = path.join(
  process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs",
);
const FIXTURE = path.join(__dirname, "fixtures", "motionSigns.json");

type Sample = {
  label: string;
  labelId: number;
  capturedFrames: number;
  approxDurationSeconds: number;
  trainingWindow: number[][];
  capturedSequence: number[][];
};

const fixture: { samples: Sample[] } = JSON.parse(readFileSync(FIXTURE, "utf-8"));
const labels: string[] = JSON.parse(
  readFileSync(path.join(MODEL_DIR, "labels.json"), "utf-8"),
).labels;

let model: tf.LayersModel;

beforeAll(async () => {
  await tf.setBackend("cpu");
  const artifact = JSON.parse(readFileSync(path.join(MODEL_DIR, "model.json"), "utf-8"));
  const weights = readFileSync(path.join(MODEL_DIR, "weights.bin"));
  model = await tf.loadLayersModel({
    load: async () => ({
      modelTopology: JSON.parse(artifact.modelTopology),
      weightSpecs: artifact.weightsManifest[0].weights,
      weightData: weights.buffer.slice(
        weights.byteOffset, weights.byteOffset + weights.byteLength,
      ),
      format: "layers-model",
    }),
  });
}, 60_000);

type Prediction = { label: string; confidence: number };

/** Runs the served model over an already-sampled [35 x 126] tensor. */
const predictFromSample = (sample: Float32Array): Prediction => {
  const input = tf.tensor3d(sample, [1, TEMPORAL_STEPS, FEATURE_DIMENSION]);
  const output = model.predict(input) as tf.Tensor;
  const probabilities = output.dataSync();
  input.dispose();
  output.dispose();

  let best = 0;
  for (let i = 1; i < probabilities.length; i += 1) {
    if (probabilities[i] > probabilities[best]) best = i;
  }
  return { label: labels[best], confidence: probabilities[best] };
};

/** Reads the trained indices out of a full 120-frame window. */
const sampleWindow = (window: number[][]): Float32Array => {
  const flat = new Float32Array(TEMPORAL_STEPS * FEATURE_DIMENSION);
  for (let step = 0; step < TEMPORAL_STEPS; step += 1) {
    const frame = window[TEMPORAL_FRAME_INDICES[step]];
    if (frame) flat.set(frame, step * FEATURE_DIMENSION);
  }
  return flat;
};

/**
 * Splits a stored 126-feature frame back into the two hands the buffer expects.
 * Stored features are already wrist-centred and max-abs scaled, so pushing them
 * through normalizeLandmarks() is a no-op and the buffer sees them unchanged.
 */
const toHands = (frame: number[]): [HandData, HandData] => {
  const hand = (offset: number): HandData => ({
    landmarks: Array.from({ length: 21 }, (_, i) => ({
      x: frame[offset + i * 3],
      y: frame[offset + i * 3 + 1],
      z: frame[offset + i * 3 + 2],
    })),
  });
  return [hand(0), hand(63)];
};

/**
 * Replays captured frames through the production buffer.
 *
 * `segment` mirrors what useRecognition does with MotionDetector transitions:
 * mark the span on idle -> gesturing and close it on gesturing -> idle. Motion
 * itself cannot be detected here — the fixture holds wrist-centred features, and
 * MotionDetector needs raw landmarks — so the boundaries are marked directly.
 *
 * `idlePadding` frames of a still hand are added on both sides, standing in for
 * a camera that has been running before and after the sign.
 */
const replayThroughBuffer = (
  frames: number[][],
  { segment = false, idlePadding = 0 }: { segment?: boolean; idlePadding?: number } = {},
): Float32Array => {
  const buffer = new SequenceBuffer();
  const append = (frame: number[]) => {
    const [left, right] = toHands(frame);
    buffer.append(left, right);
  };

  for (let i = 0; i < idlePadding; i += 1) append(frames[0]);
  if (segment) buffer.markGestureStart();
  for (const frame of frames) append(frame);
  for (let i = 0; i < idlePadding; i += 1) append(frames[frames.length - 1]);
  // The detector only calls the end after IDLE_FRAMES of stillness, so the
  // trailing idle it reports is what the buffer is told to trim.
  if (segment) buffer.markGestureEnd(idlePadding);

  const sample = buffer.sampleTemporal();
  if (!sample) throw new Error("buffer produced no sample");
  return sample;
};

const find = (label: string) => {
  const sample = fixture.samples.find((s) => s.label === label);
  if (!sample) throw new Error(`fixture missing ${label}`);
  return sample;
};

const gestures = () => fixture.samples.filter((s) => s.capturedFrames > 1);

describe("motion sign recognition", () => {
  it("replays stored features through the buffer without distorting hand shape", () => {
    const frame = find("THANK YOU").capturedSequence[10];
    const buffer = new SequenceBuffer();
    // MINIMUM_FRAMES must be met before the buffer will emit a sample.
    for (let i = 0; i < 5; i += 1) {
      const [left, right] = toHands(frame);
      buffer.append(left, right);
    }

    // Step 0 reads frame 0 — the frame just appended.
    const roundTripped = Array.from(
      buffer.sampleTemporal()!.slice(0, FEATURE_DIMENSION),
    );

    // Training and runtime both wrist-centre then divide by per-hand max-abs
    // (scripts/extract-fsl-105-landmarks.mjs normalizeHand). Stored features are
    // already in that form, so replay reproduces them up to a single positive
    // scale per hand — augmented samples were scaled after normalisation and so
    // come back renormalised to max-abs 1.
    for (const offset of [0, 63]) {
      const source = frame.slice(offset, offset + 63);
      const replayed = roundTripped.slice(offset, offset + 63);
      const sourceMax = Math.max(...source.map(Math.abs));
      if (sourceMax === 0) {
        expect(replayed.every((v) => v === 0)).toBe(true);
        continue;
      }
      expect(Math.max(...replayed.map(Math.abs))).toBeCloseTo(1, 4);
      replayed.forEach((value, i) => {
        expect(value).toBeCloseTo(source[i] / sourceMax, 4);
      });
    }
  });

  // ---- Controls: the model and the fixture are sound ----

  it("recognises every fixture gesture from the training-shaped window", () => {
    for (const sample of gestures()) {
      const prediction = predictFromSample(sampleWindow(sample.trainingWindow));
      expect(
        prediction.label,
        `${sample.label} from its time-normalised window`,
      ).toBe(sample.label);
      expect(prediction.confidence).toBeGreaterThan(0.5);
    }
  });

  // ---- Regression guard: the working A-Z path must not break ----

  it("recognises a held letter through the live buffer", () => {
    const letter = find("b");
    // Holding a letter still for a second is 30 identical captured frames.
    const held = Array.from({ length: 30 }, () => letter.capturedSequence[0]);
    const prediction = predictFromSample(replayThroughBuffer(held));

    expect(prediction.label).toBe("b");
    expect(prediction.confidence).toBeGreaterThan(0.5);
  });

  it("still recognises a letter when reaching into it marks a gesture", () => {
    // MotionDetector cannot tell a held letter from a finished gesture: both
    // are movement then stillness. So reaching into a letter marks a span, and
    // that span must not have the letter trimmed off the end of it.
    const target = find("b").capturedSequence[0];
    const origin = find("THANK YOU").capturedSequence[0];
    const failures: string[] = [];

    for (const leadIn of [5, 10, 20]) {
      for (const hold of [15, 30, 60]) {
        const frames: number[][] = [];
        for (let i = 0; i < leadIn; i += 1) {
          const t = i / leadIn;
          frames.push(origin.map((v, k) => v * (1 - t) + target[k] * t));
        }
        for (let i = 0; i < hold; i += 1) frames.push(target);

        const buffer = new SequenceBuffer();
        buffer.markGestureStart();
        for (const frame of frames) {
          const [left, right] = toHands(frame);
          buffer.append(left, right);
        }
        buffer.markGestureEnd(IDLE_FRAMES);

        const prediction = predictFromSample(buffer.sampleTemporal()!);
        if (prediction.label !== "b") {
          failures.push(
            `leadIn=${leadIn} hold=${hold} -> ${prediction.label} `
            + `@ ${(prediction.confidence * 100).toFixed(1)}%`,
          );
        }
      }
    }

    expect(failures, `Letters lost to gesture trimming:\n  ${failures.join("\n  ")}`)
      .toEqual([]);
  });

  // ---- The fix: a marked gesture span is stretched to the trained scale ----

  it("recognises a motion sign captured at 30fps once its span is marked", () => {
    const failures: string[] = [];

    for (const sample of gestures()) {
      const prediction = predictFromSample(
        replayThroughBuffer(sample.capturedSequence, { segment: true }),
      );
      if (prediction.label !== sample.label || prediction.confidence < 0.5) {
        failures.push(
          `${sample.label} (${sample.capturedFrames} frames, `
          + `${sample.approxDurationSeconds}s) -> ${prediction.label} `
          + `@ ${(prediction.confidence * 100).toFixed(1)}%`,
        );
      }
    }

    expect(failures, `Marked gesture spans still misread:\n  ${failures.join("\n  ")}`)
      .toEqual([]);
  });

  it("recognises a motion sign surrounded by idle camera frames", () => {
    const failures: string[] = [];

    for (const sample of gestures()) {
      const prediction = predictFromSample(
        replayThroughBuffer(sample.capturedSequence, { segment: true, idlePadding: 20 }),
      );
      if (prediction.label !== sample.label || prediction.confidence < 0.5) {
        failures.push(
          `${sample.label} -> ${prediction.label} `
          + `@ ${(prediction.confidence * 100).toFixed(1)}%`,
        );
      }
    }

    expect(failures, `Idle-padded gestures still misread:\n  ${failures.join("\n  ")}`)
      .toEqual([]);
  });

  // ---- Why the marking is load-bearing, not decoration ----

  it("loses motion signs when the span is left unmarked", () => {
    const confidences = gestures().map((sample) => {
      const prediction = predictFromSample(
        replayThroughBuffer(sample.capturedSequence),
      );
      return { label: sample.label, prediction };
    });

    // Unmarked, the gesture occupies only its captured frames and the rest of
    // the window is zero — the model sees roughly 3x the trained speed.
    for (const { label, prediction } of confidences) {
      expect(
        prediction.confidence,
        `${label} unmarked reached ${(prediction.confidence * 100).toFixed(1)}% — `
        + `if this is now high, the raw window no longer needs a marked span and `
        + `the segmentation in useRecognition can be reconsidered`,
      ).toBeLessThan(0.5);
    }
    expect(confidences).toHaveLength(4);
  });

  it("leaves the raw capture window untouched when no gesture is marked", () => {
    const buffer = new SequenceBuffer();
    const frames = find("THANK YOU").capturedSequence;
    for (const frame of frames) {
      const [left, right] = toHands(frame);
      buffer.append(left, right);
    }

    // Trained index 0..39 fall inside the captured frames; the rest are past
    // them and must still read as the zero tail training padded short clips to.
    const sample = buffer.sampleTemporal()!;
    const firstEmptyStep = TEMPORAL_FRAME_INDICES.findIndex((i) => i >= frames.length);
    expect(firstEmptyStep).toBeGreaterThan(0);
    expect(
      sample.slice(firstEmptyStep * FEATURE_DIMENSION).every((v) => v === 0),
    ).toBe(true);
    expect(SEQUENCE_LENGTH).toBe(120);
  });
});
