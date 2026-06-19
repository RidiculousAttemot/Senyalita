import fs from "fs";
import path from "path";

const ALPHA_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_v2");
const FSL_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_105");
const AUG_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_unified_augmented");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_unified", "bilstm_v2");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const RANDOM_SEED = 2026;
const TEMPORAL_STEPS = Number.parseInt(process.env.UNIFIED_TEMPORAL_STEPS ?? "35", 10);
const HIDDEN_SIZE = Number.parseInt(process.env.UNIFIED_HIDDEN_SIZE ?? "48", 10);
const COMBINED_SIZE = HIDDEN_SIZE * 2;
const EPOCHS = Number.parseInt(process.env.UNIFIED_EPOCHS ?? "80", 10);
const BASE_LEARNING_RATE = Number.parseFloat(process.env.UNIFIED_LEARNING_RATE ?? "0.002");
const DROPOUT_RATE = Number.parseFloat(process.env.UNIFIED_DROPOUT ?? "0.25");
const EARLY_STOPPING_PATIENCE = Number.parseInt(process.env.UNIFIED_PATIENCE ?? "15", 10);
const MIN_VALIDATION_DELTA = 0.0001;
const GRADIENT_CLIP_VALUE = 1;
const BETA_1 = 0.9;
const BETA_2 = 0.999;
const EPSILON = 1e-8;
const LABEL_SMOOTHING = Number.parseFloat(process.env.UNIFIED_LABEL_SMOOTHING ?? "0.1");
const USE_AUGMENTED = process.env.UNIFIED_USE_AUGMENTED === "true";

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, payload) => fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
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
    const value = frame[fi]; if (!isValidNumber(value)) throw new Error("Invalid feature value.");
    if (value !== 0) { indices.push(fi); values.push(value); }
  }
  return { indices: Uint16Array.from(indices), values: Float32Array.from(values) };
};

const loadSplit = (samples, frameIndices) => {
  return samples.map((sample) => ({
    label: sample.label, labelId: sample.labelId,
    signerId: sample.signerId,
    frames: frameIndices.map((frameIndex) => buildSparseFrame(sample.sequence[frameIndex]))
  }));
};

const createLstmWeights = (rng, hiddenSize) => {
  const gateSize = hiddenSize * 4;
  const wx = new Float32Array(FEATURE_DIMENSION * gateSize); const wh = new Float32Array(hiddenSize * gateSize); const b = new Float32Array(gateSize);
  const wxScale = Math.sqrt(1 / FEATURE_DIMENSION); const whScale = Math.sqrt(1 / hiddenSize);
  for (let index = 0; index < wx.length; index += 1) wx[index] = randomNormal(rng) * wxScale;
  for (let index = 0; index < wh.length; index += 1) wh[index] = randomNormal(rng) * whScale;
  for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) b[hiddenSize + hiddenIndex] = 1;
  return { wx, wh, b };
};

const createModel = (outputClasses) => {
  const rng = mulberry32(RANDOM_SEED);
  const fwd = createLstmWeights(rng, HIDDEN_SIZE); const bwd = createLstmWeights(rng, HIDDEN_SIZE);
  const wyScale = Math.sqrt(2 / COMBINED_SIZE);
  const wy = new Float32Array(COMBINED_SIZE * outputClasses); const by = new Float32Array(outputClasses);
  for (let index = 0; index < wy.length; index += 1) wy[index] = randomNormal(rng) * wyScale;
  const opt = (size) => ({ m: new Float32Array(size), v: new Float32Array(size) });
  return {
    lstmFwd: { wx: fwd.wx, wh: fwd.wh, b: fwd.b }, lstmBwd: { wx: bwd.wx, wh: bwd.wh, b: bwd.b },
    wy, by, outputClasses,
    optFwdWx: opt(fwd.wx.length), optFwdWh: opt(fwd.wh.length), optFwdB: opt(fwd.b.length),
    optBwdWx: opt(bwd.wx.length), optBwdWh: opt(bwd.wh.length), optBwdB: opt(bwd.b.length),
    optWy: opt(wy.length), optBy: opt(by.length),
    optStep: 0, optBeta1Power: 1, optBeta2Power: 1
  };
};

