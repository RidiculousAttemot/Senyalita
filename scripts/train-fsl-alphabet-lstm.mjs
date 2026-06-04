import fs from "fs";
import path from "path";

const INPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_alphabet", "lstm");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const OUTPUT_CLASSES = 28;
const RANDOM_SEED = 2026;
const TEMPORAL_STEPS = Number.parseInt(process.env.FSL_LSTM_TEMPORAL_STEPS ?? "30", 10);
const HIDDEN_SIZE = Number.parseInt(process.env.FSL_LSTM_HIDDEN_SIZE ?? "32", 10);
const EPOCHS = Number.parseInt(process.env.FSL_LSTM_EPOCHS ?? "45", 10);
const LEARNING_RATE = Number.parseFloat(process.env.FSL_LSTM_LEARNING_RATE ?? "0.002");
const DROPOUT_RATE = Number.parseFloat(process.env.FSL_LSTM_DROPOUT ?? "0.2");
const EARLY_STOPPING_PATIENCE = Number.parseInt(process.env.FSL_LSTM_PATIENCE ?? "10", 10);
const MIN_VALIDATION_DELTA = 0.0001;
const GRADIENT_CLIP_VALUE = 1;
const BETA_1 = 0.9;
const BETA_2 = 0.999;
const EPSILON = 1e-8;

const requiredFiles = [
  "labels.json",
  "metadata.json",
  "train.json",
  "validation.json",
  "test.json"
];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const writeJson = (filePath, payload) => {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const isValidNumber = (value) => typeof value === "number" && Number.isFinite(value);

const sigmoid = (value) => {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }

  const z = Math.exp(value);
  return z / (1 + z);
};

const clipGradient = (value) => {
  if (value > GRADIENT_CLIP_VALUE) {
    return GRADIENT_CLIP_VALUE;
  }
  if (value < -GRADIENT_CLIP_VALUE) {
    return -GRADIENT_CLIP_VALUE;
  }
  return value;
};

const validateRequiredFiles = () => {
  const missingFiles = requiredFiles.filter(
    (fileName) => !fs.existsSync(path.join(INPUT_DIR, fileName))
  );

  if (missingFiles.length > 0) {
    throw new Error(`Missing processed dataset files: ${missingFiles.join(", ")}`);
  }
};

const validateLabels = (labelsData) => {
  if (!labelsData || typeof labelsData !== "object") {
    throw new Error("labels.json is invalid.");
  }
  if (!Array.isArray(labelsData.labels) || labelsData.labels.length !== OUTPUT_CLASSES) {
    throw new Error(`Expected labels.json to contain ${OUTPUT_CLASSES} classes.`);
  }
  if (!labelsData.labelToId || typeof labelsData.labelToId !== "object") {
    throw new Error("labels.json missing labelToId mapping.");
  }
  if (!labelsData.idToLabel || typeof labelsData.idToLabel !== "object") {
    throw new Error("labels.json missing idToLabel mapping.");
  }

  for (const [index, label] of labelsData.labels.entries()) {
    if (labelsData.labelToId[label] !== index) {
      throw new Error(`labelToId mismatch for label ${label}.`);
    }
    if (labelsData.idToLabel[String(index)] !== label) {
      throw new Error(`idToLabel mismatch for id ${index}.`);
    }
  }
};

const validateMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object") {
    throw new Error("metadata.json is invalid.");
  }
  if (metadata.sequenceLength !== SEQUENCE_LENGTH) {
    throw new Error(`Expected sequenceLength ${SEQUENCE_LENGTH}.`);
  }
  if (metadata.featureDimension !== FEATURE_DIMENSION) {
    throw new Error(`Expected featureDimension ${FEATURE_DIMENSION}.`);
  }
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let value = Math.imul(t ^ (t >>> 15), 1 | t);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const randomNormal = (rng) => {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const shuffle = (items, rng) => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
};

const temporalFrameIndices = () => {
  if (TEMPORAL_STEPS === 1) {
    return [SEQUENCE_LENGTH - 1];
  }

  return Array.from({ length: TEMPORAL_STEPS }, (_, index) =>
    Math.round((index * (SEQUENCE_LENGTH - 1)) / (TEMPORAL_STEPS - 1))
  );
};

