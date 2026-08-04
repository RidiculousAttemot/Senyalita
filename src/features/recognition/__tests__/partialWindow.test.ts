import { readFileSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import * as tf from "@tensorflow/tfjs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  SequenceBuffer,
  FEATURE_DIMENSION,
  TEMPORAL_STEPS,
  SEQUENCE_LENGTH,
  TEMPORAL_FRAME_INDICES,
  MINIMUM_FRAMES,
  type HandData,
} from "../buffer";
import { normalizeLandmarks } from "../normalize";

/**
 * What does the model see while the window is still filling?
 *
 * Every clear — commit, reshape edge, confidence collapse — empties the buffer,
 * and it then takes 120 frames (4 seconds at 30fps) to refill. The trained
 * indices span the whole window, so until it is full most of them read slots
 * that hold nothing.
 *
 * This measures accuracy against fill level. It exists because the alternative
 * is inferring it: the app clears far more often than it used to, so whatever
 * happens during a partial window is now most of what a user experiences.
 */

const MODEL_DIR = path.join(process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs");
const DATASET = path.join(process.cwd(), "datasets", "processed", "fsl_unified_v4", "test.ndjson");

let model: tf.LayersModel;
let labels: string[];
/** label -> one captured static sample of that letter */
const letters = new Map<string, number[]>();

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
  return { label: labels[best], confidence: probs[best] };
};

/**
 * The behaviour this replaced, kept so the comparison stays runnable: read the
 * trained indices straight out of the raw window and leave the rest zero.
 *
 * At a full window the two are identical — offset = round(i * 119 / 119) = i —
 * so any difference the table shows is entirely in the partial case.
 */
const zeroPadded = (frames: Float32Array[]): Float32Array => {
  const sampled = new Float32Array(TEMPORAL_STEPS * FEATURE_DIMENSION);
  for (let step = 0; step < TEMPORAL_STEPS; step += 1) {
    const frame = frames[TEMPORAL_FRAME_INDICES[step]];
    if (!frame) continue;
    sampled.set(frame, step * FEATURE_DIMENSION);
  }
  return sampled;
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

  if (!existsSync(DATASET)) return;
  const wanted = new Set("abcdefghijklmnopqrstuvwxyz".split(""));
  await new Promise<void>((resolve) => {
    const rl = createInterface({ input: createReadStream(DATASET), crlfDelay: Infinity });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let row;
      try { row = JSON.parse(line); } catch { return; }
      if (row._header) return;
      const label = labels[row.labelId];
      if (!wanted.has(label) || letters.has(label) || row.originalFrameCount !== 1) return;
      // A static sample is one frame replicated across the window; take slot 0.
      letters.set(label, row.sequence[0]);
      if (letters.size >= wanted.size) rl.close();
    });
    rl.on("close", () => resolve());
  });
}, 300_000);

/** Fill levels worth reporting — MINIMUM_FRAMES, then a spread up to full. */
const FILLS = [5, 8, 12, 20, 30, 45, 60, 90, 119, 120];

describe("partial window", () => {
  it("measures accuracy against how full the buffer is", () => {
    if (letters.size < 5) {
      console.log("dataset unavailable — skipping");
      return;
    }

    const old = new Map<number, number>();
    const live = new Map<number, number>();
    const confOld = new Map<number, number>();
    const confLive = new Map<number, number>();
    for (const n of FILLS) {
      old.set(n, 0); live.set(n, 0);
      confOld.set(n, 0); confLive.set(n, 0);
    }

    for (const [label, frame] of letters) {
      const buffer = new SequenceBuffer();
      const raw: Float32Array[] = [];
      const [left, right] = toHands(frame);

      for (let n = 1; n <= SEQUENCE_LENGTH; n += 1) {
        buffer.append(left, right);
        // Normalised the same way the buffer does, so the two paths differ
        // only in how they lay frames into the window.
        raw.push(normalizeLandmarks(left.landmarks, right.landmarks));
        if (n < MINIMUM_FRAMES || !FILLS.includes(n)) continue;

        const a = predict(zeroPadded(raw));
        if (a.label === label) {
          old.set(n, old.get(n)! + 1);
          confOld.set(n, confOld.get(n)! + a.confidence);
        }
        const b = predict(buffer.sampleTemporal()!);
        if (b.label === label) {
          live.set(n, live.get(n)! + 1);
          confLive.set(n, confLive.get(n)! + b.confidence);
        }
      }
    }

    const total = letters.size;
    const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
    console.log(`\n  ${total} letters, accuracy by buffer fill\n`);
    console.log("  frames | zero-pad (was)     | spread (now)");
    console.log("  -------|--------------------|--------------------");
    for (const n of FILLS) {
      const o = old.get(n)!, l = live.get(n)!;
      const oc = o ? (confOld.get(n)! / o * 100).toFixed(0) : "--";
      const lc = l ? (confLive.get(n)! / l * 100).toFixed(0) : "--";
      console.log(
        `  ${String(n).padStart(6)} | ${pct(o).padStart(6)} @ ${String(oc).padStart(3)}% conf `
        + `| ${pct(l).padStart(6)} @ ${String(lc).padStart(3)}% conf`,
      );
    }
    console.log();

    // The two must agree at a full window: the change is meant to affect the
    // partial case only, and a difference here would mean it disturbed the
    // path that already worked.
    expect(live.get(120)).toBe(old.get(120));

    // A buffer at MINIMUM_FRAMES is what every clear produces, so it is the
    // level that decides what a user sees. It must be as good as a full one.
    expect(live.get(MINIMUM_FRAMES)).toBe(live.get(120));
    expect(live.get(MINIMUM_FRAMES)!).toBeGreaterThan(old.get(MINIMUM_FRAMES)!);
  }, 300_000);
});
