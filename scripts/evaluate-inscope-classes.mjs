#!/usr/bin/env node
/**
 * Part 2 evidence for the 36 in-scope classes (a-z + ONE..TEN).
 *
 * Produces, per class:
 *   1. confusion — what a failing class gets predicted AS
 *   2. training sample counts, so imbalance is explicit
 *   3. offline accuracy (model on a clean window) vs pipeline accuracy
 *      (through SequenceBuffer + PredictionSmoother, as the app runs it)
 *
 * Offline vs pipeline is the load-bearing comparison: a class that scores
 * offline and fails through the pipeline is a pipeline problem, not a model
 * one. It cannot cover MediaPipe extraction or camera timing — those need a
 * device — so "pipeline" here means everything downstream of landmarks.
 *
 *   node scripts/evaluate-inscope-classes.mjs [--model <dir>] [--samples N]
 *
 * Default model is the served one. Pass --model to compare a candidate in
 * Part 3 without touching what users load.
 */
import { readFileSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import * as tf from "@tensorflow/tfjs";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const MODEL_DIR = path.resolve(argOf("--model", "public/models/fsl_unified/bilstm_tfjs"));
const DATA_DIR = path.resolve(argOf("--data", "datasets/processed/fsl_unified_v4"));
const PER_CLASS = Number(argOf("--samples", "12"));

const FEATURE_DIMENSION = 126;
const TEMPORAL_STEPS = 35;
const SEQUENCE_LENGTH = 120;

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const NUMBERS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"];
const IN_SCOPE = [...LETTERS, ...NUMBERS];
const IN_SCOPE_SET = new Set(IN_SCOPE);

// Trained frame indices, read from the app so this cannot drift from it.
const bufferSrc = readFileSync("src/features/recognition/buffer.ts", "utf-8");
const IDX = JSON.parse(
  /TEMPORAL_FRAME_INDICES = (\[[\s\S]*?\])/.exec(bufferSrc)[1].replace(/,(\s*\])/, "$1"),
);

const labels = JSON.parse(readFileSync(path.join(MODEL_DIR, "labels.json"), "utf-8")).labels;

await tf.setBackend("cpu");
const artifact = JSON.parse(readFileSync(path.join(MODEL_DIR, "model.json"), "utf-8"));
const weights = readFileSync(path.join(MODEL_DIR, "weights.bin"));
const model = await tf.loadLayersModel({
  load: async () => ({
    modelTopology: JSON.parse(artifact.modelTopology),
    weightSpecs: artifact.weightsManifest[0].weights,
    weightData: weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.byteLength),
    format: "layers-model",
  }),
});

/** Argmax over allowed classes — mirrors loader.ts when allowedLabels is set. */
const predict = (sample, restrict) => {
  const input = tf.tensor3d(sample, [1, TEMPORAL_STEPS, FEATURE_DIMENSION]);
  const output = model.predict(input);
  const probs = output.dataSync();
  input.dispose();
  output.dispose();
  let best = -1;
  for (let i = 0; i < probs.length; i += 1) {
    if (restrict && !IN_SCOPE_SET.has(labels[i])) continue;
    if (best < 0 || probs[i] > probs[best]) best = i;
  }
  return { label: labels[best], confidence: probs[best] };
};

/** Trained-index sample of a 120-frame window — mirrors SequenceBuffer. */
const windowSample = (frames) => {
  const out = new Float32Array(TEMPORAL_STEPS * FEATURE_DIMENSION);
  for (let s = 0; s < TEMPORAL_STEPS; s += 1) {
    const src = frames[Math.min(IDX[s], frames.length - 1)];
    if (src) out.set(src, s * FEATURE_DIMENSION);
  }
  return out;
};

/** Resampled gesture span — mirrors SequenceBuffer.resampleGesture. */
const spanSample = (frames) => {
  const out = new Float32Array(TEMPORAL_STEPS * FEATURE_DIMENSION);
  const span = frames.length;
  for (let s = 0; s < TEMPORAL_STEPS; s += 1) {
    const offset = span === 1 ? 0
      : Math.min(span - 1, Math.round((IDX[s] * (span - 1)) / (SEQUENCE_LENGTH - 1)));
    out.set(frames[offset], s * FEATURE_DIMENSION);
  }
  return out;
};

/** 5-frame majority vote with vote-share hysteresis — mirrors PredictionSmoother. */
const makeSmoother = () => {
  const history = [];
  let stable = null;
  return (r) => {
    history.push(r);
    if (history.length > 5) history.shift();
    if (history.length < 2) return r.label;
    const counts = new Map();
    for (const e of history) counts.set(e.label, (counts.get(e.label) ?? 0) + 1);
    let best = r.label, bestN = 0;
    for (const [l, n] of counts) if (n > bestN) { bestN = n; best = l; }
    if (stable !== null && best !== stable) {
      const challenger = bestN / history.length;
      const incumbent = (counts.get(stable) ?? 0) / history.length;
      if (challenger < incumbent + 0.10) best = stable;
    }
    stable = best;
    return best;
  };
};

