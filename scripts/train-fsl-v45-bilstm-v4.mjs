#!/usr/bin/env node
import fs from "fs";
import path from "path";

const UNIFIED_DIR = path.join(process.cwd(), "datasets", "processed", "unified_v2");
const V45_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_v45");
const ALPHA_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_kaggle_v2");
const FSL_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_105");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_unified_v2", "bilstm_v4");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const TEMPORAL_STEPS = Number.parseInt(process.env.TEMPORAL_STEPS ?? "30", 10);
const HIDDEN_SIZE = Number.parseInt(process.env.HIDDEN_SIZE ?? "48", 10);
const COMBINED_SIZE = HIDDEN_SIZE * 2;
const EPOCHS = Number.parseInt(process.env.EPOCHS ?? "60", 10);
const LEARNING_RATE = Number.parseFloat(process.env.LEARNING_RATE ?? "0.0015");
const DROPOUT_RATE = Number.parseFloat(process.env.DROPOUT ?? "0.25");
const EARLY_STOPPING_PATIENCE = 15;
const MIN_VALIDATION_DELTA = 0.0001;
const GRADIENT_CLIP_VALUE = 1;
const BETA_1 = 0.9, BETA_2 = 0.999, EPSILON = 1e-8;
const RANDOM_SEED = 2027;

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const isValidNumber = (v) => typeof v === "number" && Number.isFinite(v);
const sigmoid = (v) => { if (v >= 0) { const z = Math.exp(-v); return 1 / (1 + z); } const z = Math.exp(v); return z / (1 + z); };
const clipGradient = (v) => Math.min(GRADIENT_CLIP_VALUE, Math.max(-GRADIENT_CLIP_VALUE, v));
const mulberry32 = (seed) => { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; }; };
const randomNormal = (rng) => { const u1 = Math.max(rng(), Number.EPSILON); const u2 = rng(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
const shuffle = (items, rng) => { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items; };
const temporalFrameIndices = () => TEMPORAL_STEPS === 1 ? [SEQUENCE_LENGTH - 1] : Array.from({ length: TEMPORAL_STEPS }, (_, i) => Math.round((i * (SEQUENCE_LENGTH - 1)) / (TEMPORAL_STEPS - 1)));

const buildSparseFrame = (frame) => {
  if (!Array.isArray(frame) || frame.length !== FEATURE_DIMENSION) throw new Error("Frame dimension mismatch.");
  const indices = [], values = [];
  for (let fi = 0; fi < FEATURE_DIMENSION; fi++) {
    const v = frame[fi]; if (!isValidNumber(v)) throw new Error("Invalid feature");
    if (v !== 0) { indices.push(fi); values.push(v); }
  }
  return { indices: Uint16Array.from(indices), values: Float32Array.from(values) };
};

const loadSplit = (samples, frameIndices) => samples.map((s) => ({
  label: s.label, labelId: s.labelId,
  signerId: s.signerId,
  frames: frameIndices.map((fi) => buildSparseFrame(s.sequence[fi]))
}));

const createLstmWeights = (rng) => {
  const gateSize = HIDDEN_SIZE * 4;
  const wx = new Float32Array(FEATURE_DIMENSION * gateSize);
  const wh = new Float32Array(HIDDEN_SIZE * gateSize);
  const b = new Float32Array(gateSize);
  const wxScale = Math.sqrt(1 / FEATURE_DIMENSION);
  const whScale = Math.sqrt(1 / HIDDEN_SIZE);
  for (let i = 0; i < wx.length; i++) wx[i] = randomNormal(rng) * wxScale;
  for (let i = 0; i < wh.length; i++) wh[i] = randomNormal(rng) * whScale;
  for (let hi = 0; hi < HIDDEN_SIZE; hi++) b[HIDDEN_SIZE + hi] = 1;
  return { wx, wh, b };
};

const createModel = (outputClasses) => {
  const rng = mulberry32(RANDOM_SEED);
  const fwd = createLstmWeights(rng);
  const bwd = createLstmWeights(rng);
  const wyScale = Math.sqrt(2 / COMBINED_SIZE);
  const wy = new Float32Array(COMBINED_SIZE * outputClasses);
  const by = new Float32Array(outputClasses);
  for (let i = 0; i < wy.length; i++) wy[i] = randomNormal(rng) * wyScale;
  const opt = (size) => ({ m: new Float32Array(size), v: new Float32Array(size) });
  return {
    lstmFwd: { wx: fwd.wx, wh: fwd.wh, b: fwd.b },
    lstmBwd: { wx: bwd.wx, wh: bwd.wh, b: bwd.b },
    wy, by, outputClasses,
    optFwdWx: opt(fwd.wx.length), optFwdWh: opt(fwd.wh.length), optFwdB: opt(fwd.b.length),
    optBwdWx: opt(bwd.wx.length), optBwdWh: opt(bwd.wh.length), optBwdB: opt(bwd.b.length),
    optWy: opt(wy.length), optBy: opt(by.length),
    optStep: 0, optBeta1Power: 1, optBeta2Power: 1
  };
};

const lstmForward = (frames, wx, wh, b, reverse) => {
  const gateSize = HIDDEN_SIZE * 4;
  let hPrev = new Float32Array(HIDDEN_SIZE);
  let cPrev = new Float32Array(HIDDEN_SIZE);
  const caches = [];
  const sequence = reverse ? [...frames].reverse() : frames;
  for (const frame of sequence) {
    const z = new Float32Array(gateSize);
    z.set(b);
    for (let ii = 0; ii < frame.indices.length; ii++) {
      const iIdx = frame.indices[ii], iVal = frame.values[ii], iOff = iIdx * gateSize;
      for (let gi = 0; gi < gateSize; gi++) z[gi] += iVal * wx[iOff + gi];
    }
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const hv = hPrev[hi]; if (hv === 0) continue;
      const hOff = hi * gateSize;
      for (let gi = 0; gi < gateSize; gi++) z[gi] += hv * wh[hOff + gi];
    }
    const ig = new Float32Array(HIDDEN_SIZE), fg = new Float32Array(HIDDEN_SIZE);
    const cc = new Float32Array(HIDDEN_SIZE), og = new Float32Array(HIDDEN_SIZE);
    const c = new Float32Array(HIDDEN_SIZE), h = new Float32Array(HIDDEN_SIZE);
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const i = sigmoid(z[hi]), f = sigmoid(z[HIDDEN_SIZE + hi]);
      const g = Math.tanh(z[HIDDEN_SIZE * 2 + hi]), o = sigmoid(z[HIDDEN_SIZE * 3 + hi]);
      const cv = f * cPrev[hi] + i * g;
      ig[hi] = i; fg[hi] = f; cc[hi] = g; og[hi] = o;
      c[hi] = cv; h[hi] = o * Math.tanh(cv);
    }
    caches.push({ frame, hPrev, cPrev, inputGate: ig, forgetGate: fg, candidate: cc, outputGate: og, c, h });
    hPrev = h; cPrev = c;
  }
  return { finalH: caches[caches.length - 1].h, caches };
};