const buildSparseFrame = (frame) => {
  if (!Array.isArray(frame) || frame.length !== FEATURE_DIMENSION) {
    throw new Error("Frame feature dimension mismatch.");
  }

  const indices = [];
  const values = [];

  for (let featureIndex = 0; featureIndex < FEATURE_DIMENSION; featureIndex += 1) {
    const value = frame[featureIndex];
    if (!isValidNumber(value)) {
      throw new Error("Feature value must be a finite number.");
    }
    if (value !== 0) {
      indices.push(featureIndex);
      values.push(value);
    }
  }

  return {
    indices: Uint16Array.from(indices),
    values: Float32Array.from(values)
  };
};

const loadSplit = (splitName, labelsData, frameIndices) => {
  const splitPath = path.join(INPUT_DIR, `${splitName}.json`);
  const payload = readJson(splitPath);

  if (payload.sequenceLength !== SEQUENCE_LENGTH) {
    throw new Error(`${splitName}.json sequenceLength must be ${SEQUENCE_LENGTH}.`);
  }
  if (payload.featureDimension !== FEATURE_DIMENSION) {
    throw new Error(`${splitName}.json featureDimension must be ${FEATURE_DIMENSION}.`);
  }
  if (!Array.isArray(payload.samples) || payload.samples.length === 0) {
    throw new Error(`${splitName}.json has no samples.`);
  }

  return payload.samples.map((sample, sampleIndex) => {
    if (!sample || typeof sample !== "object") {
      throw new Error(`${splitName}.json sample ${sampleIndex} is invalid.`);
    }
    if (!Array.isArray(sample.sequence) || sample.sequence.length !== SEQUENCE_LENGTH) {
      throw new Error(`${splitName}.json sample ${sampleIndex} has invalid sequence length.`);
    }
    if (!Number.isInteger(sample.labelId)) {
      throw new Error(`${splitName}.json sample ${sampleIndex} has invalid labelId.`);
    }
    if (labelsData.labelToId[sample.label] !== sample.labelId) {
      throw new Error(`${splitName}.json sample ${sampleIndex} has label mapping mismatch.`);
    }

    return {
      label: sample.label,
      labelId: sample.labelId,
      frames: frameIndices.map((frameIndex) => buildSparseFrame(sample.sequence[frameIndex]))
    };
  });
};

const createModel = (outputClasses) => {
  const rng = mulberry32(RANDOM_SEED);
  const gateSize = HIDDEN_SIZE * 4;
  const wx = new Float32Array(FEATURE_DIMENSION * gateSize);
  const wh = new Float32Array(HIDDEN_SIZE * gateSize);
  const b = new Float32Array(gateSize);
  const wy = new Float32Array(HIDDEN_SIZE * outputClasses);
  const by = new Float32Array(outputClasses);
  const wxScale = Math.sqrt(1 / FEATURE_DIMENSION);
  const whScale = Math.sqrt(1 / HIDDEN_SIZE);
  const wyScale = Math.sqrt(2 / HIDDEN_SIZE);

  for (let index = 0; index < wx.length; index += 1) {
    wx[index] = randomNormal(rng) * wxScale;
  }
  for (let index = 0; index < wh.length; index += 1) {
    wh[index] = randomNormal(rng) * whScale;
  }
  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    b[HIDDEN_SIZE + hiddenIndex] = 1;
  }
  for (let index = 0; index < wy.length; index += 1) {
    wy[index] = randomNormal(rng) * wyScale;
  }

  return {
    wx,
    wh,
    b,
    wy,
    by,
    outputClasses,
    optimizer: {
      mwx: new Float32Array(wx.length),
      vwx: new Float32Array(wx.length),
      mwh: new Float32Array(wh.length),
      vwh: new Float32Array(wh.length),
      mb: new Float32Array(b.length),
      vb: new Float32Array(b.length),
      mwy: new Float32Array(wy.length),
      vwy: new Float32Array(wy.length),
      mby: new Float32Array(by.length),
      vby: new Float32Array(by.length),
      step: 0,
      beta1Power: 1,
      beta2Power: 1
    }
  };
};

