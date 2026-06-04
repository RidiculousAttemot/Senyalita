import fs from "fs";
import path from "path";

const INPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_alphabet", "baseline");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const INPUT_SIZE = SEQUENCE_LENGTH * FEATURE_DIMENSION;
const RANDOM_SEED = 1337;
const HIDDEN_SIZE = Number.parseInt(process.env.FSL_BASELINE_HIDDEN_SIZE ?? "32", 10);
const EPOCHS = Number.parseInt(process.env.FSL_BASELINE_EPOCHS ?? "35", 10);
const LEARNING_RATE = Number.parseFloat(process.env.FSL_BASELINE_LEARNING_RATE ?? "0.001");
const EARLY_STOPPING_PATIENCE = Number.parseInt(
  process.env.FSL_BASELINE_PATIENCE ?? "8",
  10
);
const MIN_VALIDATION_DELTA = 0.0001;
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

const readJson = (filePath) => {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const writeJson = (filePath, payload) => {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const isValidNumber = (value) => typeof value === "number" && Number.isFinite(value);

const validateRequiredFiles = () => {
  const missingFiles = requiredFiles.filter(
    (fileName) => !fs.existsSync(path.join(INPUT_DIR, fileName))
  );

  if (missingFiles.length > 0) {
    throw new Error(`Missing processed dataset files: ${missingFiles.join(", ")}`);
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
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

const flattenSequenceToSparseVector = (sequence) => {
  const indices = [];
  const values = [];
  let offset = 0;

  for (const frame of sequence) {
    if (!Array.isArray(frame) || frame.length !== FEATURE_DIMENSION) {
      throw new Error("Frame feature dimension mismatch.");
    }

    for (let featureIndex = 0; featureIndex < FEATURE_DIMENSION; featureIndex += 1) {
      const value = frame[featureIndex];
      if (!isValidNumber(value)) {
        throw new Error("Feature value must be a finite number.");
      }
      if (value !== 0) {
        indices.push(offset + featureIndex);
        values.push(value);
      }
    }

    offset += FEATURE_DIMENSION;
  }

  return {
    indices: Uint32Array.from(indices),
    values: Float32Array.from(values)
  };
};

const loadSplit = (splitName, labelsData) => {
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
      ...flattenSequenceToSparseVector(sample.sequence)
    };
  });
};

const validateLabels = (labelsData) => {
  if (!labelsData || typeof labelsData !== "object") {
    throw new Error("labels.json is invalid.");
  }
  if (!Array.isArray(labelsData.labels) || labelsData.labels.length !== 28) {
    throw new Error("Expected labels.json to contain 28 alphabet classes.");
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

const createModel = (outputClasses) => {
  const rng = mulberry32(RANDOM_SEED);
  const w1 = new Float32Array(INPUT_SIZE * HIDDEN_SIZE);
  const b1 = new Float32Array(HIDDEN_SIZE);
  const w2 = new Float32Array(HIDDEN_SIZE * outputClasses);
  const b2 = new Float32Array(outputClasses);
  const w1Scale = Math.sqrt(2 / INPUT_SIZE);
  const w2Scale = Math.sqrt(2 / HIDDEN_SIZE);

  for (let index = 0; index < w1.length; index += 1) {
    w1[index] = randomNormal(rng) * w1Scale;
  }
  for (let index = 0; index < w2.length; index += 1) {
    w2[index] = randomNormal(rng) * w2Scale;
  }

  return {
    w1,
    b1,
    w2,
    b2,
    outputClasses,
    optimizer: {
      mw1: new Float32Array(w1.length),
      vw1: new Float32Array(w1.length),
      mb1: new Float32Array(b1.length),
      vb1: new Float32Array(b1.length),
      mw2: new Float32Array(w2.length),
      vw2: new Float32Array(w2.length),
      mb2: new Float32Array(b2.length),
      vb2: new Float32Array(b2.length),
      step: 0,
      beta1Power: 1,
      beta2Power: 1
    }
  };
};

const adamUpdate = (weights, firstMoment, secondMoment, index, gradient, optimizer) => {
  firstMoment[index] = BETA_1 * firstMoment[index] + (1 - BETA_1) * gradient;
  secondMoment[index] = BETA_2 * secondMoment[index] + (1 - BETA_2) * gradient * gradient;

  const correctedFirstMoment = firstMoment[index] / (1 - optimizer.beta1Power);
  const correctedSecondMoment = secondMoment[index] / (1 - optimizer.beta2Power);

  weights[index] -=
    (LEARNING_RATE * correctedFirstMoment) / (Math.sqrt(correctedSecondMoment) + EPSILON);
};

const forward = (model, sample) => {
  const hiddenPreActivation = new Float32Array(HIDDEN_SIZE);
  const hidden = new Float32Array(HIDDEN_SIZE);
  hiddenPreActivation.set(model.b1);

  for (let itemIndex = 0; itemIndex < sample.indices.length; itemIndex += 1) {
    const inputIndex = sample.indices[itemIndex];
    const inputValue = sample.values[itemIndex];
    const weightOffset = inputIndex * HIDDEN_SIZE;

    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      hiddenPreActivation[hiddenIndex] += inputValue * model.w1[weightOffset + hiddenIndex];
    }
  }

  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    hidden[hiddenIndex] = Math.max(0, hiddenPreActivation[hiddenIndex]);
  }

  const logits = new Float32Array(model.outputClasses);
  logits.set(model.b2);
  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    const hiddenValue = hidden[hiddenIndex];
    const weightOffset = hiddenIndex * model.outputClasses;

    for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
      logits[classIndex] += hiddenValue * model.w2[weightOffset + classIndex];
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

  return { hiddenPreActivation, hidden, probabilities };
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

const trainSample = (model, sample) => {
  const optimizer = model.optimizer;
  optimizer.step += 1;
  optimizer.beta1Power *= BETA_1;
  optimizer.beta2Power *= BETA_2;

  const { hiddenPreActivation, hidden, probabilities } = forward(model, sample);
  const loss = -Math.log(Math.max(probabilities[sample.labelId], Number.EPSILON));
  const predictedClass = predictionFromProbabilities(probabilities);

  const deltaOutput = Float32Array.from(probabilities);
  deltaOutput[sample.labelId] -= 1;

  const deltaHidden = new Float32Array(HIDDEN_SIZE);
  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    let gradient = 0;
    const weightOffset = hiddenIndex * model.outputClasses;

    for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
      gradient += deltaOutput[classIndex] * model.w2[weightOffset + classIndex];
    }

    deltaHidden[hiddenIndex] =
      hiddenPreActivation[hiddenIndex] > 0 ? gradient : 0;
  }

  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    const weightOffset = hiddenIndex * model.outputClasses;
    const hiddenValue = hidden[hiddenIndex];

    for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
      const index = weightOffset + classIndex;
      adamUpdate(
        model.w2,
        optimizer.mw2,
        optimizer.vw2,
        index,
        hiddenValue * deltaOutput[classIndex],
        optimizer
      );
    }
  }

  for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
    adamUpdate(
      model.b2,
      optimizer.mb2,
      optimizer.vb2,
      classIndex,
      deltaOutput[classIndex],
      optimizer
    );
  }

  for (let itemIndex = 0; itemIndex < sample.indices.length; itemIndex += 1) {
    const inputIndex = sample.indices[itemIndex];
    const inputValue = sample.values[itemIndex];
    const weightOffset = inputIndex * HIDDEN_SIZE;

    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const index = weightOffset + hiddenIndex;
      adamUpdate(
        model.w1,
        optimizer.mw1,
        optimizer.vw1,
        index,
        inputValue * deltaHidden[hiddenIndex],
        optimizer
      );
    }
  }

  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    adamUpdate(
      model.b1,
      optimizer.mb1,
      optimizer.vb1,
      hiddenIndex,
      deltaHidden[hiddenIndex],
      optimizer
    );
  }

  return {
    loss,
    correct: predictedClass === sample.labelId ? 1 : 0
  };
};