const createDropoutMask = (size, rng) => {
  const mask = new Float32Array(size);
  if (DROPOUT_RATE <= 0) { mask.fill(1); return mask; }
  const keep = 1 - DROPOUT_RATE, scale = 1 / keep;
  for (let i = 0; i < size; i++) mask[i] = rng() < keep ? scale : 0;
  return mask;
};

const forward = (model, sample, opts = {}) => {
  const training = opts.training || false;
  const rng = opts.rng || null;
  const fwdR = lstmForward(sample.frames, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b, false);
  const bwdR = lstmForward(sample.frames, model.lstmBwd.wx, model.lstmBwd.wh, model.lstmBwd.b, true);
  const combined = new Float32Array(COMBINED_SIZE);
  combined.set(fwdR.finalH); combined.set(bwdR.finalH, HIDDEN_SIZE);
  const dm = training ? createDropoutMask(COMBINED_SIZE, rng) : null;
  const ci = new Float32Array(COMBINED_SIZE);
  for (let i = 0; i < COMBINED_SIZE; i++) ci[i] = combined[i] * (dm?.[i] ?? 1);
  const logits = new Float32Array(model.outputClasses);
  logits.set(model.by);
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const hv = ci[hi], oOff = hi * model.outputClasses;
    for (let ci2 = 0; ci2 < model.outputClasses; ci2++) logits[ci2] += hv * model.wy[oOff + ci2];
  }
  let maxL = Number.NEGATIVE_INFINITY;
  for (const l of logits) maxL = Math.max(maxL, l);
  const probs = new Float32Array(model.outputClasses);
  let sum = 0;
  for (let ci2 = 0; ci2 < model.outputClasses; ci2++) { const p = Math.exp(logits[ci2] - maxL); probs[ci2] = p; sum += p; }
  for (let ci2 = 0; ci2 < model.outputClasses; ci2++) probs[ci2] /= sum;
  return { fwdResult: fwdR, bwdResult: bwdR, classifierInput: ci, dropoutMask: dm, probabilities: probs };
};

