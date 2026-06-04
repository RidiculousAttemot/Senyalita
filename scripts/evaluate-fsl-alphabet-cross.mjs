import fs from "fs";
import path from "path";

const INPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_v2");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_alphabet", "cross_signer_eval");
const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const OUTPUT_CLASSES = 28;
const RANDOM_SEED = 2026;
const TEMPORAL_STEPS = 30;
const HIDDEN_SIZE = 32;
const COMBINED_SIZE = HIDDEN_SIZE * 2;
const EPOCHS = 20;
const LEARNING_RATE = 0.002;
const DROPOUT_RATE = 0.2;
const EARLY_STOPPING_PATIENCE = 10;
const MIN_VALIDATION_DELTA = 0.0001;
const GRADIENT_CLIP_VALUE = 1;
const BETA_1 = 0.9;
const BETA_2 = 0.999;
const EPSILON = 1e-8;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, payload) => { fs.writeFileSync(filePath, JSON.stringify(payload, null, 2)); };
const ensureDir = (dirPath) => { if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true }); };
const isValidNumber = (value) => typeof value === "number" && Number.isFinite(value);

const sigmoid = (value) => { if (value >= 0) { const z = Math.exp(-value); return 1 / (1 + z); } const z = Math.exp(value); return z / (1 + z); };
const clipGradient = (value) => { if (value > GRADIENT_CLIP_VALUE) return GRADIENT_CLIP_VALUE; if (value < -GRADIENT_CLIP_VALUE) return -GRADIENT_CLIP_VALUE; return value; };

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let value = Math.imul(t ^ (t >>> 15), 1 | t); value ^= value + Math.imul(value ^ (value >>> 7), 61 | value); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; };
};

const randomNormal = (rng) => { const u1 = Math.max(rng(), Number.EPSILON); const u2 = rng(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };

const shuffle = (items, rng) => {
  for (let index = items.length - 1; index > 0; index -= 1) { const swapIndex = Math.floor(rng() * (index + 1)); [items[index], items[swapIndex]] = [items[swapIndex], items[index]]; }
  return items;
};

const temporalFrameIndices = () => {
  if (TEMPORAL_STEPS === 1) return [SEQUENCE_LENGTH - 1];
  return Array.from({ length: TEMPORAL_STEPS }, (_, index) => Math.round((index * (SEQUENCE_LENGTH - 1)) / (TEMPORAL_STEPS - 1)));
};

const buildSparseFrame = (frame) => {
  if (!Array.isArray(frame) || frame.length !== FEATURE_DIMENSION) throw new Error("Frame dimension mismatch.");
  const indices = []; const values = [];
  for (let fi = 0; fi < FEATURE_DIMENSION; fi += 1) {
    const value = frame[fi];
    if (!isValidNumber(value)) throw new Error("Invalid feature value.");
    if (value !== 0) { indices.push(fi); values.push(value); }
  }
  return { indices: Uint16Array.from(indices), values: Float32Array.from(values) };
};

const loadSplit = (splitName, labelsData, frameIndices, excludeSigner) => {
  const splitPath = path.join(INPUT_DIR, `${splitName}.json`);
  const payload = readJson(splitPath);
  if (payload.sequenceLength !== SEQUENCE_LENGTH) throw new Error("Sequence length mismatch.");
  if (payload.featureDimension !== FEATURE_DIMENSION) throw new Error("Feature dimension mismatch.");
  if (!Array.isArray(payload.samples) || payload.samples.length === 0) throw new Error("No samples.");
  return payload.samples
    .filter((sample) => sample.signerId !== excludeSigner)
    .map((sample) => ({
      label: sample.label, labelId: sample.labelId, signerId: sample.signerId,
      frames: frameIndices.map((frameIndex) => buildSparseFrame(sample.sequence[frameIndex]))
    }));
};

const loadSignerSamples = (signerId, labelsData, frameIndices) => {
  const allSamples = [];
  for (const splitName of ["train", "validation", "test"]) {
    const splitPath = path.join(INPUT_DIR, `${splitName}.json`);
    const payload = readJson(splitPath);
    const matches = payload.samples.filter((s) => s.signerId === signerId);
    for (const sample of matches) {
      allSamples.push({
        label: sample.label, labelId: sample.labelId, signerId: sample.signerId,
        frames: frameIndices.map((frameIndex) => buildSparseFrame(sample.sequence[frameIndex]))
      });
    }
  }
  return allSamples;
};

const createLstmWeights = (rng, inputSize) => {
  const gateSize = HIDDEN_SIZE * 4;
  const wx = new Float32Array(inputSize * gateSize);
  const wh = new Float32Array(HIDDEN_SIZE * gateSize);
  const b = new Float32Array(gateSize);
  const wxScale = Math.sqrt(1 / inputSize);
  const whScale = Math.sqrt(1 / HIDDEN_SIZE);
  for (let index = 0; index < wx.length; index += 1) wx[index] = randomNormal(rng) * wxScale;
  for (let index = 0; index < wh.length; index += 1) wh[index] = randomNormal(rng) * whScale;
  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) b[HIDDEN_SIZE + hiddenIndex] = 1;
  return { wx, wh, b };
};

