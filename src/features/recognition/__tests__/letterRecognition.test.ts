import { readFileSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import * as tf from "@tensorflow/tfjs";
import { beforeAll, describe, expect, it } from "vitest";
import { SequenceBuffer, FEATURE_DIMENSION, TEMPORAL_STEPS, type HandData } from "../buffer";
import { PredictionSmoother } from "../smoothing";

/**
 * Does each letter recognise through the real buffer + smoother + model?
 *
 * "a" in particular was reported as never appearing. Two candidate causes:
 * the model cannot classify it, or the pipeline cannot report it. The smoother
 * locked its label whenever the incumbent and challenger were both confident,
 * so a correctly-classified "a" could be discarded before display — which
 * looks exactly like a model failure from the outside.
 *
 * This runs the same buffer and smoother the app uses, so it separates the
 * two: a letter that scores here is a pipeline problem, not a model one.
 */

const MODEL_DIR = path.join(process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs");
const DATASET = path.join(process.cwd(), "datasets", "processed", "fsl_unified_v4", "test.ndjson");

let model: tf.LayersModel;
let labels: string[];
/** label -> several captured samples of that letter */
const samples = new Map<string, number[][][]>();

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const PER_LETTER = 3;

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

/** Fills the window with one sample and returns the smoothed label. */
const recognise = (sequence: number[][], smoother?: PredictionSmoother) => {
  const buffer = new SequenceBuffer();
  const s = smoother ?? new PredictionSmoother();
  for (let i = 0; i < 120; i += 1) {
    const [left, right] = toHands(sequence[0]);
    buffer.append(left, right);
  }
  let out = "";
  for (let i = 0; i < 8; i += 1) out = s.smooth(predict(buffer.sampleTemporal()!)).label;
  return out;
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
  const wanted = new Set(LETTERS);
  await new Promise<void>((resolve) => {
    const rl = createInterface({ input: createReadStream(DATASET), crlfDelay: Infinity });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let row;
      try { row = JSON.parse(line); } catch { return; }
      if (row._header) return;
      const label = labels[row.labelId];
      if (!wanted.has(label) || row.originalFrameCount !== 1) return;
      const got = samples.get(label) ?? [];
      if (got.length >= PER_LETTER) return;
      got.push(row.sequence);
      samples.set(label, got);
      if ([...samples.values()].every((v) => v.length >= PER_LETTER) && samples.size === wanted.size) rl.close();
    });
    rl.on("close", () => resolve());
  });
}, 300_000);

describe("letter recognition through the live pipeline", () => {
  it("recognises 'a' on its own", () => {
    const got = samples.get("a");
    if (!got?.length) { console.log("dataset unavailable — skipping"); return; }

    const results = got.map((s) => recognise(s));
    console.log(`\n  'a' alone -> ${results.join(", ")}`);
    expect(results.filter((r) => r === "a").length).toBeGreaterThan(0);
  }, 120_000);

  it("recognises 'a' AFTER another confident letter — the reported failure", () => {
    const a = samples.get("a");
    const b = samples.get("b");
    if (!a?.length || !b?.length) { console.log("dataset unavailable — skipping"); return; }

    // One smoother across both, exactly as a session behaves. This is where the
    // hysteresis lock bit: "b" settles confidently, then "a" can never displace it.
    const smoother = new PredictionSmoother();
    const first = recognise(b[0], smoother);
    const second = recognise(a[0], smoother);

    console.log(`  sequence: ${first} -> ${second}`);
    expect(first).toBe("b");
    expect(second, "'a' must be reportable after a confident previous letter").toBe("a");
  }, 120_000);

  it("reports per-letter recognition across all 26", () => {
    if (samples.size === 0) { console.log("dataset unavailable — skipping"); return; }

    const failures: string[] = [];
    let correct = 0, total = 0;
    for (const letter of LETTERS) {
      const got = samples.get(letter) ?? [];
      const preds = got.map((s) => recognise(s));
      const hits = preds.filter((p) => p === letter).length;
      correct += hits; total += preds.length;
      if (hits === 0 && preds.length) failures.push(`${letter} -> ${[...new Set(preds)].join("/")}`);
    }
    console.log(`\n  offline letter accuracy: ${correct}/${total} (${((correct / total) * 100).toFixed(1)}%)`);
    if (failures.length) console.log(`  never correct: ${failures.join(", ")}\n`);
    else console.log("  every letter recognised at least once\n");

    // Deliberately not asserting a rate — this is the measurement that decides
    // whether Part 3 needs a training run at all.
    expect(total).toBeGreaterThan(0);
  }, 300_000);
});
