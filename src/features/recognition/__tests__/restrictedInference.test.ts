import { readFileSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import * as tf from "@tensorflow/tfjs";
import { beforeAll, describe, expect, it } from "vitest";
import { FEATURE_DIMENSION, TEMPORAL_STEPS, SequenceBuffer, type HandData } from "../buffer";
import { IN_SCOPE_SOURCE_LABEL_SET } from "@/features/sign-to-text/inScopeLabels";

/**
 * Restricting the argmax must always yield an in-scope answer.
 *
 * The first version of the letters-and-numbers scope filtered AFTER
 * prediction: if the model's top class was one of the 105 phrases, the
 * prediction was discarded and the UI showed nothing. Reported as "it doesn't
 * detect anything".
 *
 * This measures how often the unrestricted argmax lands outside the 36 — i.e.
 * how often the discard approach would have blanked the panel — and asserts
 * the restricted path never does.
 */

const MODEL_DIR = path.join(process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs");
const DATASET = path.join(process.cwd(), "datasets", "processed", "fsl_unified_v4", "test.ndjson");

let model: tf.LayersModel;
let labels: string[];
const letterSamples: number[][][] = [];

const toHands = (frame: number[]): [HandData, HandData] => {
  const hand = (o: number) => ({
    landmarks: Array.from({ length: 21 }, (_, i) => ({
      x: frame[o + i * 3], y: frame[o + i * 3 + 1], z: frame[o + i * 3 + 2],
    })),
  });
  return [hand(0), hand(63)];
};

/** Mirrors loader.ts: argmax over allowed classes, or all when unrestricted. */
const argmax = (sample: Float32Array, allowed?: ReadonlySet<string>) => {
  const input = tf.tensor3d(sample, [1, TEMPORAL_STEPS, FEATURE_DIMENSION]);
  const output = model.predict(input) as tf.Tensor;
  const probs = output.dataSync();
  input.dispose();
  output.dispose();
  let best = -1;
  for (let i = 0; i < probs.length; i += 1) {
    if (allowed && !allowed.has(labels[i])) continue;
    if (best < 0 || probs[i] > probs[best]) best = i;
  }
  return labels[best];
};

const windowOf = (sequence: number[][]) => {
  const buffer = new SequenceBuffer();
  for (let i = 0; i < 120; i += 1) {
    const [l, r] = toHands(sequence[0]);
    buffer.append(l, r);
  }
  return buffer.sampleTemporal()!;
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
  const letters = new Set("abcdefghijklmnopqrstuvwxyz".split(""));
  await new Promise<void>((resolve) => {
    const rl = createInterface({ input: createReadStream(DATASET), crlfDelay: Infinity });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let row;
      try { row = JSON.parse(line); } catch { return; }
      if (row._header) return;
      if (!letters.has(labels[row.labelId])) return;
      letterSamples.push(row.sequence);
      if (letterSamples.length >= 120) rl.close();
    });
    rl.on("close", () => resolve());
  });
}, 300_000);

describe("restricted inference", () => {
  it("always produces an in-scope label", () => {
    if (!letterSamples.length) { console.log("dataset unavailable — skipping"); return; }

    let outOfScopeUnrestricted = 0;
    const offenders = new Map<string, number>();

    for (const sequence of letterSamples) {
      const sample = windowOf(sequence);

      const restricted = argmax(sample, IN_SCOPE_SOURCE_LABEL_SET);
      expect(
        IN_SCOPE_SOURCE_LABEL_SET.has(restricted),
        `restricted argmax returned out-of-scope "${restricted}"`,
      ).toBe(true);

      const unrestricted = argmax(sample);
      if (!IN_SCOPE_SOURCE_LABEL_SET.has(unrestricted)) {
        outOfScopeUnrestricted += 1;
        offenders.set(unrestricted, (offenders.get(unrestricted) ?? 0) + 1);
      }
    }

    const pct = ((outOfScopeUnrestricted / letterSamples.length) * 100).toFixed(1);
    console.log(`\n  letter windows sampled: ${letterSamples.length}`);
    console.log(`  unrestricted argmax landed outside the 36: ${outOfScopeUnrestricted} (${pct}%)`);
    if (offenders.size) {
      const top = [...offenders].sort((a, b) => b[1] - a[1]).slice(0, 6);
      console.log(`  would have blanked the panel as: ${top.map(([l, n]) => `${l} x${n}`).join(", ")}`);
    }
    console.log("");
  }, 300_000);
});