const createZeroGradients = (model) => ({
  wx: new Float32Array(model.wx.length),
  wh: new Float32Array(model.wh.length),
  b: new Float32Array(model.b.length),
  wy: new Float32Array(model.wy.length),
  by: new Float32Array(model.by.length)
});

const createDropoutMask = (rng) => {
  const mask = new Float32Array(HIDDEN_SIZE);
  if (DROPOUT_RATE <= 0) {
    mask.fill(1);
    return mask;
  }

  const keepProbability = 1 - DROPOUT_RATE;
  const scale = 1 / keepProbability;
  for (let index = 0; index < HIDDEN_SIZE; index += 1) {
    mask[index] = rng() < keepProbability ? scale : 0;
  }

  return mask;
};

const forward = (model, sample, { training = false, rng = null } = {}) => {
  const gateSize = HIDDEN_SIZE * 4;
  let hPrev = new Float32Array(HIDDEN_SIZE);
  let cPrev = new Float32Array(HIDDEN_SIZE);
  const caches = [];

  for (const frame of sample.frames) {
    const z = new Float32Array(gateSize);
    z.set(model.b);

    for (let itemIndex = 0; itemIndex < frame.indices.length; itemIndex += 1) {
      const inputIndex = frame.indices[itemIndex];
      const inputValue = frame.values[itemIndex];
      const inputOffset = inputIndex * gateSize;

      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
        z[gateIndex] += inputValue * model.wx[inputOffset + gateIndex];
      }
    }

    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const hiddenValue = hPrev[hiddenIndex];
      if (hiddenValue === 0) {
        continue;
      }
      const hiddenOffset = hiddenIndex * gateSize;

      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
        z[gateIndex] += hiddenValue * model.wh[hiddenOffset + gateIndex];
      }
    }

    const inputGate = new Float32Array(HIDDEN_SIZE);
    const forgetGate = new Float32Array(HIDDEN_SIZE);
    const candidate = new Float32Array(HIDDEN_SIZE);
    const outputGate = new Float32Array(HIDDEN_SIZE);
    const c = new Float32Array(HIDDEN_SIZE);
    const h = new Float32Array(HIDDEN_SIZE);

    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const i = sigmoid(z[hiddenIndex]);
      const f = sigmoid(z[HIDDEN_SIZE + hiddenIndex]);
      const g = Math.tanh(z[HIDDEN_SIZE * 2 + hiddenIndex]);
      const o = sigmoid(z[HIDDEN_SIZE * 3 + hiddenIndex]);
      const cellValue = f * cPrev[hiddenIndex] + i * g;

      inputGate[hiddenIndex] = i;
      forgetGate[hiddenIndex] = f;
      candidate[hiddenIndex] = g;
      outputGate[hiddenIndex] = o;
      c[hiddenIndex] = cellValue;
      h[hiddenIndex] = o * Math.tanh(cellValue);
    }

    caches.push({
      frame,
      hPrev,
      cPrev,
      inputGate,
      forgetGate,
      candidate,
      outputGate,
      c,
      h
    });

    hPrev = h;
    cPrev = c;
  }

  const finalHidden = caches[caches.length - 1].h;
  const dropoutMask = training ? createDropoutMask(rng) : null;
  const classifierInput = new Float32Array(HIDDEN_SIZE);
  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    classifierInput[hiddenIndex] = finalHidden[hiddenIndex] * (dropoutMask?.[hiddenIndex] ?? 1);
  }

  const logits = new Float32Array(model.outputClasses);
  logits.set(model.by);
  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    const hiddenValue = classifierInput[hiddenIndex];
    const outputOffset = hiddenIndex * model.outputClasses;

    for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
      logits[classIndex] += hiddenValue * model.wy[outputOffset + classIndex];
    }
  }

  let maxLogit = Number.NEGATIVE_INFINITY;
  for (const logit of logits) {
    maxLogit = Math.max(maxLogit, logit);
  }

  const probabilities = new Float32Array(model.outputClasses);
  let probabilitySum = 0;
  for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
    const probability = Math.exp(logits[classIndex] - maxLogit);
    probabilities[classIndex] = probability;
    probabilitySum += probability;
  }

  for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
    probabilities[classIndex] /= probabilitySum;
  }

  return {
    caches,
    classifierInput,
    dropoutMask,
    probabilities
  };
};