const lstmForward = (frames, wx, wh, b, reverse) => {
  const gateSize = HIDDEN_SIZE * 4;
  let hPrev = new Float32Array(HIDDEN_SIZE); let cPrev = new Float32Array(HIDDEN_SIZE);
  const caches = []; const sequence = reverse ? [...frames].reverse() : frames;
  for (const frame of sequence) {
    const z = new Float32Array(gateSize); z.set(b);
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
      inputGate[hiddenIndex] = i; forgetGate[hiddenIndex] = f; candidate[hiddenIndex] = g; outputGate[hiddenIndex] = o;
      c[hiddenIndex] = cellValue; h[hiddenIndex] = o * Math.tanh(cellValue);
    }
    caches.push({ frame, hPrev, cPrev, inputGate, forgetGate, candidate, outputGate, c, h });
    hPrev = h; cPrev = c;
  }
  return { finalH: caches[caches.length - 1].h, caches };
};

const createDropoutMask = (size, rng) => {
  const mask = new Float32Array(size); if (DROPOUT_RATE <= 0) { mask.fill(1); return mask; }
  const keepProbability = 1 - DROPOUT_RATE; const scale = 1 / keepProbability;
  for (let index = 0; index < size; index += 1) mask[index] = rng() < keepProbability ? scale : 0;
  return mask;
};

const forward = (model, sample, { training = false, rng = null } = {}) => {
  const fwdResult = lstmForward(sample.frames, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b, false);
  const bwdResult = lstmForward(sample.frames, model.lstmBwd.wx, model.lstmBwd.wh, model.lstmBwd.b, true);
  const combined = new Float32Array(COMBINED_SIZE); combined.set(fwdResult.finalH); combined.set(bwdResult.finalH, HIDDEN_SIZE);
  const dropoutMask = training ? createDropoutMask(COMBINED_SIZE, rng) : null;
  const classifierInput = new Float32Array(COMBINED_SIZE);
  for (let index = 0; index < COMBINED_SIZE; index += 1) classifierInput[index] = combined[index] * (dropoutMask?.[index] ?? 1);
  const logits = new Float32Array(model.outputClasses); logits.set(model.by);
  for (let hiddenIndex = 0; hiddenIndex < COMBINED_SIZE; hiddenIndex += 1) {
    const hiddenValue = classifierInput[hiddenIndex]; const outputOffset = hiddenIndex * model.outputClasses;
    for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) logits[classIndex] += hiddenValue * model.wy[outputOffset + classIndex];
  }
  let maxLogit = Number.NEGATIVE_INFINITY; for (const logit of logits) maxLogit = Math.max(maxLogit, logit);
  const probabilities = new Float32Array(model.outputClasses); let probabilitySum = 0;
  for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) { const p = Math.exp(logits[classIndex] - maxLogit); probabilities[classIndex] = p; probabilitySum += p; }
  for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) probabilities[classIndex] /= probabilitySum;
  return { fwdResult, bwdResult, classifierInput, dropoutMask, probabilities, logits };
};

const predictionFromProbabilities = (probabilities) => {
  let predictedClass = 0; let predictedProbability = probabilities[0];
  for (let classIndex = 1; classIndex < probabilities.length; classIndex += 1) { if (probabilities[classIndex] > predictedProbability) { predictedClass = classIndex; predictedProbability = probabilities[classIndex]; } }
  return predictedClass;
};

const computeClassWeights = (samples, numClasses) => {
  const counts = new Array(numClasses).fill(0);
  for (const s of samples) counts[s.labelId] += 1;
  const maxCount = Math.max(...counts);
  return counts.map((c) => c > 0 ? maxCount / c : 1.0);
};