const createModel = (outputClasses) => {
  const rng = mulberry32(RANDOM_SEED);
  const fwd = createLstmWeights(rng, FEATURE_DIMENSION);
  const bwd = createLstmWeights(rng, FEATURE_DIMENSION);
  const wyScale = Math.sqrt(2 / COMBINED_SIZE);
  const wy = new Float32Array(COMBINED_SIZE * outputClasses);
  const by = new Float32Array(outputClasses);
  for (let index = 0; index < wy.length; index += 1) wy[index] = randomNormal(rng) * wyScale;
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
    for (let itemIndex = 0; itemIndex < frame.indices.length; itemIndex += 1) {
      const inputIndex = frame.indices[itemIndex]; const inputValue = frame.values[itemIndex]; const inputOffset = inputIndex * gateSize;
      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) z[gateIndex] += inputValue * wx[inputOffset + gateIndex];
    }
    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const hiddenValue = hPrev[hiddenIndex]; if (hiddenValue === 0) continue;
      const hiddenOffset = hiddenIndex * gateSize;
      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) z[gateIndex] += hiddenValue * wh[hiddenOffset + gateIndex];
    }
    const inputGate = new Float32Array(HIDDEN_SIZE); const forgetGate = new Float32Array(HIDDEN_SIZE);
    const candidate = new Float32Array(HIDDEN_SIZE); const outputGate = new Float32Array(HIDDEN_SIZE);
    const c = new Float32Array(HIDDEN_SIZE); const h = new Float32Array(HIDDEN_SIZE);
    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const i = sigmoid(z[hiddenIndex]); const f = sigmoid(z[HIDDEN_SIZE + hiddenIndex]);
      const g = Math.tanh(z[HIDDEN_SIZE * 2 + hiddenIndex]); const o = sigmoid(z[HIDDEN_SIZE * 3 + hiddenIndex]);
      const cellValue = f * cPrev[hiddenIndex] + i * g;
      inputGate[hiddenIndex] = i; forgetGate[hiddenIndex] = f; candidate[hiddenIndex] = g;
      outputGate[hiddenIndex] = o; c[hiddenIndex] = cellValue; h[hiddenIndex] = o * Math.tanh(cellValue);
    }
    caches.push({ frame, hPrev, cPrev, inputGate, forgetGate, candidate, outputGate, c, h });
    hPrev = h; cPrev = c;
  }
  return { finalH: caches[caches.length - 1].h, caches };
};

const createDropoutMask = (size, rng) => {
  const mask = new Float32Array(size);
  if (DROPOUT_RATE <= 0) { mask.fill(1); return mask; }
  const keepProbability = 1 - DROPOUT_RATE; const scale = 1 / keepProbability;
  for (let index = 0; index < size; index += 1) mask[index] = rng() < keepProbability ? scale : 0;
  return mask;
};