const predictionFromProbabilities = (probabilities) => {
  let predictedClass = 0;
  let predictedProbability = probabilities[0];

  for (let classIndex = 1; classIndex < probabilities.length; classIndex += 1) {
    if (probabilities[classIndex] > predictedProbability) {
      predictedClass = classIndex;
      predictedProbability = probabilities[classIndex];
    }
  }

  return predictedClass;
};

const applyAdam = (weights, gradients, firstMoment, secondMoment, optimizer) => {
  for (let index = 0; index < weights.length; index += 1) {
    const gradient = gradients[index];
    if (gradient === 0) {
      continue;
    }

    firstMoment[index] = BETA_1 * firstMoment[index] + (1 - BETA_1) * gradient;
    secondMoment[index] = BETA_2 * secondMoment[index] + (1 - BETA_2) * gradient * gradient;

    const correctedFirstMoment = firstMoment[index] / (1 - optimizer.beta1Power);
    const correctedSecondMoment = secondMoment[index] / (1 - optimizer.beta2Power);

    weights[index] -=
      (LEARNING_RATE * correctedFirstMoment) /
      (Math.sqrt(correctedSecondMoment) + EPSILON);
  }
};

const updateModel = (model, gradients) => {
  const optimizer = model.optimizer;
  optimizer.step += 1;
  optimizer.beta1Power *= BETA_1;
  optimizer.beta2Power *= BETA_2;

  applyAdam(model.wx, gradients.wx, optimizer.mwx, optimizer.vwx, optimizer);
  applyAdam(model.wh, gradients.wh, optimizer.mwh, optimizer.vwh, optimizer);
  applyAdam(model.b, gradients.b, optimizer.mb, optimizer.vb, optimizer);
  applyAdam(model.wy, gradients.wy, optimizer.mwy, optimizer.vwy, optimizer);
  applyAdam(model.by, gradients.by, optimizer.mby, optimizer.vby, optimizer);
};

const trainSample = (model, sample, rng) => {
  const { caches, classifierInput, dropoutMask, probabilities } = forward(model, sample, {
    training: true,
    rng
  });
  const loss = -Math.log(Math.max(probabilities[sample.labelId], Number.EPSILON));
  const predictedClass = predictionFromProbabilities(probabilities);
  const gradients = createZeroGradients(model);
  const deltaOutput = Float32Array.from(probabilities);
  deltaOutput[sample.labelId] -= 1;

  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    const outputOffset = hiddenIndex * model.outputClasses;
    for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
      gradients.wy[outputOffset + classIndex] +=
        classifierInput[hiddenIndex] * deltaOutput[classIndex];
    }
  }

  for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
    gradients.by[classIndex] += deltaOutput[classIndex];
  }

  let dhNext = new Float32Array(HIDDEN_SIZE);
  let dcNext = new Float32Array(HIDDEN_SIZE);
  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    const outputOffset = hiddenIndex * model.outputClasses;
    let gradient = 0;
    for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
      gradient += model.wy[outputOffset + classIndex] * deltaOutput[classIndex];
    }
    dhNext[hiddenIndex] = gradient * dropoutMask[hiddenIndex];
  }

  const gateSize = HIDDEN_SIZE * 4;
  for (let timeIndex = caches.length - 1; timeIndex >= 0; timeIndex -= 1) {
    const cache = caches[timeIndex];
    const dz = new Float32Array(gateSize);
    const dhPrev = new Float32Array(HIDDEN_SIZE);
    const dcPrev = new Float32Array(HIDDEN_SIZE);

    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const cellValue = cache.c[hiddenIndex];
      const tanhCell = Math.tanh(cellValue);
      const dh = dhNext[hiddenIndex];
      const dc =
        dcNext[hiddenIndex] +
        dh * cache.outputGate[hiddenIndex] * (1 - tanhCell * tanhCell);

      const outputGateGradient = dh * tanhCell;
      const inputGateGradient = dc * cache.candidate[hiddenIndex];
      const candidateGradient = dc * cache.inputGate[hiddenIndex];
      const forgetGateGradient = dc * cache.cPrev[hiddenIndex];

      dz[hiddenIndex] = clipGradient(
        inputGateGradient *
          cache.inputGate[hiddenIndex] *
          (1 - cache.inputGate[hiddenIndex])
      );
      dz[HIDDEN_SIZE + hiddenIndex] = clipGradient(
        forgetGateGradient *
          cache.forgetGate[hiddenIndex] *
          (1 - cache.forgetGate[hiddenIndex])
      );
      dz[HIDDEN_SIZE * 2 + hiddenIndex] = clipGradient(
        candidateGradient *
          (1 - cache.candidate[hiddenIndex] * cache.candidate[hiddenIndex])
      );
      dz[HIDDEN_SIZE * 3 + hiddenIndex] = clipGradient(
        outputGateGradient *
          cache.outputGate[hiddenIndex] *
          (1 - cache.outputGate[hiddenIndex])
      );

      dcPrev[hiddenIndex] = dc * cache.forgetGate[hiddenIndex];
    }

    for (let itemIndex = 0; itemIndex < cache.frame.indices.length; itemIndex += 1) {
      const inputIndex = cache.frame.indices[itemIndex];
      const inputValue = cache.frame.values[itemIndex];
      const inputOffset = inputIndex * gateSize;

      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
        gradients.wx[inputOffset + gateIndex] += inputValue * dz[gateIndex];
      }
    }

    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const hiddenOffset = hiddenIndex * gateSize;
      const previousHiddenValue = cache.hPrev[hiddenIndex];

      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
        gradients.wh[hiddenOffset + gateIndex] += previousHiddenValue * dz[gateIndex];
        dhPrev[hiddenIndex] += model.wh[hiddenOffset + gateIndex] * dz[gateIndex];
      }
    }

    for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
      gradients.b[gateIndex] += dz[gateIndex];
    }

    dhNext = dhPrev;
    dcNext = dcPrev;
  }

  for (const gradientArray of Object.values(gradients)) {
    for (let index = 0; index < gradientArray.length; index += 1) {
      gradientArray[index] = clipGradient(gradientArray[index]);
    }
  }

  updateModel(model, gradients);

  return {
    loss,
    correct: predictedClass === sample.labelId ? 1 : 0
  };
};

