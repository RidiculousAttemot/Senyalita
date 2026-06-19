#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROBOFLOW_DIR = path.join(process.cwd(), "datasets", "processed", "roboflow");
const MLP_DIR = path.join(process.cwd(), "models", "roboflow_static");
const LLC_DIR = path.join(process.cwd(), "models", "roboflow_llc");
const INPUT_SIZE = 126;

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const formatPercent = (v) => `${(v * 100).toFixed(2)}%`;

const softmax = (logits) => {
  let maxL = Number.NEGATIVE_INFINITY;
  for (const l of logits) if (l > maxL) maxL = l;
  const exps = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) { exps[i] = Math.exp(logits[i] - maxL); sum += exps[i]; }
  if (sum === 0) sum = 1;
  for (let i = 0; i < logits.length; i++) exps[i] /= sum;
  return exps;
};

const loadWeights = (dir) => {
  const config = readJson(path.join(dir, "config.json"));
  const weights = readJson(path.join(dir, "model_weights.json"));
  const metrics = readJson(path.join(dir, "metrics.json"));
  if (!config || !weights || !metrics) return null;
  return { config, weights, metrics };
};

const loadModelMlp = (data) => {
  const w = data.weights;
  const c = data.config.architecture;
  return {
    w1: new Float32Array(w.w1),
    b1: new Float32Array(w.b1),
    w2: new Float32Array(w.w2),
    b2: new Float32Array(w.b2),
    w3: new Float32Array(w.w3),
    b3: new Float32Array(w.b3),
    hidden1Size: c.hidden1 || 64,
    hidden2Size: c.hidden2 || 32,
    outputClasses: c.outputClasses
  };
};

const loadModelLlc = (data) => {
  const w = data.weights;
  const c = data.config.architecture;
  return {
    w1: new Float32Array(w.w1),
    b1: new Float32Array(w.b1),
    w2: new Float32Array(w.w2),
    b2: new Float32Array(w.b2),
    hiddenSize: c.hidden || 32,
    outputClasses: c.outputClasses
  };
};

const predictMlp = (model, input) => {
  const h1 = new Float32Array(model.hidden1Size);
  for (let j = 0; j < model.hidden1Size; j++) {
    let s = model.b1[j];
    const off = j * INPUT_SIZE;
    for (let i = 0; i < INPUT_SIZE; i++) s += input[i] * model.w1[off + i];
    h1[j] = s > 0 ? s : 0;
  }
  const h2 = new Float32Array(model.hidden2Size);
  for (let j = 0; j < model.hidden2Size; j++) {
    let s = model.b2[j];
    const off = j * model.hidden1Size;
    for (let i = 0; i < model.hidden1Size; i++) s += h1[i] * model.w2[off + i];
    h2[j] = s > 0 ? s : 0;
  }
  const logits = new Float32Array(model.outputClasses);
  for (let j = 0; j < model.outputClasses; j++) {
    let s = model.b3[j];
    const off = j * model.hidden2Size;
    for (let i = 0; i < model.hidden2Size; i++) s += h2[i] * model.w3[off + i];
    logits[j] = s;
  }
  const probs = softmax(logits);
  let best = 0, bp = probs[0];
  for (let i = 1; i < probs.length; i++) { if (probs[i] > bp) { bp = probs[i]; best = i; } }
  return best;
};

const predictLlc = (model, input) => {
  const h1 = new Float32Array(model.hiddenSize);
  for (let j = 0; j < model.hiddenSize; j++) {
    let s = model.b1[j];
    const off = j * INPUT_SIZE;
    for (let i = 0; i < INPUT_SIZE; i++) s += input[i] * model.w1[off + i];
    h1[j] = s > 0 ? s : 0;
  }
  const logits = new Float32Array(model.outputClasses);
  for (let j = 0; j < model.outputClasses; j++) {
    let s = model.b2[j];
    const off = j * model.hiddenSize;
    for (let i = 0; i < model.hiddenSize; i++) s += h1[i] * model.w2[off + i];
    logits[j] = s;
  }
  const probs = softmax(logits);
  let best = 0, bp = probs[0];
  for (let i = 1; i < probs.length; i++) { if (probs[i] > bp) { bp = probs[i]; best = i; } }
  return best;
};