const predict = (probabilities) => { let pc = 0, pp = probabilities[0]; for (let i = 1; i < probabilities.length; i++) { if (probabilities[i] > pp) { pc = i; pp = probabilities[i]; } } return pc; };

const applyAdam = (w, g, m, v, step, b1p, b2p) => {
  for (let i = 0; i < w.length; i++) {
    if (g[i] === 0) continue;
    m[i] = BETA_1 * m[i] + (1 - BETA_1) * g[i];
    v[i] = BETA_2 * v[i] + (1 - BETA_2) * g[i] * g[i];
    w[i] -= (LEARNING_RATE * (m[i] / (1 - b1p))) / (Math.sqrt(v[i] / (1 - b2p)) + EPSILON);
  }
};

const lstmBptt = (caches, dhNext, dcNext, wx, wh, b) => {
  const gateSize = HIDDEN_SIZE * 4;
  const grads = { wx: new Float32Array(wx.length), wh: new Float32Array(wh.length), b: new Float32Array(b.length) };
  for (let t = caches.length - 1; t >= 0; t--) {
    const cache = caches[t];
    const dz = new Float32Array(gateSize);
    const dhPrev = new Float32Array(HIDDEN_SIZE);
    const dcPrev = new Float32Array(HIDDEN_SIZE);
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const cv = cache.c[hi], tanhC = Math.tanh(cv);
      const dh = dhNext[hi], dc = dcNext[hi] + dh * cache.outputGate[hi] * (1 - tanhC * tanhC);
      const ogGrad = dh * tanhC, igGrad = dc * cache.candidate[hi];
      const candGrad = dc * cache.inputGate[hi], fgGrad = dc * cache.cPrev[hi];
      dz[hi] = clipGradient(igGrad * cache.inputGate[hi] * (1 - cache.inputGate[hi]));
      dz[HIDDEN_SIZE + hi] = clipGradient(fgGrad * cache.forgetGate[hi] * (1 - cache.forgetGate[hi]));
      dz[HIDDEN_SIZE * 2 + hi] = clipGradient(candGrad * (1 - cache.candidate[hi] * cache.candidate[hi]));
      dz[HIDDEN_SIZE * 3 + hi] = clipGradient(ogGrad * cache.outputGate[hi] * (1 - cache.outputGate[hi]));
      dcPrev[hi] = dc * cache.forgetGate[hi];
    }
    for (let ii = 0; ii < cache.frame.indices.length; ii++) {
      const iIdx = cache.frame.indices[ii], iVal = cache.frame.values[ii], iOff = iIdx * gateSize;
      for (let gi = 0; gi < gateSize; gi++) grads.wx[iOff + gi] += iVal * dz[gi];
    }
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const hOff = hi * gateSize;
      for (let gi = 0; gi < gateSize; gi++) { grads.wh[hOff + gi] += cache.hPrev[hi] * dz[gi]; dhPrev[hi] += wh[hOff + gi] * dz[gi]; }
    }
    for (let gi = 0; gi < gateSize; gi++) grads.b[gi] += dz[gi];
    dhNext.set(dhPrev); dcNext.set(dcPrev);
  }
  for (const g of Object.values(grads)) for (let i = 0; i < g.length; i++) g[i] = clipGradient(g[i]);
  return grads;
};