const computeSmoothedTarget = (labelId, numClasses, smoothing) => {
  const smoothTarget = new Float32Array(numClasses);
  const eps = smoothing / numClasses;
  const confident = 1 - smoothing + eps;
  for (let i = 0; i < numClasses; i++) smoothTarget[i] = eps;
  smoothTarget[labelId] = confident;
  return smoothTarget;
};

const computeLoss = (probabilities, labelId, numClasses, smoothing) => {
  const pt = Math.max(probabilities[labelId], Number.EPSILON);
  const nll = -Math.log(pt);
  if (smoothing <= 0) return nll;
  const target = computeSmoothedTarget(labelId, numClasses, smoothing);
  let klLoss = 0;
  for (let i = 0; i < numClasses; i++) {
    klLoss -= target[i] * Math.log(Math.max(probabilities[i], Number.EPSILON));
  }
  return klLoss;
};

const applyAdam = (weights, gradients, firstMoment, secondMoment, step, beta1Power, beta2Power, lr) => {
  for (let index = 0; index < weights.length; index += 1) {
    const gradient = gradients[index]; if (gradient === 0) continue;
    firstMoment[index] = BETA_1 * firstMoment[index] + (1 - BETA_1) * gradient;
    secondMoment[index] = BETA_2 * secondMoment[index] + (1 - BETA_2) * gradient * gradient;
    const correctedFirstMoment = firstMoment[index] / (1 - beta1Power);
    const correctedSecondMoment = secondMoment[index] / (1 - beta2Power);
    weights[index] -= (lr * correctedFirstMoment) / (Math.sqrt(correctedSecondMoment) + EPSILON);
  }
};

const cosineDecay = (epoch, totalEpochs, baseLr) => {
  const progress = epoch / totalEpochs;
  return baseLr * 0.5 * (1 + Math.cos(Math.PI * progress));
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

const updateModel = (model, gradients, lr) => {
  model.optStep += 1; model.optBeta1Power *= BETA_1; model.optBeta2Power *= BETA_2;
  const apply = (weights, g, mArr, vArr) => { applyAdam(weights, g, mArr, vArr, model.optStep, model.optBeta1Power, model.optBeta2Power, lr); };
  apply(model.lstmFwd.wx, gradients.fwd.wx, model.optFwdWx.m, model.optFwdWx.v);
  apply(model.lstmFwd.wh, gradients.fwd.wh, model.optFwdWh.m, model.optFwdWh.v);
  apply(model.lstmFwd.b, gradients.fwd.b, model.optFwdB.m, model.optFwdB.v);
  apply(model.lstmBwd.wx, gradients.bwd.wx, model.optBwdWx.m, model.optBwdWx.v);
  apply(model.lstmBwd.wh, gradients.bwd.wh, model.optBwdWh.m, model.optBwdWh.v);
  apply(model.lstmBwd.b, gradients.bwd.b, model.optBwdB.m, model.optBwdB.v);
  apply(model.wy, gradients.wy, model.optWy.m, model.optWy.v);
  apply(model.by, gradients.by, model.optBy.m, model.optBy.v);
};

const trainSampleFull = (model, sample, rng, classWeights, smoothing, lr, curriculumWeight) => {
  const { fwdResult, bwdResult, classifierInput, dropoutMask, probabilities } = forward(model, sample, { training: true, rng });

  const loss = computeLoss(probabilities, sample.labelId, model.outputClasses, smoothing);

  const predictedClass = predictionFromProbabilities(probabilities);

  const deltaOutput = Float32Array.from(probabilities);
  const target = smoothing > 0
    ? computeSmoothedTarget(sample.labelId, model.outputClasses, smoothing)
    : (() => { const t = new Float32Array(model.outputClasses); t[sample.labelId] = 1; return t; })();
  for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
    deltaOutput[classIndex] = (probabilities[classIndex] - target[classIndex]) * classWeights[sample.labelId] * curriculumWeight;
  }

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
  updateModel(model, grads, lr);
  return { loss, correct: predictedClass === sample.labelId ? 1 : 0 };
};

