#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROBOFLOW_DIR = path.join(process.cwd(), "datasets", "processed", "roboflow");
const OUTPUT_DIR = path.join(process.cwd(), "models", "roboflow_llc");
const INPUT_SIZE = 126;
const HIDDEN_SIZE = 32;
const EPOCHS = Number.parseInt(process.env.LLC_EPOCHS ?? "50", 10);
const BATCH_SIZE = Number.parseInt(process.env.LLC_BATCH_SIZE ?? "32", 10);
const LEARNING_RATE = Number.parseFloat(process.env.LLC_LEARNING_RATE ?? "0.01");
const MOMENTUM = Number.parseFloat(process.env.LLC_MOMENTUM ?? "0.9");
const RANDOM_SEED = Number.parseInt(process.env.LLC_SEED ?? "2027", 10);

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const writeJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const mulberry32 = (seed) => { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; }; };
const randomNormal = (rng) => { const u1 = Math.max(rng(), Number.EPSILON); const u2 = rng(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };

const xavierInit = (fanIn, fanOut, rng) => {
  const scale = Math.sqrt(2 / (fanIn + fanOut));
  const w = new Float32Array(fanIn * fanOut);
  for (let i = 0; i < w.length; i++) w[i] = randomNormal(rng) * scale;
  return w;
};

const loadData = () => {
  if (!fs.existsSync(ROBOFLOW_DIR)) {
    console.error(`[llc] Roboflow data directory not found at ${ROBOFLOW_DIR}`);
    console.error("[llc] Run `node scripts/extract-roboflow-landmarks.mjs` first.");
    process.exit(1);
  }
  const labelsData = readJson(path.join(ROBOFLOW_DIR, "labels.json"));
  if (!labelsData || !labelsData.labels) {
    console.error("[llc] labels.json missing or invalid. Extract landmarks first.");
    process.exit(1);
  }
  const labelList = labelsData.labels;
  const labelToId = {};
  for (let i = 0; i < labelList.length; i++) labelToId[labelList[i]] = i;
  const numClasses = labelList.length;

  const loadSplit = (name) => {
    const raw = readJson(path.join(ROBOFLOW_DIR, `${name}.json`));
    if (!raw) return { features: [], labels: [], count: 0 };
    if (raw.features && raw.labels) {
      return { features: raw.features, labels: raw.labels, count: raw.features.length };
    }
    if (raw.samples && Array.isArray(raw.samples)) {
      const features = [];
      const labels = [];
      for (const s of raw.samples) {
        const frame = s.sequence?.[0] || s.features || s.frame;
        if (frame && frame.length === INPUT_SIZE) {
          features.push(frame);
          labels.push(s.label);
        }
      }
      return { features, labels, count: features.length };
    }
    console.warn(`[llc] Unknown format in ${name}.json, treating as empty.`);
    return { features: [], labels: [], count: 0 };
  };

  return {
    train: loadSplit("train"),
    val: loadSplit("validation"),
    test: loadSplit("test"),
    labels: labelList,
    labelToId,
    numClasses
  };
};

const normalizeFeatures = (features) => {
  if (features.length === 0) return features;
  const n = features[0].length;
  const min = new Float32Array(n).fill(Number.POSITIVE_INFINITY);
  const max = new Float32Array(n).fill(Number.NEGATIVE_INFINITY);
  for (const f of features) {
    for (let i = 0; i < n; i++) {
      if (f[i] < min[i]) min[i] = f[i];
      if (f[i] > max[i]) max[i] = f[i];
    }
  }
  const normalized = [];
  for (const f of features) {
    const row = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const range = max[i] - min[i];
      row[i] = range === 0 ? 0 : ((f[i] - min[i]) / range) * 2 - 1;
    }
    normalized.push(row);
  }
  return normalized;
};

const createModel = (numClasses, rng) => {
  const w1 = xavierInit(INPUT_SIZE, HIDDEN_SIZE, rng);
  const b1 = new Float32Array(HIDDEN_SIZE);
  const w2 = xavierInit(HIDDEN_SIZE, numClasses, rng);
  const b2 = new Float32Array(numClasses);
  const opt = (size) => ({ v: new Float32Array(size) });
  return { w1, b1, w2, b2, numClasses, optW1: opt(w1.length), optB1: opt(b1.length), optW2: opt(w2.length), optB2: opt(b2.length) };
};