const forward = (model, sample, { training = false, rng = null } = {}) => {
  const fwdResult = lstmForward(sample.frames, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b, false);
  const bwdResult = lstmForward(sample.frames, model.lstmBwd.wx, model.lstmBwd.wh, model.lstmBwd.b, true);
  const combined = new Float32Array(COMBINED_SIZE);
  combined.set(fwdResult.finalH); combined.set(bwdResult.finalH, HIDDEN_SIZE);
  const dropoutMask = training ? createDropoutMask(COMBINED_SIZE, rng) : null;
  const classifierInput = new Float32Array(COMBINED_SIZE);
  for (let index = 0; index < COMBINED_SIZE; index += 1) classifierInput[index] = combined[index] * (dropoutMask?.[index] ?? 1);
  const logits = new Float32Array(model.outputClasses);
  logits.set(model.by);
  for (let hiddenIndex = 0; hiddenIndex < COMBINED_SIZE; hiddenIndex += 1) {
    const hiddenValue = classifierInput[hiddenIndex]; const outputOffset = hiddenIndex * model.outputClasses;
    for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) logits[classIndex] += hiddenValue * model.wy[outputOffset + classIndex];
  }
  let maxLogit = Number.NEGATIVE_INFINITY; for (const logit of logits) maxLogit = Math.max(maxLogit, logit);
  const probabilities = new Float32Array(model.outputClasses); let probabilitySum = 0;
  for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) { const probability = Math.exp(logits[classIndex] - maxLogit); probabilities[classIndex] = probability; probabilitySum += probability; }
  for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) probabilities[classIndex] /= probabilitySum;
  return { fwdResult, bwdResult, classifierInput, dropoutMask, probabilities };
};

const predictionFromProbabilities = (probabilities) => {
  let predictedClass = 0; let predictedProbability = probabilities[0];
  for (let classIndex = 1; classIndex < probabilities.length; classIndex += 1) { if (probabilities[classIndex] > predictedProbability) { predictedClass = classIndex; predictedProbability = probabilities[classIndex]; } }
  return predictedClass;
};

const evaluate = (model, samples, labels) => {
  const confusionMatrix = Array.from({ length: labels.length }, () => new Array(labels.length).fill(0));
  let correct = 0, loss = 0;
  for (const sample of samples) {
    const { probabilities } = forward(model, sample);
    const predictedClass = predictionFromProbabilities(probabilities);
    loss += -Math.log(Math.max(probabilities[sample.labelId], Number.EPSILON));
    correct += predictedClass === sample.labelId ? 1 : 0;
    confusionMatrix[sample.labelId][predictedClass] += 1;
  }
  const metrics = { sampleCount: samples.length, loss: loss / samples.length, accuracy: correct / samples.length };
  let macroF1 = 0; let weightedF1 = 0; let totalSupport = 0;
  for (let classIndex = 0; classIndex < labels.length; classIndex += 1) {
    const tp = confusionMatrix[classIndex][classIndex]; let fp = 0, fn = 0, support = 0;
    for (let otherIndex = 0; otherIndex < labels.length; otherIndex += 1) { if (otherIndex !== classIndex) { fp += confusionMatrix[otherIndex][classIndex]; fn += confusionMatrix[classIndex][otherIndex]; } support += confusionMatrix[classIndex][otherIndex]; }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp); const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    macroF1 += f1; weightedF1 += f1 * support; totalSupport += support;
  }
  metrics.macroF1 = macroF1 / labels.length;
  metrics.weightedF1 = totalSupport === 0 ? 0 : weightedF1 / totalSupport;
  return metrics;
};

const applyAdam = (weights, gradients, firstMoment, secondMoment, step, beta1Power, beta2Power) => {
  for (let index = 0; index < weights.length; index += 1) {
    const gradient = gradients[index]; if (gradient === 0) continue;
    firstMoment[index] = BETA_1 * firstMoment[index] + (1 - BETA_1) * gradient;
    secondMoment[index] = BETA_2 * secondMoment[index] + (1 - BETA_2) * gradient * gradient;
    const correctedFirstMoment = firstMoment[index] / (1 - beta1Power);
    const correctedSecondMoment = secondMoment[index] / (1 - beta2Power);
    weights[index] -= (LEARNING_RATE * correctedFirstMoment) / (Math.sqrt(correctedSecondMoment) + EPSILON);
  }
};