const updateModel = (model, grads) => {
  model.optStep++; model.optBeta1Power *= BETA_1; model.optBeta2Power *= BETA_2;
  const apply = (w, g, m, v) => applyAdam(w, g, m, v, model.optStep, model.optBeta1Power, model.optBeta2Power);
  apply(model.lstmFwd.wx, grads.fwd.wx, model.optFwdWx.m, model.optFwdWx.v);
  apply(model.lstmFwd.wh, grads.fwd.wh, model.optFwdWh.m, model.optFwdWh.v);
  apply(model.lstmFwd.b, grads.fwd.b, model.optFwdB.m, model.optFwdB.v);
  apply(model.lstmBwd.wx, grads.bwd.wx, model.optBwdWx.m, model.optBwdWx.v);
  apply(model.lstmBwd.wh, grads.bwd.wh, model.optBwdWh.m, model.optBwdWh.v);
  apply(model.lstmBwd.b, grads.bwd.b, model.optBwdB.m, model.optBwdB.v);
  apply(model.wy, grads.wy, model.optWy.m, model.optWy.v);
  apply(model.by, grads.by, model.optBy.m, model.optBy.v);
};

const trainSampleFull = (model, sample, rng) => {
  const { fwdResult, bwdResult, classifierInput, dropoutMask, probabilities } = forward(model, sample, { training: true, rng });
  const loss = -Math.log(Math.max(probabilities[sample.labelId], Number.EPSILON));
  const predictedClass = predict(probabilities);
  const deltaOut = Float32Array.from(probabilities);
  deltaOut[sample.labelId] -= 1;
  const grads = {
    fwd: { wx: new Float32Array(model.lstmFwd.wx.length), wh: new Float32Array(model.lstmFwd.wh.length), b: new Float32Array(model.lstmFwd.b.length) },
    bwd: { wx: new Float32Array(model.lstmBwd.wx.length), wh: new Float32Array(model.lstmBwd.wh.length), b: new Float32Array(model.lstmBwd.b.length) },
    wy: new Float32Array(model.wy.length), by: new Float32Array(model.by.length)
  };
  for (let ci = 0; ci < model.outputClasses; ci++) grads.by[ci] += deltaOut[ci];
  const deltaHid = new Float32Array(COMBINED_SIZE);
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const oOff = hi * model.outputClasses;
    let g = 0;
    for (let ci = 0; ci < model.outputClasses; ci++) { grads.wy[oOff + ci] += classifierInput[hi] * deltaOut[ci]; g += model.wy[oOff + ci] * deltaOut[ci]; }
    deltaHid[hi] = g * (dropoutMask?.[hi] ?? 1);
  }
  const dhFwd = new Float32Array(HIDDEN_SIZE), dhBwd = new Float32Array(HIDDEN_SIZE);
  for (let i = 0; i < HIDDEN_SIZE; i++) { dhFwd[i] = deltaHid[i]; dhBwd[i] = deltaHid[HIDDEN_SIZE + i]; }
  const dcFwd = new Float32Array(HIDDEN_SIZE), dcBwd = new Float32Array(HIDDEN_SIZE);
  const fwdG = lstmBptt(fwdResult.caches, dhFwd, dcFwd, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b);
  const bwdG = lstmBptt(bwdResult.caches, dhBwd, dcBwd, model.lstmBwd.wx, model.lstmBwd.wh, model.lstmBwd.b);
  grads.fwd.wx.set(fwdG.wx); grads.fwd.wh.set(fwdG.wh); grads.fwd.b.set(fwdG.b);
  grads.bwd.wx.set(bwdG.wx); grads.bwd.wh.set(bwdG.wh); grads.bwd.b.set(bwdG.b);
  updateModel(model, grads);
  return { loss, correct: predictedClass === sample.labelId ? 1 : 0 };
};