const relu = (v) => v > 0 ? v : 0;
const reluDeriv = (v) => v > 0 ? 1 : 0;

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

const forward = (model, input) => {
  const z1 = new Float32Array(HIDDEN_SIZE);
  const a1 = new Float32Array(HIDDEN_SIZE);
  for (let j = 0; j < HIDDEN_SIZE; j++) {
    let s = model.b1[j];
    const off = j * INPUT_SIZE;
    for (let i = 0; i < INPUT_SIZE; i++) s += input[i] * model.w1[off + i];
    z1[j] = s;
    a1[j] = relu(s);
  }
  const logits = new Float32Array(model.numClasses);
  for (let j = 0; j < model.numClasses; j++) {
    let s = model.b2[j];
    const off = j * HIDDEN_SIZE;
    for (let i = 0; i < HIDDEN_SIZE; i++) s += a1[i] * model.w2[off + i];
    logits[j] = s;
  }
  const probs = softmax(logits);
  return { z1, a1, logits, probs };
};

const trainBatch = (model, batch, lr) => {
  const batchSize = batch.features.length;
  const gradW1 = new Float32Array(model.w1.length);
  const gradB1 = new Float32Array(model.b1.length);
  const gradW2 = new Float32Array(model.w2.length);
  const gradB2 = new Float32Array(model.b2.length);
  let loss = 0;

  for (let s = 0; s < batchSize; s++) {
    const input = batch.features[s];
    const labelId = batch.labelIds[s];
    const { z1, a1, probs } = forward(model, input);
    loss += -Math.log(Math.max(probs[labelId], 1e-10));

    const delta2 = new Float32Array(model.numClasses);
    for (let j = 0; j < model.numClasses; j++) delta2[j] = probs[j] - (j === labelId ? 1 : 0);

    for (let j = 0; j < model.numClasses; j++) {
      gradB2[j] += delta2[j];
      const off = j * HIDDEN_SIZE;
      for (let i = 0; i < HIDDEN_SIZE; i++) gradW2[off + i] += delta2[j] * a1[i];
    }

    const delta1 = new Float32Array(HIDDEN_SIZE);
    for (let i = 0; i < HIDDEN_SIZE; i++) {
      let g = 0;
      for (let j = 0; j < model.numClasses; j++) g += model.w2[j * HIDDEN_SIZE + i] * delta2[j];
      delta1[i] = g * reluDeriv(z1[i]);
    }
    for (let j = 0; j < HIDDEN_SIZE; j++) {
      gradB1[j] += delta1[j];
      const off = j * INPUT_SIZE;
      for (let i = 0; i < INPUT_SIZE; i++) gradW1[off + i] += delta1[j] * input[i];
    }
  }

  const scale = lr / batchSize;
  const applySgdMomentum = (w, g, v) => {
    for (let i = 0; i < w.length; i++) {
      v[i] = MOMENTUM * v[i] + scale * g[i];
      w[i] -= v[i];
    }
  };

  applySgdMomentum(model.w1, gradW1, model.optW1.v);
  applySgdMomentum(model.b1, gradB1, model.optB1.v);
  applySgdMomentum(model.w2, gradW2, model.optW2.v);
  applySgdMomentum(model.b2, gradB2, model.optB2.v);

  return loss / batchSize;
};

const predict = (model, input) => {
  const { probs } = forward(model, input);
  let best = 0, bp = probs[0];
  for (let i = 1; i < probs.length; i++) { if (probs[i] > bp) { bp = probs[i]; best = i; } }
  return { predicted: best, probabilities: probs };
};

const evaluate = (model, features, labels, labelToId) => {
  if (features.length === 0) return { accuracy: 0, loss: 0, count: 0, cm: null };
  const numClasses = Object.keys(labelToId).length;
  const cm = Array.from({ length: numClasses }, () => new Array(numClasses).fill(0));
  let correct = 0, loss = 0;
  for (let s = 0; s < features.length; s++) {
    const labelId = labelToId[labels[s]];
    if (labelId === undefined) continue;
    const { predicted, probabilities } = predict(model, features[s]);
    loss += -Math.log(Math.max(probabilities[labelId], 1e-10));
    if (predicted === labelId) correct++;
    cm[labelId][predicted]++;
  }
  return { accuracy: correct / features.length, loss: loss / features.length, count: features.length, cm };
};