const createEmptyConfusionMatrix = (classCount) => Array.from({ length: classCount }, () => new Array(classCount).fill(0));

const computePerLabelMetrics = (confusionMatrix, labels) => {
  const perLabel = {}; let macroP = 0, macroR = 0, macroF1 = 0; let weightedP = 0, weightedR = 0, weightedF1 = 0; let totalSupport = 0;
  for (let classIndex = 0; classIndex < labels.length; classIndex += 1) {
    const tp = confusionMatrix[classIndex][classIndex]; let fp = 0, fn = 0, support = 0;
    for (let otherIndex = 0; otherIndex < labels.length; otherIndex += 1) { if (otherIndex !== classIndex) { fp += confusionMatrix[otherIndex][classIndex]; fn += confusionMatrix[classIndex][otherIndex]; } support += confusionMatrix[classIndex][otherIndex]; }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp); const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    perLabel[labels[classIndex]] = { precision, recall, f1, support }; macroP += precision; macroR += recall; macroF1 += f1;
    weightedP += precision * support; weightedR += recall * support; weightedF1 += f1 * support; totalSupport += support;
  }
  return { labels: perLabel, macroAverage: { precision: macroP / labels.length, recall: macroR / labels.length, f1: macroF1 / labels.length, support: totalSupport }, weightedAverage: { precision: totalSupport === 0 ? 0 : weightedP / totalSupport, recall: totalSupport === 0 ? 0 : weightedR / totalSupport, f1: totalSupport === 0 ? 0 : weightedF1 / totalSupport, support: totalSupport } };
};

const evaluate = (model, samples, labels) => {
  const confusionMatrix = createEmptyConfusionMatrix(labels.length); let correct = 0, loss = 0;
  for (const sample of samples) {
    const { probabilities } = forward(model, sample); const predictedClass = predictionFromProbabilities(probabilities);
    loss += -Math.log(Math.max(probabilities[sample.labelId], Number.EPSILON)); correct += predictedClass === sample.labelId ? 1 : 0;
    confusionMatrix[sample.labelId][predictedClass] += 1;
  }
  const metrics = computePerLabelMetrics(confusionMatrix, labels);
  return { sampleCount: samples.length, loss: loss / samples.length, accuracy: correct / samples.length, macroF1: metrics.macroAverage.f1, weightedF1: metrics.weightedAverage.f1, confusionMatrix, perLabelMetrics: metrics };
};

const roundedArray = (typedArray) => Array.from(typedArray, (value) => Number(value.toFixed(8)));