const streamNdjson = (file, onRow) => new Promise((resolve) => {
  if (!existsSync(file)) return resolve();
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let row;
    try { row = JSON.parse(line); } catch { return; }
    if (row._header) return;
    if (onRow(row) === "stop") rl.close();
  });
  rl.on("close", resolve);
});

// ---- 2. training sample counts -------------------------------------------
process.stderr.write("counting training samples...\n");
const trainCounts = new Map(IN_SCOPE.map((l) => [l, 0]));
const trainStatic = new Map(IN_SCOPE.map((l) => [l, 0]));
await streamNdjson(path.join(DATA_DIR, "train.ndjson"), (row) => {
  const label = labels[row.labelId];
  if (!IN_SCOPE_SET.has(label)) return;
  trainCounts.set(label, trainCounts.get(label) + 1);
  if (row.originalFrameCount === 1) trainStatic.set(label, trainStatic.get(label) + 1);
});

// ---- collect test samples ------------------------------------------------
process.stderr.write("collecting test samples...\n");
const testSamples = new Map(IN_SCOPE.map((l) => [l, []]));
await streamNdjson(path.join(DATA_DIR, "test.ndjson"), (row) => {
  const label = labels[row.labelId];
  if (!IN_SCOPE_SET.has(label)) return;
  const got = testSamples.get(label);
  if (got.length >= PER_CLASS) return;
  got.push({ sequence: row.sequence, originalFrameCount: row.originalFrameCount });
  if ([...testSamples.values()].every((v) => v.length >= PER_CLASS)) return "stop";
});

// ---- 1 & 3. confusion, offline vs pipeline -------------------------------
process.stderr.write("evaluating...\n");
const rows = [];
const confusion = new Map();

for (const label of IN_SCOPE) {
  const samples = testSamples.get(label);
  let offlineHits = 0, pipelineHits = 0;
  const confusedAs = new Map();

  for (const { sequence, originalFrameCount } of samples) {
    // Static classes fill the window; video classes are resampled as a span,
    // matching how each reaches the model at inference.
    const isStatic = originalFrameCount === 1;
    const frames = isStatic
      ? Array.from({ length: SEQUENCE_LENGTH }, () => sequence[0])
      : sequence;
    const sample = isStatic ? windowSample(frames) : spanSample(frames);

    const offline = predict(sample, true);
    if (offline.label === label) offlineHits += 1;
    else confusedAs.set(offline.label, (confusedAs.get(offline.label) ?? 0) + 1);

    // Pipeline: same window, through the smoother over repeated reads.
    const smooth = makeSmoother();
    let out = "";
    for (let i = 0; i < 8; i += 1) out = smooth(predict(sample, true));
    if (out === label) pipelineHits += 1;
  }

  const n = samples.length || 1;
  rows.push({
    label,
    kind: NUMBERS.includes(label) ? "number" : "letter",
    train: trainCounts.get(label),
    trainStatic: trainStatic.get(label),
    tested: samples.length,
    offline: offlineHits / n,
    pipeline: pipelineHits / n,
  });
  if (confusedAs.size) confusion.set(label, confusedAs);
}

// ---- report ---------------------------------------------------------------
const pct = (x) => `${(x * 100).toFixed(0)}%`.padStart(4);
console.log(`\nmodel: ${MODEL_DIR}`);
console.log(`data:  ${DATA_DIR}   ${PER_CLASS} test samples/class\n`);
console.log("  class  kind    train  static%   tested  offline  pipeline");
for (const r of rows) {
  const staticPct = r.train ? `${Math.round((r.trainStatic / r.train) * 100)}%` : "-";
  console.log(
    `  ${r.label.padEnd(6)} ${r.kind.padEnd(7)} ${String(r.train).padStart(5)}  ${staticPct.padStart(6)}   ${String(r.tested).padStart(5)}   ${pct(r.offline)}     ${pct(r.pipeline)}`,
  );
}

const mean = (f, list) => list.reduce((a, b) => a + f(b), 0) / (list.length || 1);
const letters = rows.filter((r) => r.kind === "letter");
const numbers = rows.filter((r) => r.kind === "number");
console.log(`\n  letters  offline ${pct(mean((r) => r.offline, letters))}   pipeline ${pct(mean((r) => r.pipeline, letters))}`);
console.log(`  numbers  offline ${pct(mean((r) => r.offline, numbers))}   pipeline ${pct(mean((r) => r.pipeline, numbers))}`);
console.log(`  all 36   offline ${pct(mean((r) => r.offline, rows))}   pipeline ${pct(mean((r) => r.pipeline, rows))}`);

const trainVals = rows.map((r) => r.train);
console.log(`\n  training imbalance: min ${Math.min(...trainVals)}  max ${Math.max(...trainVals)}  ratio ${(Math.max(...trainVals) / Math.max(1, Math.min(...trainVals))).toFixed(1)}x`);

if (confusion.size) {
  console.log(`\n  CONFUSION (offline misses):`);
  for (const [label, as] of confusion) {
    const top = [...as].sort((a, b) => b[1] - a[1]).slice(0, 4);
    console.log(`    ${label.padEnd(6)} -> ${top.map(([l, n]) => `${l} x${n}`).join(", ")}`);
  }
} else {
  console.log("\n  CONFUSION: none — every class correct on every sample");
}
