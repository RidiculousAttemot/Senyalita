import { readFileSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import * as tf from "@tensorflow/tfjs";
import { beforeAll, describe, expect, it } from "vitest";
import { SequenceBuffer, FEATURE_DIMENSION, TEMPORAL_STEPS, type HandData } from "../buffer";
import { PredictionSmoother } from "../smoothing";

/**
 * How long does it take to recognise a NEW letter after a previous one?
 *
 * The window holds 120 frames — four seconds at the 30fps capture rate — and
 * the trained indices sample across all of it. So immediately after switching
 * from A to B the model is reading a window that is still mostly A, and keeps
 * saying A until those frames age out.
 *
 * `clearSequence()` fixes this on commit, but commit is a keypress. Signing
 * continuously, with no commit, is the path this measures.
 */

const MODEL_DIR = path.join(process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs");
const DATASET = path.join(process.cwd(), "datasets", "processed", "fsl_unified_v4", "test.ndjson");

let model: tf.LayersModel;
let labels: string[];
/** label -> one captured sequence of that letter */
const letters = new Map<string, number[][]>();

const toHands = (frame: number[]): [HandData, HandData] => {
  const hand = (offset: number) => ({
    landmarks: Array.from({ length: 21 }, (_, i) => ({
      x: frame[offset + i * 3], y: frame[offset + i * 3 + 1], z: frame[offset + i * 3 + 2],
    })),
  });
  return [hand(0), hand(63)];
};

const predict = (sample: Float32Array) => {
  const input = tf.tensor3d(sample, [1, TEMPORAL_STEPS, FEATURE_DIMENSION]);
  const output = model.predict(input) as tf.Tensor;
  const probs = output.dataSync();
  input.dispose();
  output.dispose();
  let best = 0;
  for (let i = 1; i < probs.length; i += 1) if (probs[i] > probs[best]) best = i;
  return { labelId: best, label: labels[best], confidence: probs[best], topK: [] };
};

beforeAll(async () => {
  await tf.setBackend("cpu");
  const artifact = JSON.parse(readFileSync(path.join(MODEL_DIR, "model.json"), "utf-8"));
  const weights = readFileSync(path.join(MODEL_DIR, "weights.bin"));
  labels = JSON.parse(readFileSync(path.join(MODEL_DIR, "labels.json"), "utf-8")).labels;
  model = await tf.loadLayersModel({
    load: async () => ({
      modelTopology: JSON.parse(artifact.modelTopology),
      weightSpecs: artifact.weightsManifest[0].weights,
      weightData: weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.byteLength),
      format: "layers-model",
    }),
  });

  // Pull one static sample per letter. Alphabet entries are single frames
  // (originalFrameCount 1) replicated across the window at training time.
  // The file is >512MB, past Node's max string length, so it must be streamed.
  if (!existsSync(DATASET)) return;
  const wanted = new Set(["a", "b"]);
  await new Promise<void>((resolve) => {
    const rl = createInterface({ input: createReadStream(DATASET), crlfDelay: Infinity });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let row;
      try { row = JSON.parse(line); } catch { return; }
      if (row._header) return;
      const label = labels[row.labelId];
      if (!wanted.has(label) || letters.has(label) || row.originalFrameCount !== 1) return;
      letters.set(label, row.sequence);
      if (letters.size >= wanted.size) rl.close();
    });
    rl.on("close", () => resolve());
  });
}, 180_000);

/** Holds `from` for 120 frames, switches to `to`, returns frames until `to` wins. */
const framesToSwitch = (from: number[][], to: number[][], clearOnSwitch: boolean) => {
  const buffer = new SequenceBuffer();
  const smoother = new PredictionSmoother();
  const append = (frame: number[]) => {
    const [left, right] = toHands(frame);
    buffer.append(left, right);
  };

  // Fill the window with the first letter and let the smoother settle.
  for (let i = 0; i < 120; i += 1) append(from[0]);
  for (let i = 0; i < 6; i += 1) smoother.smooth(predict(buffer.sampleTemporal()!));

  if (clearOnSwitch) {
    buffer.reset();
    smoother.reset();
  }

  for (let i = 1; i <= 150; i += 1) {
    append(to[0]);
    const sample = buffer.sampleTemporal();
    if (!sample) continue;
    const result = smoother.smooth(predict(sample));
    if (result.label === "b") return i;
  }
  return Infinity;
};

/**
 * Replays the sign-end trigger from useRecognition: arm on a confident read,
 * then clear once confidence has collapsed for SIGN_END_FRAMES samples.
 */
const framesToSwitchWithTrigger = (from: number[][], to: number[][]) => {
  const DROP_RATIO = 0.7, END_FRAMES = 2, MIN_PEAK = 0.6;
  const buffer = new SequenceBuffer();
  const smoother = new PredictionSmoother();
  const append = (frame: number[]) => {
    const [left, right] = toHands(frame);
    buffer.append(left, right);
  };

  let peak = 0, low = 0;
  const step = () => {
    const sample = buffer.sampleTemporal();
    if (!sample) return null;
    const r = smoother.smooth(predict(sample));
    if (r.confidence >= peak) { peak = r.confidence; low = 0; }
    else if (peak >= MIN_PEAK && r.confidence < peak * DROP_RATIO) {
      low += 1;
      if (low >= END_FRAMES) {
        buffer.reset(); smoother.reset(); peak = 0; low = 0;
      }
    } else low = 0;
    return r;
  };

  for (let i = 0; i < 120; i += 1) append(from[0]);
  for (let i = 0; i < 6; i += 1) step();

  for (let i = 1; i <= 150; i += 1) {
    append(to[0]);
    const r = step();
    if (r?.label === "b") return i;
  }
  return Infinity;
};

describe("letter-to-letter transition", () => {
  it("measures how long a new letter takes with and without a clear", () => {
    if (letters.size < 2) {
      console.log("dataset unavailable — skipping");
      return;
    }
    const from = letters.get("a")!;
    const to = letters.get("b")!;

    const stale = framesToSwitch(from, to, false);
    const cleared = framesToSwitch(from, to, true);
    const ms = (frames: number) => (frames === Infinity ? "never" : `${Math.round(frames * (1000 / 30))}ms`);

    console.log(`\n  a -> b, continuous (no commit): ${stale} frames (${ms(stale)})`);
    console.log(`  a -> b, buffer cleared:         ${cleared} frames (${ms(cleared)})\n`);

    // Clearing must be strictly better, and fast enough to feel live.
    expect(cleared).toBeLessThan(stale);
    expect(cleared * (1000 / 30)).toBeLessThan(500);
  }, 120_000);

  it("the confidence-collapse trigger fires without being told when to clear", () => {
    if (letters.size < 2) {
      console.log("dataset unavailable — skipping");
      return;
    }
    const from = letters.get("a")!;
    const to = letters.get("b")!;

    const stale = framesToSwitch(from, to, false);
    const triggered = framesToSwitchWithTrigger(from, to);
    const ms = (f: number) => (f === Infinity ? "never" : `${Math.round(f * (1000 / 30))}ms`);

    console.log(`\n  a -> b, no trigger:               ${stale} frames (${ms(stale)})`);
    console.log(`  a -> b, confidence-collapse only: ${triggered} frames (${ms(triggered)})\n`);

    // The point of the trigger: it detects the switch itself, with no motion
    // signal and no keypress. Fingerspelling gives neither.
    expect(triggered).toBeLessThan(stale);
    expect(triggered * (1000 / 30)).toBeLessThan(600);
  }, 120_000);
});