const saveOutputs = ({ labelsData, metadata, model, frameIndices, trainMetrics, valMetrics, testMetrics, history, bestValF1 }) => {
  ensureDir(OUTPUT_DIR);
  const createdAt = new Date().toISOString();
  const config = {
    modelType: "unified-bilstm-v2",
    description: "Enhanced BiLSTM v2 with label smoothing, class weighting, cosine LR decay, curriculum learning.",
    architecture: {
      recurrentLayers: [
        { type: "lstm", hiddenSize: HIDDEN_SIZE, direction: "forward", temporalSteps: TEMPORAL_STEPS, temporalFrameIndices: frameIndices, dropout: DROPOUT_RATE },
        { type: "lstm", hiddenSize: HIDDEN_SIZE, direction: "backward", temporalSteps: TEMPORAL_STEPS, temporalFrameIndices: frameIndices, dropout: DROPOUT_RATE }
      ],
      bidirectional: true, combinedSize: COMBINED_SIZE,
      classifier: { type: "dense-softmax", outputClasses: labelsData.labels.length }
    },
    datasetInfo: {
      totalSamples: (trainMetrics.sampleCount + valMetrics.sampleCount + testMetrics.sampleCount),
      alphabetSamples: metadata.splits.train.alphabet + metadata.splits.validation.alphabet + metadata.splits.test.alphabet,
      fslSamples: metadata.splits.train.fsl + metadata.splits.validation.fsl + metadata.splits.test.fsl,
      splits: metadata.splits
    },
    sequenceLength: SEQUENCE_LENGTH, featureDimension: FEATURE_DIMENSION,
    inputShape: [SEQUENCE_LENGTH, FEATURE_DIMENSION],
    outputClasses: labelsData.labels.length,
    optimizer: "adam", baseLearningRate: BASE_LEARNING_RATE, learningRateScheduler: "cosine-decay",
    epochsRequested: EPOCHS, epochsCompleted: history.length,
    earlyStoppingPatience: EARLY_STOPPING_PATIENCE, gradientClipValue: GRADIENT_CLIP_VALUE,
    labelSmoothing: LABEL_SMOOTHING, randomSeed: RANDOM_SEED,
    bestValF1,
    trainSamples: trainMetrics.sampleCount, valSamples: valMetrics.sampleCount, testSamples: testMetrics.sampleCount,
    createdAt
  };

  writeJson(path.join(OUTPUT_DIR, "labels.json"), labelsData);
  writeJson(path.join(OUTPUT_DIR, "config.json"), config);
  writeJson(path.join(OUTPUT_DIR, "metrics.json"), {
    trainAccuracy: trainMetrics.accuracy, valAccuracy: valMetrics.accuracy,
    testAccuracy: testMetrics.accuracy, testLoss: testMetrics.loss,
    macroF1: testMetrics.macroF1, weightedF1: testMetrics.weightedF1,
    train: trainMetrics, validation: valMetrics, test: testMetrics, history, bestValF1, createdAt
  });
  writeJson(path.join(OUTPUT_DIR, "training_history.json"), history);
  writeJson(path.join(OUTPUT_DIR, "confusion_matrix.json"), { labels: labelsData.labels, matrix: testMetrics.confusionMatrix });
  writeJson(path.join(OUTPUT_DIR, "model.json"), {
    artifactType: "unified-bilstm-v2", createdAt,
    labels: labelsData.labels,
    config, weights: {
      lstmFwd: { wx: roundedArray(model.lstmFwd.wx), wh: roundedArray(model.lstmFwd.wh), b: roundedArray(model.lstmFwd.b) },
      lstmBwd: { wx: roundedArray(model.lstmBwd.wx), wh: roundedArray(model.lstmBwd.wh), b: roundedArray(model.lstmBwd.b) },
      wy: roundedArray(model.wy), by: roundedArray(model.by)
    }
  });
};

const formatPercent = (value) => `${(value * 100).toFixed(2)}%`;