const createEmptyConfusionMatrix = (classCount) => {
  return Array.from({ length: classCount }, () => new Array(classCount).fill(0));
};

const computePerLabelMetrics = (confusionMatrix, labels) => {
  const perLabel = {};
  let macroPrecision = 0;
  let macroRecall = 0;
  let macroF1 = 0;
  let weightedPrecision = 0;
  let weightedRecall = 0;
  let weightedF1 = 0;
  let totalSupport = 0;

  for (let classIndex = 0; classIndex < labels.length; classIndex += 1) {
    const truePositive = confusionMatrix[classIndex][classIndex];
    let falsePositive = 0;
    let falseNegative = 0;
    let support = 0;

    for (let otherIndex = 0; otherIndex < labels.length; otherIndex += 1) {
      if (otherIndex !== classIndex) {
        falsePositive += confusionMatrix[otherIndex][classIndex];
        falseNegative += confusionMatrix[classIndex][otherIndex];
      }
      support += confusionMatrix[classIndex][otherIndex];
    }

    const precision =
      truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive);
    const recall =
      truePositive + falseNegative === 0 ? 0 : truePositive / (truePositive + falseNegative);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    perLabel[labels[classIndex]] = {
      precision,
      recall,
      f1,
      support
    };

    macroPrecision += precision;
    macroRecall += recall;
    macroF1 += f1;
    weightedPrecision += precision * support;
    weightedRecall += recall * support;
    weightedF1 += f1 * support;
    totalSupport += support;
  }

  return {
    labels: perLabel,
    macroAverage: {
      precision: macroPrecision / labels.length,
      recall: macroRecall / labels.length,
      f1: macroF1 / labels.length,
      support: totalSupport
    },
    weightedAverage: {
      precision: totalSupport === 0 ? 0 : weightedPrecision / totalSupport,
      recall: totalSupport === 0 ? 0 : weightedRecall / totalSupport,
      f1: totalSupport === 0 ? 0 : weightedF1 / totalSupport,
      support: totalSupport
    }
  };
};