const computeAccuracy = (predictFn, model, features, labels, labelToId) => {
  if (features.length === 0) return 0;
  let correct = 0;
  for (let s = 0; s < features.length; s++) {
    const labelId = labelToId[labels[s]];
    if (labelId === undefined) continue;
    const predicted = predictFn(model, features[s]);
    if (predicted === labelId) correct++;
  }
  return correct / features.length;
};

const benchmarkInferenceTime = (predictFn, model, features, iterations = 100) => {
  if (features.length === 0) return 0;
  const start = process.hrtime.bigint();
  for (let iter = 0; iter < iterations; iter++) {
    for (const f of features) predictFn(model, f);
  }
  const end = process.hrtime.bigint();
  const totalNs = Number(end - start);
  return totalNs / (iterations * features.length);
};

const estimateModelSize = (dir) => {
  let total = 0;
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) { try { total += fs.statSync(full).size; } catch {} }
    }
  };
  walk(dir);
  return total;
};

const countParameters = (weights) => {
  let total = 0;
  for (const [key, arr] of Object.entries(weights)) {
    if (key.startsWith("w") || key.startsWith("b")) total += arr.length;
  }
  return total;
};

const main = () => {
  console.log("[benchmark] Roboflow Model Benchmark");
  console.log("[benchmark]=".repeat(50));

  if (!fs.existsSync(MLP_DIR) || !fs.existsSync(LLC_DIR)) {
    console.log("[benchmark] One or both models not found. Train models first:");
    console.log("[benchmark]   node scripts/train-roboflow-mlp.mjs");
    console.log("[benchmark]   node scripts/train-roboflow-llc.mjs");
    process.exit(0);
  }

  const labelsData = readJson(path.join(ROBOFLOW_DIR, "labels.json"));
  if (!labelsData || !labelsData.labels) {
    console.log("[benchmark] Test data not found at datasets/processed/roboflow/");
    process.exit(0);
  }
  const labels = labelsData.labels;
  const testRaw = readJson(path.join(ROBOFLOW_DIR, "test.json"));
  if (!testRaw) {
    console.log("[benchmark] test.json not found.");
    process.exit(0);
  }

  let testFeatures, testLabels;
  if (testRaw.features && testRaw.labels) {
    testFeatures = testRaw.features;
    testLabels = testRaw.labels;
  } else if (testRaw.samples && Array.isArray(testRaw.samples)) {
    testFeatures = [];
    testLabels = [];
    for (const s of testRaw.samples) {
      const frame = s.sequence?.[0] || s.features || s.frame;
      if (frame && frame.length === INPUT_SIZE) {
        testFeatures.push(frame);
        testLabels.push(s.label);
      }
    }
  } else {
    console.log("[benchmark] Unknown test.json format. Cannot benchmark.");
    process.exit(0);
  }

  const labelToId = {};
  for (let i = 0; i < labels.length; i++) labelToId[labels[i]] = i;

  const mlpData = loadWeights(MLP_DIR);
  const llcData = loadWeights(LLC_DIR);

  if (!mlpData || !llcData) {
    console.log("[benchmark] Could not load model weights. Ensure training completed.");
    process.exit(0);
  }

  const mlpModel = loadModelMlp(mlpData);
  const llcModel = loadModelLlc(llcData);

  console.log(`[benchmark] Test samples: ${testFeatures.length}`);
  console.log(`[benchmark] Labels: ${labels.length}`);

  const mlpAcc = computeAccuracy(predictMlp, mlpModel, testFeatures, testLabels, labelToId);
  const llcAcc = computeAccuracy(predictLlc, llcModel, testFeatures, testLabels, labelToId);

  const mlpTime = benchmarkInferenceTime(predictMlp, mlpModel, testFeatures, 50);
  const llcTime = benchmarkInferenceTime(predictLlc, llcModel, testFeatures, 50);

  const mlpSize = estimateModelSize(MLP_DIR);
  const llcSize = estimateModelSize(LLC_DIR);

  const mlpParams = countParameters(mlpData.weights);
  const llcParams = countParameters(llcData.weights);

  const formatTime = (ns) => {
    if (ns < 1000) return `${ns.toFixed(1)} ns`;
    if (ns < 1000000) return `${(ns / 1000).toFixed(2)} µs`;
    return `${(ns / 1000000).toFixed(3)} ms`;
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  console.log(`\n[benchmark] Comparison Table:`);
  console.log(`[benchmark] ${"-".repeat(80)}`);
  console.log(`[benchmark] ${"Metric".padEnd(30)} ${"MLP (2-layer)".padEnd(22)} ${"LLC (1-layer)".padEnd(22)}`);
  console.log(`[benchmark] ${"-".repeat(80)}`);
  console.log(`[benchmark] ${"Test Accuracy".padEnd(30)} ${formatPercent(mlpAcc).padEnd(22)} ${formatPercent(llcAcc).padEnd(22)}`);
  console.log(`[benchmark] ${"Inference Time (avg)".padEnd(30)} ${formatTime(mlpTime).padEnd(22)} ${formatTime(llcTime).padEnd(22)}`);
  console.log(`[benchmark] ${"Total Model Size".padEnd(30)} ${formatSize(mlpSize).padEnd(22)} ${formatSize(llcSize).padEnd(22)}`);
  console.log(`[benchmark] ${"Parameters".padEnd(30)} ${String(mlpParams).padEnd(22)} ${String(llcParams).padEnd(22)}`);
  console.log(`[benchmark] ${"Hidden Layers".padEnd(30)} ${"2".padEnd(22)} ${"1".padEnd(22)}`);
  console.log(`[benchmark] ${"-".repeat(80)}`);

  if (mlpAcc > llcAcc && mlpTime < llcTime * 1.5) {
    console.log(`\n[benchmark] Recommendation: MLP (2 hidden layers) — better accuracy (${formatPercent(mlpAcc)} vs ${formatPercent(llcAcc)}) with acceptable inference time.`);
  } else if (llcAcc >= mlpAcc - 0.05 && llcSize < mlpSize * 0.6) {
    console.log(`\n[benchmark] Recommendation: LLC (1 hidden layer) — nearly same accuracy (${formatPercent(llcAcc)} vs ${formatPercent(mlpAcc)}) but significantly smaller (${formatSize(llcSize)} vs ${formatSize(mlpSize)}). Best for mobile/edge deployment.`);
  } else if (llcTime < mlpTime * 0.7) {
    console.log(`\n[benchmark] Recommendation: LLC (1 hidden layer) — faster inference (${formatTime(llcTime)} vs ${formatTime(mlpTime)}) with competitive accuracy. Good for real-time applications.`);
  } else {
    console.log(`\n[benchmark] Recommendation: MLP (2 hidden layers) — higher accuracy (${formatPercent(mlpAcc)} vs ${formatPercent(llcAcc)}). Use LLC only if model size is critical.`);
  }

  console.log(`\n[benchmark] Detailed Metrics:`);
  console.log(`[benchmark]   MLP: ${mlpParams} params, ${formatSize(mlpSize)} disk, ${formatTime(mlpTime)}/sample`);
  console.log(`[benchmark]   LLC: ${llcParams} params, ${formatSize(llcSize)} disk, ${formatTime(llcTime)}/sample`);
  console.log("[benchmark] Done.");
};

main();