const createEmptyConfusionMatrix = (classCount) => {
  return Array.from({ length: classCount }, () => new Array(classCount).fill(0));
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
    confusionMatrix,
    perLabelMetrics: computePerLabelMetrics(confusionMatrix, labels)
  };
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

const roundedArray = (typedArray) => {
  return Array.from(typedArray, (value) => Number(value.toFixed(8)));
};

const saveOutputs = ({ labelsData, metadata, model, trainMetrics, validationMetrics, testMetrics, history }) => {
  ensureDir(OUTPUT_DIR);
  const createdAt = new Date().toISOString();

  const trainingConfig = {
    modelType: "baseline-mlp",
    description: "Flattened FSL alphabet sequence classifier. No live inference integration.",
    sequenceLength: SEQUENCE_LENGTH,
    featureDimension: FEATURE_DIMENSION,
    inputSize: INPUT_SIZE,
    outputClasses: labelsData.labels.length,
    hiddenLayers: [HIDDEN_SIZE],
    activation: "relu",
    outputActivation: "softmax",
    optimizer: "adam",
    learningRate: LEARNING_RATE,
    epochsRequested: EPOCHS,
    epochsCompleted: history.length,
    earlyStoppingPatience: EARLY_STOPPING_PATIENCE,
    randomSeed: RANDOM_SEED,
    trainSamples: trainMetrics.sampleCount,
    validationSamples: validationMetrics.sampleCount,
    testSamples: testMetrics.sampleCount,
    processedDatasetCreatedAt: metadata.createdAt ?? null,
    createdAt
  };

  const metrics = {
    train: trainMetrics,
    validation: validationMetrics,
    test: testMetrics,
    history,
    createdAt
  };

  const modelArtifact = {
    artifactType: "fsl-alphabet-baseline-mlp",
    createdAt,
    labels: labelsData.labels,
    labelToId: labelsData.labelToId,
    idToLabel: labelsData.idToLabel,
    trainingConfig,
    weights: {
      w1: roundedArray(model.w1),
      b1: roundedArray(model.b1),
      w2: roundedArray(model.w2),
      b2: roundedArray(model.b2)
    }
  };

  writeJson(path.join(OUTPUT_DIR, "labels.json"), labelsData);
  writeJson(path.join(OUTPUT_DIR, "training_config.json"), trainingConfig);
  writeJson(path.join(OUTPUT_DIR, "metrics.json"), metrics);
  writeJson(path.join(OUTPUT_DIR, "model.json"), modelArtifact);
};