const createEmptyConfusionMatrix = (cc) => Array.from({ length: cc }, () => new Array(cc).fill(0));
const computePerLabelMetrics = (cm, labels) => {
  const pl = {}; let mp = 0, mr = 0, mf1 = 0; let wp = 0, wr = 0, wf1 = 0; let ts = 0;
  for (let ci = 0; ci < labels.length; ci++) {
    const tp = cm[ci][ci]; let fp = 0, fn = 0, s = 0;
    for (let oi = 0; oi < labels.length; oi++) { if (oi !== ci) { fp += cm[oi][ci]; fn += cm[ci][oi]; } s += cm[ci][oi]; }
    const p = tp + fp === 0 ? 0 : tp / (tp + fp), r = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = p + r === 0 ? 0 : (2 * p * r) / (p + r);
    pl[labels[ci]] = { precision: p, recall: r, f1, support: s };
    mp += p; mr += r; mf1 += f1; wp += p * s; wr += r * s; wf1 += f1 * s; ts += s;
  }
  return { labels: pl, macroAverage: { precision: mp / labels.length, recall: mr / labels.length, f1: mf1 / labels.length }, weightedAverage: { precision: ts === 0 ? 0 : wp / ts, recall: ts === 0 ? 0 : wr / ts, f1: ts === 0 ? 0 : wf1 / ts } };
};

const evaluate = (model, samples, labels) => {
  const cm = createEmptyConfusionMatrix(labels.length);
  let correct = 0, loss = 0;
  for (const s of samples) {
    const { probabilities } = forward(model, s);
    const pc = predict(probabilities);
    loss += -Math.log(Math.max(probabilities[s.labelId], Number.EPSILON));
    correct += pc === s.labelId ? 1 : 0;
    cm[s.labelId][pc] += 1;
  }
  const metrics = computePerLabelMetrics(cm, labels);
  return { sampleCount: samples.length, loss: loss / samples.length, accuracy: correct / samples.length, macroF1: metrics.macroAverage.f1, weightedF1: metrics.weightedAverage.f1, confusionMatrix: cm, perLabelMetrics: metrics };
};

const roundedArray = (ta) => Array.from(ta, (v) => Number(v.toFixed(8)));

