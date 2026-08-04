import { readFileSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import * as tf from "@tensorflow/tfjs";
import { beforeAll, describe, expect, it } from "vitest";
import { SequenceBuffer, FEATURE_DIMENSION, TEMPORAL_STEPS, type HandData } from "../buffer";

/**
 * The number signs must reach the model time-normalised, WITHOUT depending on
 * MotionDetector marking a span.
 *
 * ONE..TEN are video-trained — 0% of their training clips are static, against
 * 68-79% for letters — so they carry real temporal structure. MotionDetector
 * cannot be trusted to mark them: only 2-7% of frames clear MOTION_THRESHOLD,
 * and it fails to fire at all on some classes.
 *
 * Measured against the served model, comparing what the buffer produces with
 * a hypothetical zero-padded window (frames at their own index, tail zero):
 *
 *   numbers   zero-padded  8%   resampled 93%
 *   letters   zero-padded 67%   resampled 97%
 *   all 36    zero-padded 51%   resampled 96%
 *
 * The buffer already resamples unconditionally, so this is a regression guard
 * rather than a fix: it fails if the fallback ever goes back to placing frames
 * at their own index, which is the shape that produced the 8%.
 */

const MODEL_DIR = path.join(process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs");
const DATASET = path.join(process.cwd(), "datasets", "processed", "fsl_unified_v4", "test.ndjson");
const NUMBERS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"];
const IN_SCOPE = new Set([..."abcdefghijklmnopqrstuvwxyz".split(""), ...NUMBERS]);

let model: tf.LayersModel;
let labels: string[];
/** label -> a few clips, subsampled to the length a 30fps camera would capture */
const clips = new Map<string, number[][][]>();

const toHands = (frame: number[]): [HandData, HandData] => {
  const hand = (o: number) => ({
    landmarks: Array.from({ length: 21 }, (_, i) => ({
      x: frame[o + i * 3], y: frame[o + i * 3 + 1], z: frame[o + i * 3 + 2],
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
  let best = -1;
  for (let i = 0; i < probs.length; i += 1) {
    if (!IN_SCOPE.has(labels[i])) continue;
    if (best < 0 || probs[i] > probs[best]) best = i;
  }
  return labels[best];
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
  const want = new Set(NUMBERS);
  await new Promise<void>((resolve) => {
    const rl = createInterface({ input: createReadStream(DATASET), crlfDelay: Infinity });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let row;
      try { row = JSON.parse(line); } catch { return; }
      if (row._header) return;
      const label = labels[row.labelId];
      if (!want.has(label)) return;
      const got = clips.get(label) ?? [];
      if (got.length >= 4) return;
      // The dataset stores clips already normalised to 120 frames. Live, the
      // buffer holds only what the camera captured — so subsample back to the
      // clip's real length, or the test silently skips the thing it measures.
      const n = Math.max(5, Math.min(row.originalFrameCount, 120));
      got.push(Array.from({ length: n }, (_, i) =>
        row.sequence[Math.round((i * (row.sequence.length - 1)) / (n - 1))]));
      clips.set(label, got);
      if ([...want].every((l) => (clips.get(l)?.length ?? 0) >= 4)) rl.close();
    });
    rl.on("close", () => resolve());
  });
}, 300_000);

describe("number sign routing", () => {
  it("recognises numbers with no gesture span marked", () => {
    if (clips.size === 0) { console.log("dataset unavailable — skipping"); return; }

    const failures: string[] = [];
    let correct = 0, total = 0;

    for (const label of NUMBERS) {
      for (const frames of clips.get(label) ?? []) {
        // No markGestureStart: this is the path taken whenever MotionDetector
        // does not fire, which for these classes is most of the time.
        const buffer = new SequenceBuffer();
        for (const frame of frames) {
          const [left, right] = toHands(frame);
          buffer.append(left, right);
        }
        const got = predict(buffer.sampleTemporal()!);
        total += 1;
        if (got === label) correct += 1;
        else failures.push(`${label} -> ${got}`);
      }
    }

    console.log(`\n  numbers, unmarked buffer: ${correct}/${total} (${((correct / total) * 100).toFixed(0)}%)`);
    if (failures.length) console.log(`  misses: ${failures.join(", ")}\n`);

    // Zero-padding scored 8% here. Anything near that means the fallback has
    // reverted to placing frames at their own index.
    expect(correct / total).toBeGreaterThan(0.7);
  }, 300_000);

  it("a partly-filled buffer is stretched, not zero-padded", () => {
    if (clips.size === 0) { console.log("dataset unavailable — skipping"); return; }

    const frames = clips.get("ONE")![0];
    const buffer = new SequenceBuffer();
    for (const frame of frames) {
      const [left, right] = toHands(frame);
      buffer.append(left, right);
    }

    // With ~40 frames in a 120-frame window, zero-padding would leave the last
    // trained indices empty. Every step must carry real landmark data.
    const sample = buffer.sampleTemporal()!;
    const lastStep = sample.slice((TEMPORAL_STEPS - 1) * FEATURE_DIMENSION);
    expect(buffer.length).toBeLessThan(120);
    expect(
      lastStep.some((v) => v !== 0),
      "final temporal step is all zeros — the window is being padded, not stretched",
    ).toBe(true);
  }, 120_000);
});