const computePerClassAccuracy = (cm, labels) => {
  const perClass = {};
  for (let i = 0; i < labels.length; i++) {
    const tp = cm[i][i];
    let total = 0;
    for (let j = 0; j < labels.length; j++) total += cm[i][j];
    perClass[labels[i]] = total > 0 ? tp / total : 0;
  }
  return perClass;
};

const getTopConfused = (cm, labels, topN = 10) => {
  const pairs = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = 0; j < labels.length; j++) {
      if (i !== j && cm[i][j] > 0) pairs.push({ actual: labels[i], predicted: labels[j], count: cm[i][j] });
    }
  }
  pairs.sort((a, b) => b.count - a.count);
  return pairs.slice(0, topN);
};

const writeBinaryWeights = (model, outputPath) => {
  const buffers = [
    Buffer.from(model.w1.buffer),
    Buffer.from(model.b1.buffer),
    Buffer.from(model.w2.buffer),
    Buffer.from(model.b2.buffer),
  ];
  const all = Buffer.concat(buffers);
  fs.writeFileSync(outputPath, all);
  return all.length;
};

const writeTfjsModelJson = (numClasses, outputPath) => {
  const topology = {
    class_name: "Sequential",
    keras_version: "2.x",
    config: {
      name: "sequential_1",
      layers: [
        { class_name: "Dense", config: { name: "dense_1", units: HIDDEN_SIZE, activation: "relu", input_shape: [INPUT_SIZE] } },
        { class_name: "Dense", config: { name: "dense_2", units: numClasses, activation: "softmax" } },
      ]
    }
  };
  const modelJson = {
    modelTopology: JSON.stringify(topology),
    weightsManifest: [{
      paths: ["weights.bin"],
      weights: [
        { name: "dense_1/kernel", shape: [INPUT_SIZE, HIDDEN_SIZE] },
        { name: "dense_1/bias", shape: [HIDDEN_SIZE] },
        { name: "dense_2/kernel", shape: [HIDDEN_SIZE, numClasses] },
        { name: "dense_2/bias", shape: [numClasses] },
      ]
    }],
    format: "layers-model",
    generatedBy: "signlangvisual-roboflow-llc-v1",
    convertedAt: new Date().toISOString()
  };
  writeJson(outputPath, modelJson);
};