const lstmBptt = (caches, dhNext, dcNext, wx, wh, b) => {
  const gateSize = HIDDEN_SIZE * 4;
  const grads = { wx: new Float32Array(wx.length), wh: new Float32Array(wh.length), b: new Float32Array(b.length) };
  for (let timeIndex = caches.length - 1; timeIndex >= 0; timeIndex -= 1) {
    const cache = caches[timeIndex]; const dz = new Float32Array(gateSize);
    const dhPrev = new Float32Array(HIDDEN_SIZE); const dcPrev = new Float32Array(HIDDEN_SIZE);
    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const cellValue = cache.c[hiddenIndex]; const tanhCell = Math.tanh(cellValue);
      const dh = dhNext[hiddenIndex]; const dc = dcNext[hiddenIndex] + dh * cache.outputGate[hiddenIndex] * (1 - tanhCell * tanhCell);
      const outputGateGradient = dh * tanhCell; const inputGateGradient = dc * cache.candidate[hiddenIndex];
      const candidateGradient = dc * cache.inputGate[hiddenIndex]; const forgetGateGradient = dc * cache.cPrev[hiddenIndex];
      dz[hiddenIndex] = clipGradient(inputGateGradient * cache.inputGate[hiddenIndex] * (1 - cache.inputGate[hiddenIndex]));
      dz[HIDDEN_SIZE + hiddenIndex] = clipGradient(forgetGateGradient * cache.forgetGate[hiddenIndex] * (1 - cache.forgetGate[hiddenIndex]));
      dz[HIDDEN_SIZE * 2 + hiddenIndex] = clipGradient(candidateGradient * (1 - cache.candidate[hiddenIndex] * cache.candidate[hiddenIndex]));
      dz[HIDDEN_SIZE * 3 + hiddenIndex] = clipGradient(outputGateGradient * cache.outputGate[hiddenIndex] * (1 - cache.outputGate[hiddenIndex]));
      dcPrev[hiddenIndex] = dc * cache.forgetGate[hiddenIndex];
    }
    for (let itemIndex = 0; itemIndex < cache.frame.indices.length; itemIndex += 1) {
      const inputIndex = cache.frame.indices[itemIndex]; const inputValue = cache.frame.values[itemIndex]; const inputOffset = inputIndex * gateSize;
      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) grads.wx[inputOffset + gateIndex] += inputValue * dz[gateIndex];
    }
    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const hiddenOffset = hiddenIndex * gateSize;
      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) { grads.wh[hiddenOffset + gateIndex] += cache.hPrev[hiddenIndex] * dz[gateIndex]; dhPrev[hiddenIndex] += wh[hiddenOffset + gateIndex] * dz[gateIndex]; }
    }
    for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) grads.b[gateIndex] += dz[gateIndex];
    dhNext.set(dhPrev); dcNext.set(dcPrev);
  }
  for (const gradientArray of Object.values(grads)) { for (let index = 0; index < gradientArray.length; index += 1) gradientArray[index] = clipGradient(gradientArray[index]); }
  return grads;
};

const updateModel = (model, gradients) => {
  model.optStep += 1; model.optBeta1Power *= BETA_1; model.optBeta2Power *= BETA_2;
  const apply = (weights, grads, mArr, vArr) => { applyAdam(weights, grads, mArr, vArr, model.optStep, model.optBeta1Power, model.optBeta2Power); };
  apply(model.lstmFwd.wx, gradients.fwd.wx, model.optFwdWx.m, model.optFwdWx.v);
  apply(model.lstmFwd.wh, gradients.fwd.wh, model.optFwdWh.m, model.optFwdWh.v);
  apply(model.lstmFwd.b, gradients.fwd.b, model.optFwdB.m, model.optFwdB.v);
  apply(model.lstmBwd.wx, gradients.bwd.wx, model.optBwdWx.m, model.optBwdWx.v);
  apply(model.lstmBwd.wh, gradients.bwd.wh, model.optBwdWh.m, model.optBwdWh.v);
  apply(model.lstmBwd.b, gradients.bwd.b, model.optBwdB.m, model.optBwdB.v);
  apply(model.wy, gradients.wy, model.optWy.m, model.optWy.v);
  apply(model.by, gradients.by, model.optBy.m, model.optBy.v);
};