const evaluate = (model, samples, labels) => {
  const confusionMatrix = createEmptyConfusionMatrix(labels.length);
  let correct = 0;
  let loss = 0;

  for (const sample of samples) {
    const { probabilities } = forward(model, sample);
    const predictedClass = predictionFromProbabilities(probabilities);
    loss += -Math.log(Math.max(probabilities[sample.labelId], Number.EPSILON));
    correct += predictedClass === sample.labelId ? 1 : 0;
    confusionMatrix[sample.labelId][predictedClass] += 1;
  }

  return {
    sampleCount: samples.length,
    loss: loss / samples.length,
    accuracy: correct / samples.length,
    macroF1: computePerLabelMetrics(confusionMatrix, labels).macroAverage.f1,
    weightedF1: computePerLabelMetrics(confusionMatrix, labels).weightedAverage.f1,
    confusionMatrix,
    perLabelMetrics: computePerLabelMetrics(confusionMatrix, labels)
  };
};

const roundedArray = (typedArray) =>
  Array.from(typedArray, (value) => Number(value.toFixed(8)));

const saveOutputs = ({
  labelsData,
  metadata,
  model,
  frameIndices,
  trainMetrics,
  validationMetrics,
  testMetrics,
  history
}) => {
  ensureDir(OUTPUT_DIR);
  const createdAt = new Date().toISOString();
  const config = {
    modelType: "lstm",
    description: "Stage 2 FSL alphabet sequence model. No live inference integration.",
    architecture: {
      recurrentLayers: [
        {
          type: "lstm",
          hiddenSize: HIDDEN_SIZE,
          direction: "forward",
          temporalSteps: TEMPORAL_STEPS,
          temporalFrameIndices: frameIndices,
          dropout: DROPOUT_RATE
        }
      ],
      classifier: {
        type: "dense-softmax",
        outputClasses: labelsData.labels.length
      }
    },
    sequenceLength: SEQUENCE_LENGTH,
    featureDimension: FEATURE_DIMENSION,
    inputShape: [SEQUENCE_LENGTH, FEATURE_DIMENSION],
    outputClasses: labelsData.labels.length,
    optimizer: "adam",
    learningRate: LEARNING_RATE,
    epochsRequested: EPOCHS,
    epochsCompleted: history.length,
    earlyStoppingPatience: EARLY_STOPPING_PATIENCE,
    gradientClipValue: GRADIENT_CLIP_VALUE,
    randomSeed: RANDOM_SEED,
    trainSamples: trainMetrics.sampleCount,
    validationSamples: validationMetrics.sampleCount,
    testSamples: testMetrics.sampleCount,
    processedDatasetCreatedAt: metadata.createdAt ?? null,
    createdAt
  };

  const metrics = {
    trainAccuracy: trainMetrics.accuracy,
    validationAccuracy: validationMetrics.accuracy,
    testAccuracy: testMetrics.accuracy,
    testLoss: testMetrics.loss,
    macroF1: testMetrics.macroF1,
    weightedF1: testMetrics.weightedF1,
    train: trainMetrics,
    validation: validationMetrics,
    test: testMetrics,
    history,
    createdAt
  };

  const modelArtifact = {
    artifactType: "fsl-alphabet-lstm",
    createdAt,
    labels: labelsData.labels,
    labelToId: labelsData.labelToId,
    idToLabel: labelsData.idToLabel,
    config,
    weights: {
      wx: roundedArray(model.wx),
      wh: roundedArray(model.wh),
      b: roundedArray(model.b),
      wy: roundedArray(model.wy),
      by: roundedArray(model.by)
    }
  };

  writeJson(path.join(OUTPUT_DIR, "labels.json"), labelsData);
  writeJson(path.join(OUTPUT_DIR, "config.json"), config);
  writeJson(path.join(OUTPUT_DIR, "metrics.json"), metrics);
  writeJson(path.join(OUTPUT_DIR, "training_history.json"), history);
  writeJson(path.join(OUTPUT_DIR, "confusion_matrix.json"), {
    labels: labelsData.labels,
    matrix: testMetrics.confusionMatrix
  });
  writeJson(path.join(OUTPUT_DIR, "model.json"), modelArtifact);
};