const main = () => {
  console.log("[llc] Training Roboflow Lightweight Landmark Classifier (1 hidden layer)");
  console.log("[llc]=".repeat(50));

  const data = loadData();
  const { train, val, test, labels, labelToId, numClasses } = data;

  if (train.count === 0) {
    console.error("[llc] No training data found. Extract landmarks first.");
    process.exit(1);
  }

  console.log(`[llc] Labels: ${numClasses}`);
  console.log(`[llc] Train: ${train.count}, Val: ${val.count}, Test: ${test.count}`);
  console.log(`[llc] Architecture: ${INPUT_SIZE}->${HIDDEN_SIZE}->${numClasses}`);
  console.log(`[llc] Epochs: ${EPOCHS}, Batch: ${BATCH_SIZE}, LR: ${LEARNING_RATE}, Momentum: ${MOMENTUM}`);

  const trainFeat = normalizeFeatures(train.features);
  const valFeat = normalizeFeatures(val.features);
  const testFeat = normalizeFeatures(test.features);

  const rng = mulberry32(RANDOM_SEED);
  const model = createModel(numClasses, rng);

  const trainLabelIds = train.labels.map((l) => labelToId[l]);
  const history = [];

  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    const indices = Array.from({ length: train.count }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [indices[i], indices[j]] = [indices[j], indices[i]]; }

    let epochLoss = 0, batches = 0;
    for (let b = 0; b < train.count; b += BATCH_SIZE) {
      const end = Math.min(b + BATCH_SIZE, train.count);
      const batch = { features: [], labelIds: [] };
      for (let k = b; k < end; k++) {
        batch.features.push(trainFeat[indices[k]]);
        batch.labelIds.push(trainLabelIds[indices[k]]);
      }
      epochLoss += trainBatch(model, batch, LEARNING_RATE);
      batches++;
    }

    if (epoch % 10 === 0 || epoch === 1 || epoch === EPOCHS) {
      const trainEval = evaluate(model, trainFeat, train.labels, labelToId);
      const valEval = evaluate(model, valFeat, val.labels, labelToId);
      history.push({ epoch, trainLoss: epochLoss / batches, trainAccuracy: trainEval.accuracy, valAccuracy: valEval.accuracy });
      console.log(`[llc] Epoch ${epoch}/${EPOCHS} - loss ${(epochLoss / batches).toFixed(4)} train_acc ${(trainEval.accuracy * 100).toFixed(2)}% val_acc ${(valEval.accuracy * 100).toFixed(2)}%`);
    }
  }

  const trainEval = evaluate(model, trainFeat, train.labels, labelToId);
  const valEval = evaluate(model, valFeat, val.labels, labelToId);
  const testEval = evaluate(model, testFeat, test.labels, labelToId);

  console.log(`\n[llc] Final Metrics:`);
  console.log(`[llc]   Train accuracy: ${(trainEval.accuracy * 100).toFixed(2)}%`);
  console.log(`[llc]   Validation accuracy: ${(valEval.accuracy * 100).toFixed(2)}%`);
  console.log(`[llc]   Test accuracy: ${(testEval.accuracy * 100).toFixed(2)}%`);

  if (testEval.cm) {
    const perClass = computePerClassAccuracy(testEval.cm, labels);
    console.log(`\n[llc] Per-class accuracy (top/bottom 5):`);
    const sorted = Object.entries(perClass).sort(([, a], [, b]) => b - a);
    console.log(`[llc]   Top 5:`);
    for (let i = 0; i < Math.min(5, sorted.length); i++) console.log(`[llc]     ${sorted[i][0]}: ${(sorted[i][1] * 100).toFixed(2)}%`);
    console.log(`[llc]   Bottom 5:`);
    for (let i = Math.max(0, sorted.length - 5); i < sorted.length; i++) console.log(`[llc]     ${sorted[i][0]}: ${(sorted[i][1] * 100).toFixed(2)}%`);

    const confused = getTopConfused(testEval.cm, labels);
    if (confused.length > 0) {
      console.log(`\n[llc] Top 10 most confused pairs (actual → predicted):`);
      for (const c of confused) console.log(`[llc]   ${c.actual} → ${c.predicted}: ${c.count} times`);
    }
  }

  ensureDir(OUTPUT_DIR);
  writeJson(path.join(OUTPUT_DIR, "labels.json"), { labels });
  writeJson(path.join(OUTPUT_DIR, "config.json"), {
    modelType: "roboflow-llc",
    architecture: { inputSize: INPUT_SIZE, hidden: HIDDEN_SIZE, outputClasses: numClasses },
    optimizer: { type: "sgd-momentum", learningRate: LEARNING_RATE, momentum: MOMENTUM, epochs: EPOCHS, batchSize: BATCH_SIZE },
    randomSeed: RANDOM_SEED,
    createdAt: new Date().toISOString()
  });
  writeJson(path.join(OUTPUT_DIR, "metrics.json"), {
    trainAccuracy: trainEval.accuracy, valAccuracy: valEval.accuracy, testAccuracy: testEval.accuracy,
    testLoss: testEval.loss,
    createdAt: new Date().toISOString()
  });
  writeJson(path.join(OUTPUT_DIR, "history.json"), history);
  if (testEval.cm) {
    writeJson(path.join(OUTPUT_DIR, "confusion_matrix.json"), { labels, matrix: testEval.cm });
  }
  writeJson(path.join(OUTPUT_DIR, "model_weights.json"), {
    w1: Array.from(model.w1, (v) => Number(v.toFixed(8))),
    b1: Array.from(model.b1, (v) => Number(v.toFixed(8))),
    w2: Array.from(model.w2, (v) => Number(v.toFixed(8))),
    b2: Array.from(model.b2, (v) => Number(v.toFixed(8))),
  });

  writeTfjsModelJson(numClasses, path.join(OUTPUT_DIR, "model.json"));
  const binSize = writeBinaryWeights(model, path.join(OUTPUT_DIR, "weights.bin"));

  console.log(`\n[llc] Model saved to ${OUTPUT_DIR}`);
  console.log(`[llc]   weights.bin: ${binSize} bytes`);
  console.log(`[llc]   model.json (TFJS), labels.json, config.json, metrics.json`);
  console.log("[llc] Done.");
};

main();