const trainSample = (model, sample, rng) => {
  const { fwdResult, bwdResult, classifierInput, dropoutMask, probabilities } = forward(model, sample, { training: true, rng });
  const loss = -Math.log(Math.max(probabilities[sample.labelId], Number.EPSILON));
  const predictedClass = predictionFromProbabilities(probabilities);
  const deltaOutput = Float32Array.from(probabilities); deltaOutput[sample.labelId] -= 1;
  const grads = {
    fwd: { wx: new Float32Array(model.lstmFwd.wx.length), wh: new Float32Array(model.lstmFwd.wh.length), b: new Float32Array(model.lstmFwd.b.length) },
    bwd: { wx: new Float32Array(model.lstmBwd.wx.length), wh: new Float32Array(model.lstmBwd.wh.length), b: new Float32Array(model.lstmBwd.b.length) },
    wy: new Float32Array(model.wy.length), by: new Float32Array(model.by.length)
  };
  for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) grads.by[classIndex] += deltaOutput[classIndex];
  const deltaHidden = new Float32Array(COMBINED_SIZE);
  for (let hiddenIndex = 0; hiddenIndex < COMBINED_SIZE; hiddenIndex += 1) {
    const outputOffset = hiddenIndex * model.outputClasses; let gradient = 0;
    for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) { grads.wy[outputOffset + classIndex] += classifierInput[hiddenIndex] * deltaOutput[classIndex]; gradient += model.wy[outputOffset + classIndex] * deltaOutput[classIndex]; }
    deltaHidden[hiddenIndex] = gradient * (dropoutMask?.[hiddenIndex] ?? 1);
  }
  const dhNextFwd = new Float32Array(HIDDEN_SIZE); const dhNextBwd = new Float32Array(HIDDEN_SIZE);
  for (let i = 0; i < HIDDEN_SIZE; i += 1) { dhNextFwd[i] = deltaHidden[i]; dhNextBwd[i] = deltaHidden[HIDDEN_SIZE + i]; }
  const dcNextFwd = new Float32Array(HIDDEN_SIZE); const dcNextBwd = new Float32Array(HIDDEN_SIZE);
  const fwdGrads = lstmBptt(fwdResult.caches, dhNextFwd, dcNextFwd, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b);
  const bwdGrads = lstmBptt(bwdResult.caches, dhNextBwd, dcNextBwd, model.lstmBwd.wx, model.lstmBwd.wh, model.lstmBwd.b);
  grads.fwd.wx.set(fwdGrads.wx); grads.fwd.wh.set(fwdGrads.wh); grads.fwd.b.set(fwdGrads.b);
  grads.bwd.wx.set(bwdGrads.wx); grads.bwd.wh.set(bwdGrads.wh); grads.bwd.b.set(bwdGrads.b);
  updateModel(model, grads);
  return { loss, correct: predictedClass === sample.labelId ? 1 : 0 };
};

const formatPercent = (value) => `${(value * 100).toFixed(2)}%`;