const formatPercent = (value) => `${(value * 100).toFixed(2)}%`;

const main = () => {
  validateRequiredFiles();

  const labelsData = readJson(path.join(INPUT_DIR, "labels.json"));
  const metadata = readJson(path.join(INPUT_DIR, "metadata.json"));
  validateLabels(labelsData);
  validateMetadata(metadata);

  const frameIndices = temporalFrameIndices();
  const trainSamples = loadSplit("train", labelsData, frameIndices);
  const validationSamples = loadSplit("validation", labelsData, frameIndices);
  const testSamples = loadSplit("test", labelsData, frameIndices);
  const model = createModel(labelsData.labels.length);
  const history = [];
  const rng = mulberry32(RANDOM_SEED + 1);
  let bestValidationLoss = Number.POSITIVE_INFINITY;
  let epochsWithoutImprovement = 0;

  console.log("Training FSL alphabet Stage 2 LSTM");
  console.log(`Input shape: [${SEQUENCE_LENGTH}, ${FEATURE_DIMENSION}]`);
  console.log(`Temporal steps used by LSTM: ${TEMPORAL_STEPS}`);
  console.log(`Hidden size: ${HIDDEN_SIZE}`);
  console.log(`Dropout: ${DROPOUT_RATE}`);
  console.log(`Classes: ${labelsData.labels.length}`);
  console.log(
    `Samples -> train: ${trainSamples.length}, validation: ${validationSamples.length}, test: ${testSamples.length}`
  );

  for (let epoch = 1; epoch <= EPOCHS; epoch += 1) {
    const order = shuffle(
      Array.from({ length: trainSamples.length }, (_, index) => index),
      rng
    );
    let trainLoss = 0;
    let trainCorrect = 0;

    for (const sampleIndex of order) {
      const result = trainSample(model, trainSamples[sampleIndex], rng);
      trainLoss += result.loss;
      trainCorrect += result.correct;
    }

    const validationMetrics = evaluate(model, validationSamples, labelsData.labels);
    const epochStats = {
      epoch,
      trainLoss: trainLoss / trainSamples.length,
      trainAccuracy: trainCorrect / trainSamples.length,
      validationLoss: validationMetrics.loss,
      validationAccuracy: validationMetrics.accuracy
    };
    history.push(epochStats);

    console.log(
      [
        `Epoch ${epoch}/${EPOCHS}`,
        `loss ${epochStats.trainLoss.toFixed(4)}`,
        `acc ${formatPercent(epochStats.trainAccuracy)}`,
        `val_loss ${epochStats.validationLoss.toFixed(4)}`,
        `val_acc ${formatPercent(epochStats.validationAccuracy)}`
      ].join(" - ")
    );

    if (validationMetrics.loss < bestValidationLoss - MIN_VALIDATION_DELTA) {
      bestValidationLoss = validationMetrics.loss;
      epochsWithoutImprovement = 0;
    } else {
      epochsWithoutImprovement += 1;
      if (epochsWithoutImprovement >= EARLY_STOPPING_PATIENCE) {
        console.log(`Early stopping after ${epoch} epochs.`);
        break;
      }
    }
  }

  const trainMetrics = evaluate(model, trainSamples, labelsData.labels);
  const validationMetrics = evaluate(model, validationSamples, labelsData.labels);
  const testMetrics = evaluate(model, testSamples, labelsData.labels);

  saveOutputs({
    labelsData,
    metadata,
    model,
    frameIndices,
    trainMetrics,
    validationMetrics,
    testMetrics,
    history
  });

  console.log("Stage 2 LSTM training complete.");
  console.log(`Train accuracy: ${formatPercent(trainMetrics.accuracy)}`);
  console.log(`Validation accuracy: ${formatPercent(validationMetrics.accuracy)}`);
  console.log(`Test accuracy: ${formatPercent(testMetrics.accuracy)}`);
  console.log(`Test macro F1: ${formatPercent(testMetrics.macroF1)}`);
  console.log(`Test weighted F1: ${formatPercent(testMetrics.weightedF1)}`);
  console.log(`Outputs saved to ${OUTPUT_DIR}`);
};

try {
  main();
} catch (error) {
  console.error("Stage 2 LSTM training failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