const formatPercent = (value) => `${(value * 100).toFixed(2)}%`;

const main = () => {
  validateRequiredFiles();

  const labelsData = readJson(path.join(INPUT_DIR, "labels.json"));
  const metadata = readJson(path.join(INPUT_DIR, "metadata.json"));
  validateLabels(labelsData);

  const trainSamples = loadSplit("train", labelsData);
  const validationSamples = loadSplit("validation", labelsData);
  const testSamples = loadSplit("test", labelsData);
  const model = createModel(labelsData.labels.length);
  const history = [];
  const rng = mulberry32(RANDOM_SEED + 1);
  let bestValidationLoss = Number.POSITIVE_INFINITY;
  let epochsWithoutImprovement = 0;

  console.log("Training FSL alphabet baseline MLP");
  console.log(`Input: ${INPUT_SIZE} flattened features`);
  console.log(`Hidden layers: ${HIDDEN_SIZE}`);
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
      const result = trainSample(model, trainSamples[sampleIndex]);
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
    trainMetrics,
    validationMetrics,
    testMetrics,
    history
  });

  console.log("Baseline training complete.");
  console.log(`Train accuracy: ${formatPercent(trainMetrics.accuracy)}`);
  console.log(`Validation accuracy: ${formatPercent(validationMetrics.accuracy)}`);
  console.log(`Test accuracy: ${formatPercent(testMetrics.accuracy)}`);
  console.log(`Outputs saved to ${OUTPUT_DIR}`);
};

try {
  main();
} catch (error) {
  console.error("Baseline training failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