const evaluateCrossSigner = (signerId, labelsData) => {
  const frameIndices = temporalFrameIndices();
  const trainingSamples = loadSplit("train", labelsData, frameIndices, signerId);
  const validationSamples = loadSplit("validation", labelsData, frameIndices, signerId);
  const testSamples = loadSignerSamples(signerId, labelsData, frameIndices);

  console.log(`\n=== Leave-${signerId}-Out Evaluation ===`);
  console.log(`Training samples: ${trainingSamples.length}, Validation: ${validationSamples.length}, Test (${signerId}): ${testSamples.length}`);

  if (testSamples.length === 0) { console.log(`Skipping ${signerId}: no samples found.`); return null; }

  const model = createModel(labelsData.labels.length);
  const trainRng = mulberry32(RANDOM_SEED + 1);
  let bestValLoss = Number.POSITIVE_INFINITY;
  let patienceCounter = 0;

  for (let epoch = 1; epoch <= EPOCHS; epoch += 1) {
    const order = shuffle(Array.from({ length: trainingSamples.length }, (_, index) => index), trainRng);
    let trainLoss = 0, trainCorrect = 0;
    for (const sampleIndex of order) {
      const result = trainSample(model, trainingSamples[sampleIndex], trainRng);
      trainLoss += result.loss; trainCorrect += result.correct;
    }
    const valMetrics = evaluate(model, validationSamples, labelsData.labels);
    console.log(`Epoch ${epoch}/${EPOCHS} - loss ${(trainLoss / trainingSamples.length).toFixed(4)} acc ${formatPercent(trainCorrect / trainingSamples.length)} val_loss ${valMetrics.loss.toFixed(4)} val_acc ${formatPercent(valMetrics.accuracy)}`);

    if (valMetrics.loss < bestValLoss - MIN_VALIDATION_DELTA) { bestValLoss = valMetrics.loss; patienceCounter = 0; }
    else { patienceCounter += 1; if (patienceCounter >= EARLY_STOPPING_PATIENCE) { console.log(`Early stopping after ${epoch} epochs.`); break; } }
  }

  const testMetrics = evaluate(model, testSamples, labelsData.labels);
  console.log(`\n${signerId} Results: acc ${formatPercent(testMetrics.accuracy)} macro_f1 ${formatPercent(testMetrics.macroF1)} weighted_f1 ${formatPercent(testMetrics.weightedF1)}`);

  return { signerId, testSamples: testSamples.length, accuracy: testMetrics.accuracy, macroF1: testMetrics.macroF1, weightedF1: testMetrics.weightedF1, loss: testMetrics.loss };
};

const main = () => {
  const metadata = readJson(path.join(INPUT_DIR, "metadata.json"));
  const labelsData = readJson(path.join(INPUT_DIR, "labels.json"));
  const signers = metadata.signers;
  console.log(`Cross-signer evaluation on ${signers.length} signers: ${signers.join(", ")}`);

  const results = [];
  for (const signerId of signers) {
    const result = evaluateCrossSigner(signerId, labelsData);
    if (result) results.push(result);
  }

  const avgAcc = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
  const avgMacroF1 = results.reduce((sum, r) => sum + r.macroF1, 0) / results.length;
  const avgWeightedF1 = results.reduce((sum, r) => sum + r.weightedF1, 0) / results.length;

  console.log("\n=== Cross-Signer Evaluation Summary ===");
  console.log(`| Signer | Samples | Accuracy | Macro F1 | Weighted F1 |`);
  console.log(`|--------|---------|----------|----------|-------------|`);
  for (const r of results) {
    console.log(`| ${r.signerId} | ${r.testSamples} | ${formatPercent(r.accuracy)} | ${formatPercent(r.macroF1)} | ${formatPercent(r.weightedF1)} |`);
  }
  console.log(`| AVG    | -       | ${formatPercent(avgAcc)} | ${formatPercent(avgMacroF1)} | ${formatPercent(avgWeightedF1)} |`);

  ensureDir(OUTPUT_DIR);
  writeJson(path.join(OUTPUT_DIR, "cross_signer_results.json"), {
    datasetSize: metadata.totalSamples,
    numSigners: signers.length,
    signers,
    trainingEpochs: EPOCHS,
    results,
    average: { accuracy: avgAcc, macroF1: avgMacroF1, weightedF1: avgWeightedF1 },
    createdAt: new Date().toISOString()
  });

  console.log(`\nResults saved to ${OUTPUT_DIR}`);
};

try { main(); } catch (error) { console.error("Cross-signer evaluation failed:", error instanceof Error ? error.message : error); process.exit(1); }