const main = () => {
  const alphabetLabels = readJson(path.join(ALPHA_DIR, "labels.json"));
  const fslLabels = readJson(path.join(FSL_DIR, "labels.json"));
  const metadata = readJson(path.join(process.cwd(), "datasets", "processed", "fsl_unified", "metadata.json"));

  const unifiedLabels = [...alphabetLabels.labels, ...fslLabels.labels];
  const alphaCount = alphabetLabels.labels.length;
  const labelsData = { labels: unifiedLabels };

  const outputClasses = unifiedLabels.length;
  const frameIndices = temporalFrameIndices();

  const alphaTrain = readJson(path.join(ALPHA_DIR, "train.json"));
  const alphaTest = readJson(path.join(ALPHA_DIR, "test.json"));
  const fslTrain = readJson(path.join(FSL_DIR, "train.json"));
  const fslTest = readJson(path.join(FSL_DIR, "test.json"));

  const remapFsl = (samples) => samples.map((s) => ({ ...s, labelId: s.labelId + alphaCount }));
  const fslTrainRaw = remapFsl(fslTrain.samples);
  const fslTestRaw = remapFsl(fslTest.samples);

  let augmentedTrainRaw = [];

  if (USE_AUGMENTED) {
    try {
      const augData = readJson(path.join(AUG_DIR, "train_augmented.json"));
      const remapAugLabel = (s) => {
        const labelId = alphabetLabels.labels.includes(s.label)
          ? alphabetLabels.labels.indexOf(s.label)
          : alphabetLabels.labels.length + (fslLabels.labels.indexOf(s.label));
        return { ...s, labelId };
      };
      augmentedTrainRaw = augData.trainSamples.map(remapAugLabel);
      console.log(`Loaded ${augmentedTrainRaw.length} augmented training samples from ${AUG_DIR}`);
    } catch {
      console.warn("Augmented data not found, falling back to original data only.");
    }
  }

  const allTrainRaw = [...alphaTrain.samples, ...fslTrainRaw, ...augmentedTrainRaw];
  const allTestRaw = [...alphaTest.samples, ...fslTestRaw];

  const rng = mulberry32(RANDOM_SEED + 1);
  const order = shuffle(Array.from({ length: alphaTrain.samples.length + fslTrainRaw.length }, (_, index) => index), rng);
  const valCount = Math.max(1, Math.floor((alphaTrain.samples.length + fslTrainRaw.length) * 0.15));
  const valOrder = new Set(order.slice(0, valCount));
  const trainBase = []; const valAll = [];
  const baseSamples = [...alphaTrain.samples, ...fslTrainRaw];
  for (let i = 0; i < baseSamples.length; i++) {
    if (valOrder.has(i)) valAll.push(baseSamples[i]);
    else trainBase.push(baseSamples[i]);
  }

  const trainAll = [...trainBase, ...augmentedTrainRaw];

  console.log("Training Unified BiLSTM v2 (Enhanced)");
  console.log(`Input shape: [${SEQUENCE_LENGTH}, ${FEATURE_DIMENSION}]`);
  console.log(`Temporal steps: ${TEMPORAL_STEPS}, Hidden size: ${HIDDEN_SIZE}, Combined: ${COMBINED_SIZE}`);
  console.log(`Classes: ${outputClasses}`);
  console.log(`Label smoothing: ${LABEL_SMOOTHING}`);
  console.log(`Using augmented data: ${USE_AUGMENTED} (${augmentedTrainRaw.length} additional samples)`);
  console.log(`Split: train=${trainAll.length}, val=${valAll.length}, test=${allTestRaw.length}`);

  const trainSamples = loadSplit(trainAll, frameIndices);
  const valSamples = loadSplit(valAll, frameIndices);
  const testSamples = loadSplit(allTestRaw, frameIndices);

  const classWeights = computeClassWeights(trainSamples, outputClasses);
  console.log(`Class weights range: ${classWeights.reduce((m, w) => Math.min(m, w), Infinity).toFixed(2)} - ${classWeights.reduce((m, w) => Math.max(m, w), 0).toFixed(2)}`);

  const model = createModel(outputClasses);
  const history = [];
  const trainRng = mulberry32(RANDOM_SEED + 2);
  let bestValF1 = 0;
  let bestValLoss = Number.POSITIVE_INFINITY;
  let epochsWithoutImprovement = 0;
  let bestModelState = null;

  for (let epoch = 1; epoch <= EPOCHS; epoch += 1) {
    const lr = cosineDecay(epoch - 1, EPOCHS, BASE_LEARNING_RATE);
    const curriculumWeight = Math.min(1, 0.5 + epoch / EPOCHS);

    const trainOrder = shuffle(Array.from({ length: trainSamples.length }, (_, index) => index), trainRng);
    let trainLoss = 0, trainCorrect = 0;
    for (const sampleIndex of trainOrder) {
      const result = trainSampleFull(model, trainSamples[sampleIndex], trainRng, classWeights, LABEL_SMOOTHING, lr, curriculumWeight);
      trainLoss += result.loss; trainCorrect += result.correct;
    }
    const valMetrics = evaluate(model, valSamples, unifiedLabels);
    const epochStats = {
      epoch, lr: Number(lr.toFixed(6)),
      trainLoss: trainLoss / trainSamples.length,
      trainAccuracy: trainCorrect / trainSamples.length,
      valLoss: valMetrics.loss,
      valAccuracy: valMetrics.accuracy,
      valMacroF1: valMetrics.macroF1,
    };
    history.push(epochStats);

    const isBestF1 = valMetrics.macroF1 > bestValF1 + MIN_VALIDATION_DELTA;
    const isBestLoss = valMetrics.loss < bestValLoss - MIN_VALIDATION_DELTA;

    if (isBestF1 || isBestLoss) {
      if (isBestF1) bestValF1 = valMetrics.macroF1;
      if (isBestLoss) bestValLoss = valMetrics.loss;
      epochsWithoutImprovement = 0;
      bestModelState = {
        lstmFwd: { wx: new Float32Array(model.lstmFwd.wx), wh: new Float32Array(model.lstmFwd.wh), b: new Float32Array(model.lstmFwd.b) },
        lstmBwd: { wx: new Float32Array(model.lstmBwd.wx), wh: new Float32Array(model.lstmBwd.wh), b: new Float32Array(model.lstmBwd.b) },
        wy: new Float32Array(model.wy), by: new Float32Array(model.by),
      };
    } else {
      epochsWithoutImprovement += 1;
    }

    console.log(`Epoch ${epoch}/${EPOCHS} lr=${lr.toFixed(6)} cw=${curriculumWeight.toFixed(2)} loss=${epochStats.trainLoss.toFixed(4)} acc=${formatPercent(epochStats.trainAccuracy)} val_loss=${epochStats.valLoss.toFixed(4)} val_acc=${formatPercent(epochStats.valAccuracy)} val_f1=${formatPercent(valMetrics.macroF1)}`);

    if (epochsWithoutImprovement >= EARLY_STOPPING_PATIENCE) {
      console.log(`Early stopping after ${epoch} epochs (no improvement for ${EARLY_STOPPING_PATIENCE} epochs).`);
      break;
    }
  }

  if (bestModelState) {
    model.lstmFwd.wx.set(bestModelState.lstmFwd.wx);
    model.lstmFwd.wh.set(bestModelState.lstmFwd.wh);
    model.lstmFwd.b.set(bestModelState.lstmFwd.b);
    model.lstmBwd.wx.set(bestModelState.lstmBwd.wx);
    model.lstmBwd.wh.set(bestModelState.lstmBwd.wh);
    model.lstmBwd.b.set(bestModelState.lstmBwd.b);
    model.wy.set(bestModelState.wy);
    model.by.set(bestModelState.by);
    console.log(`Restored best model from epoch with val F1=${formatPercent(bestValF1)}`);
  }

  const trainMetrics = evaluate(model, trainSamples, unifiedLabels);
  const valMetrics = evaluate(model, valSamples, unifiedLabels);
  const testMetrics = evaluate(model, testSamples, unifiedLabels);

  saveOutputs({ labelsData, metadata, model, frameIndices, trainMetrics, valMetrics, testMetrics, history, bestValF1 });

  console.log("\nUnified BiLSTM v2 training complete.");
  console.log(`Train accuracy: ${formatPercent(trainMetrics.accuracy)}`);
  console.log(`Val accuracy: ${formatPercent(valMetrics.accuracy)}`);
  console.log(`Test accuracy: ${formatPercent(testMetrics.accuracy)}`);
  console.log(`Test macro F1: ${formatPercent(testMetrics.macroF1)}`);
  console.log(`Test weighted F1: ${formatPercent(testMetrics.weightedF1)}`);
  console.log(`Best val F1: ${formatPercent(bestValF1)}`);
  console.log(`Outputs saved to ${OUTPUT_DIR}`);
};

main();