const main = () => {
  console.log("BiLSTM v4 — Training on Unified v2 (+ FSL Dataset v4.5)");
  console.log("=".repeat(55));

  const possibleDirs = [UNIFIED_DIR, V45_DIR, ALPHA_DIR, FSL_DIR];
  let sourceDir = null;
  for (const d of possibleDirs) {
    if (fs.existsSync(path.join(d, "labels.json"))) { sourceDir = d; break; }
  }

  if (!sourceDir) {
    console.error("No training data found. Run data extraction first.");
    process.exit(1);
  }

  const labelsData = readJson(path.join(sourceDir, "labels.json"));
  const frameIndices = temporalFrameIndices();
  const outputClasses = labelsData.labels.length;

  const loadData = (split) => {
    const p = path.join(sourceDir, `${split}.json`);
    if (!fs.existsSync(p)) return null;
    const d = readJson(p);
    return d.samples ? d.samples : d;
  };

  const trainRaw = loadData("train") || [];
  const valRaw = loadData("validation") || [];
  const testRaw = loadData("test") || [];

  console.log(`Source: ${sourceDir}`);
  console.log(`Labels: ${outputClasses}`);
  console.log(`Train: ${trainRaw.length}, Val: ${valRaw.length}, Test: ${testRaw.length}`);
  console.log(`Hidden: ${HIDDEN_SIZE}×2, Steps: ${TEMPORAL_STEPS}, LR: ${LEARNING_RATE}`);

  const trainS = loadSplit(trainRaw, frameIndices);
  const valS = loadSplit(valRaw, frameIndices);
  const testS = loadSplit(testRaw, frameIndices);

  const model = createModel(outputClasses);
  const history = [];
  const trainRng = mulberry32(RANDOM_SEED + 2);
  let bestValLoss = Number.POSITIVE_INFINITY, epochsWOI = 0;

  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    const order = shuffle(Array.from({ length: trainS.length }, (_, i) => i), trainRng);
    let tl = 0, tc = 0;
    for (const si of order) {
      const r = trainSampleFull(model, trainS[si], trainRng);
      tl += r.loss; tc += r.correct;
    }
    const vm = evaluate(model, valS, labelsData.labels);
    const es = { epoch, trainLoss: tl / trainS.length, trainAccuracy: tc / trainS.length, valLoss: vm.loss, valAccuracy: vm.accuracy };
    history.push(es);
    console.log(`Epoch ${epoch}/${EPOCHS} - loss ${es.trainLoss.toFixed(4)} acc ${(es.trainAccuracy * 100).toFixed(2)}% val_loss ${es.valLoss.toFixed(4)} val_acc ${(es.valAccuracy * 100).toFixed(2)}%`);
    if (vm.loss < bestValLoss - MIN_VALIDATION_DELTA) { bestValLoss = vm.loss; epochsWOI = 0; }
    else { epochsWOI++; if (epochsWOI >= EARLY_STOPPING_PATIENCE) { console.log(`Early stopping after ${epoch} epochs.`); break; } }
  }

  const trainM = evaluate(model, trainS, labelsData.labels);
  const valM = evaluate(model, valS, labelsData.labels);
  const testM = evaluate(model, testS, labelsData.labels);

  ensureDir(OUTPUT_DIR);
  const config = {
    modelType: "unified-bilstm-v4",
    description: "BiLSTM v4 trained on Unified v2 dataset with FSL v4.5 augmentation.",
    architecture: { hiddenSize: HIDDEN_SIZE, combinedSize: COMBINED_SIZE, temporalSteps: TEMPORAL_STEPS, dropout: DROPOUT_RATE, outputClasses },
    dataset: { source: sourceDir, totalSamples: trainRaw.length + valRaw.length + testRaw.length },
    optimizer: { type: "adam", learningRate: LEARNING_RATE, epochs: history.length, earlyStopPatience: EARLY_STOPPING_PATIENCE },
    inputShape: [TEMPORAL_STEPS, FEATURE_DIMENSION],
    randomSeed: RANDOM_SEED,
    createdAt: new Date().toISOString()
  };

  const metrics = {
    trainAccuracy: trainM.accuracy, valAccuracy: valM.accuracy, testAccuracy: testM.accuracy,
    testLoss: testM.loss, macroF1: testM.macroF1, weightedF1: testM.weightedF1,
    train: { accuracy: trainM.accuracy, loss: trainM.loss },
    validation: { accuracy: valM.accuracy, loss: valM.loss },
    test: { accuracy: testM.accuracy, loss: testM.loss, macroF1: testM.macroF1, weightedF1: testM.weightedF1 },
    history, createdAt: new Date().toISOString()
  };

  writeJson(path.join(OUTPUT_DIR, "labels.json"), labelsData);
  writeJson(path.join(OUTPUT_DIR, "config.json"), config);
  writeJson(path.join(OUTPUT_DIR, "metrics.json"), metrics);
  writeJson(path.join(OUTPUT_DIR, "training_history.json"), history);
  writeJson(path.join(OUTPUT_DIR, "confusion_matrix.json"), { labels: labelsData.labels, matrix: testM.confusionMatrix });
  writeJson(path.join(OUTPUT_DIR, "model.json"), {
    artifactType: "unified-bilstm-v4", createdAt: new Date().toISOString(),
    labels: labelsData.labels, config,
    weights: {
      lstmFwd: { wx: roundedArray(model.lstmFwd.wx), wh: roundedArray(model.lstmFwd.wh), b: roundedArray(model.lstmFwd.b) },
      lstmBwd: { wx: roundedArray(model.lstmBwd.wx), wh: roundedArray(model.lstmBwd.wh), b: roundedArray(model.lstmBwd.b) },
      wy: roundedArray(model.wy), by: roundedArray(model.by)
    }
  });

  console.log(`\nBiLSTM v4 complete.`);
  console.log(`Test accuracy: ${(testM.accuracy * 100).toFixed(2)}%`);
  console.log(`Test macro F1: ${(testM.macroF1 * 100).toFixed(2)}%`);
  console.log(`Weights saved to ${OUTPUT_DIR}`);
};

main();
