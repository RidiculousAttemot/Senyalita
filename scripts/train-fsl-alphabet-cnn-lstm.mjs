import fs from "fs";
import path from "path";

const INPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_alphabet", "cnn_lstm");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const OUTPUT_CLASSES = 28;
const RANDOM_SEED = 2026;
const CONV_FILTERS = 32;
const CONV_KERNEL_SIZE = 3;
const POOL_SIZE = 2;
const HIDDEN_SIZE = 32;
const CNN_OUTPUT_STEPS = Math.floor(SEQUENCE_LENGTH / POOL_SIZE);
const EPOCHS = Number.parseInt(process.env.FSL_CNN_LSTM_EPOCHS ?? "45", 10);
const LEARNING_RATE = Number.parseFloat(process.env.FSL_CNN_LSTM_LEARNING_RATE ?? "0.002");
const DROPOUT_RATE = Number.parseFloat(process.env.FSL_CNN_LSTM_DROPOUT ?? "0.2");
const EARLY_STOPPING_PATIENCE = Number.parseInt(process.env.FSL_CNN_LSTM_PATIENCE ?? "10", 10);
const MIN_VALIDATION_DELTA = 0.0001;
const GRADIENT_CLIP_VALUE = 1;
const BETA_1 = 0.9;
const BETA_2 = 0.999;
const EPSILON = 1e-8;

const requiredFiles = ["labels.json", "metadata.json", "train.json", "validation.json", "test.json"];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, payload) => {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
};
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) { fs.mkdirSync(dirPath, { recursive: true }); }
};
const isValidNumber = (value) => typeof value === "number" && Number.isFinite(value);

const sigmoid = (value) => {
  if (value >= 0) { const z = Math.exp(-value); return 1 / (1 + z); }
  const z = Math.exp(value); return z / (1 + z);
};

const clipGradient = (value) => {
  if (value > GRADIENT_CLIP_VALUE) return GRADIENT_CLIP_VALUE;
  if (value < -GRADIENT_CLIP_VALUE) return -GRADIENT_CLIP_VALUE;
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
  if (!labelsData || typeof labelsData !== "object") throw new Error("labels.json is invalid.");
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
    if (labelsData.labelToId[label] !== index) throw new Error(`labelToId mismatch for label ${label}.`);
    if (labelsData.idToLabel[String(index)] !== label) throw new Error(`idToLabel mismatch for id ${index}.`);
  }
};

const validateMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object") throw new Error("metadata.json is invalid.");
  if (metadata.sequenceLength !== SEQUENCE_LENGTH) throw new Error(`Expected sequenceLength ${SEQUENCE_LENGTH}.`);
  if (metadata.featureDimension !== FEATURE_DIMENSION) throw new Error(`Expected featureDimension ${FEATURE_DIMENSION}.`);
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

const loadFullSequence = (sample, sampleIndex, labelsData) => {
  if (!sample || typeof sample !== "object") throw new Error(`Sample ${sampleIndex} is invalid.`);
  if (!Array.isArray(sample.sequence) || sample.sequence.length !== SEQUENCE_LENGTH) {
    throw new Error(`Sample ${sampleIndex} has invalid sequence length.`);
  }
  if (!Number.isInteger(sample.labelId)) throw new Error(`Sample ${sampleIndex} has invalid labelId.`);
  if (labelsData.labelToId[sample.label] !== sample.labelId) throw new Error(`Sample ${sampleIndex} has label mapping mismatch.`);

  const frames = sample.sequence.map((frame, frameIndex) => {
    if (!Array.isArray(frame) || frame.length !== FEATURE_DIMENSION) {
      throw new Error(`Sample ${sampleIndex} frame ${frameIndex} dimension mismatch.`);
    }
    const raw = new Float32Array(FEATURE_DIMENSION);
    for (let f = 0; f < FEATURE_DIMENSION; f += 1) {
      if (!isValidNumber(frame[f])) throw new Error(`Sample ${sampleIndex} frame ${frameIndex} feature ${f} invalid.`);
      raw[f] = frame[f];
    }
    return raw;
  });

  return { label: sample.label, labelId: sample.labelId, frames };
};

const loadSplit = (splitName, labelsData) => {
  const splitPath = path.join(INPUT_DIR, `${splitName}.json`);
  const payload = readJson(splitPath);
  if (payload.sequenceLength !== SEQUENCE_LENGTH) throw new Error(`${splitName}.json sequenceLength must be ${SEQUENCE_LENGTH}.`);
  if (payload.featureDimension !== FEATURE_DIMENSION) throw new Error(`${splitName}.json featureDimension must be ${FEATURE_DIMENSION}.`);
  if (!Array.isArray(payload.samples) || payload.samples.length === 0) throw new Error(`${splitName}.json has no samples.`);
  return payload.samples.map((sample, sampleIndex) => loadFullSequence(sample, sampleIndex, labelsData));
};

const createConv1dWeights = (rng, kernelSize, inChannels, outChannels) => {
  const scale = Math.sqrt(2 / (kernelSize * inChannels));
  const kernel = new Float32Array(kernelSize * inChannels * outChannels);
  const bias = new Float32Array(outChannels);
  for (let index = 0; index < kernel.length; index += 1) kernel[index] = randomNormal(rng) * scale;
  return { kernel, bias, kernelSize, inChannels, outChannels };
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
  const conv1 = createConv1dWeights(rng, CONV_KERNEL_SIZE, FEATURE_DIMENSION, CONV_FILTERS);
  const conv2 = createConv1dWeights(rng, CONV_KERNEL_SIZE, CONV_FILTERS, CONV_FILTERS);
  const lstm = createLstmWeights(rng, CONV_FILTERS);
  const wyScale = Math.sqrt(2 / HIDDEN_SIZE);
  const wy = new Float32Array(HIDDEN_SIZE * outputClasses);
  const by = new Float32Array(outputClasses);
  for (let index = 0; index < wy.length; index += 1) wy[index] = randomNormal(rng) * wyScale;

  const opt = (size) => ({ m: new Float32Array(size), v: new Float32Array(size) });

  return {
    conv1: { kernel: conv1.kernel, bias: conv1.bias, kernelSize: 3, inChannels: 126, outChannels: 32 },
    conv2: { kernel: conv2.kernel, bias: conv2.bias, kernelSize: 3, inChannels: 32, outChannels: 32 },
    lstm: { wx: lstm.wx, wh: lstm.wh, b: lstm.b },
    wy, by, outputClasses,
    optConv1K: opt(conv1.kernel.length), optConv1B: opt(conv1.bias.length),
    optConv2K: opt(conv2.kernel.length), optConv2B: opt(conv2.bias.length),
    optWx: opt(lstm.wx.length), optWh: opt(lstm.wh.length), optB: opt(lstm.b.length),
    optWy: opt(wy.length), optBy: opt(by.length),
    optStep: 0, optBeta1Power: 1, optBeta2Power: 1
  };
};

const conv1dForward = (input, conv, pad) => {
  const T = input.length / conv.inChannels;
  const output = new Float32Array(T * conv.outChannels);
  const padLeft = pad;
  const padRight = pad;

  for (let t = 0; t < T; t += 1) {
    for (let oc = 0; oc < conv.outChannels; oc += 1) {
      let sum = conv.bias[oc];
      for (let k = 0; k < conv.kernelSize; k += 1) {
        const inputT = t - padLeft + k;
        if (inputT < 0 || inputT >= T) continue;
        for (let ic = 0; ic < conv.inChannels; ic += 1) {
          sum += input[inputT * conv.inChannels + ic]
            * conv.kernel[k * conv.inChannels * conv.outChannels + ic * conv.outChannels + oc];
        }
      }
      output[t * conv.outChannels + oc] = sum;
    }
  }
  return output;
};

const conv1dBackward = (input, gradOutput, conv, pad) => {
  const T = input.length / conv.inChannels;
  const gradKernel = new Float32Array(conv.kernel.length);
  const gradBias = new Float32Array(conv.bias.length);
  const gradInput = new Float32Array(input.length);
  const padLeft = pad;

  for (let t = 0; t < T; t += 1) {
    for (let oc = 0; oc < conv.outChannels; oc += 1) {
      const dOut = gradOutput[t * conv.outChannels + oc];
      if (dOut === 0) continue;
      gradBias[oc] += dOut;
      for (let k = 0; k < conv.kernelSize; k += 1) {
        const inputT = t - padLeft + k;
        if (inputT < 0 || inputT >= T) continue;
        for (let ic = 0; ic < conv.inChannels; ic += 1) {
          const inputVal = input[inputT * conv.inChannels + ic];
          const kIdx = k * conv.inChannels * conv.outChannels + ic * conv.outChannels + oc;
          gradKernel[kIdx] += inputVal * dOut;
          gradInput[inputT * conv.inChannels + ic] += conv.kernel[kIdx] * dOut;
        }
      }
    }
  }

  for (let index = 0; index < gradKernel.length; index += 1) gradKernel[index] = clipGradient(gradKernel[index]);

  return { gradKernel, gradBias, gradInput };
};

const reluForward = (input) => {
  const output = new Float32Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    output[index] = Math.max(0, input[index]);
  }
  return output;
};

const reluBackward = (gradOutput, cache) => {
  const gradInput = new Float32Array(gradOutput.length);
  for (let index = 0; index < gradOutput.length; index += 1) {
    gradInput[index] = cache[index] > 0 ? gradOutput[index] : 0;
  }
  return gradInput;
};

const maxpool1dForward = (input, inChannels) => {
  const T = input.length / inChannels;
  const outT = Math.floor(T / POOL_SIZE);
  const output = new Float32Array(outT * inChannels);
  const maxIndices = new Int32Array(outT * inChannels);

  for (let ot = 0; ot < outT; ot += 1) {
    for (let c = 0; c < inChannels; c += 1) {
      let maxVal = Number.NEGATIVE_INFINITY;
      let maxIdx = -1;
      for (let p = 0; p < POOL_SIZE; p += 1) {
        const it = ot * POOL_SIZE + p;
        const val = input[it * inChannels + c];
        if (val > maxVal) { maxVal = val; maxIdx = it; }
      }
      output[ot * inChannels + c] = maxVal;
      maxIndices[ot * inChannels + c] = maxIdx;
    }
  }

  return { output, maxIndices };
};

const maxpool1dBackward = (gradOutput, maxIndices, inChannels) => {
  const outT = gradOutput.length / inChannels;
  const inT = outT * POOL_SIZE;
  const gradInput = new Float32Array(inT * inChannels);

  for (let ot = 0; ot < outT; ot += 1) {
    for (let c = 0; c < inChannels; c += 1) {
      const it = maxIndices[ot * inChannels + c];
      gradInput[it * inChannels + c] += gradOutput[ot * inChannels + c];
    }
  }

  return gradInput;
};

const createDropoutMask = (size, rng) => {
  const mask = new Float32Array(size);
  if (DROPOUT_RATE <= 0) { mask.fill(1); return mask; }
  const keepProbability = 1 - DROPOUT_RATE;
  const scale = 1 / keepProbability;
  for (let index = 0; index < size; index += 1) {
    mask[index] = rng() < keepProbability ? scale : 0;
  }
  return mask;
};

const lstmForward = (frames, wx, wh, b) => {
  const gateSize = HIDDEN_SIZE * 4;
  let hPrev = new Float32Array(HIDDEN_SIZE);
  let cPrev = new Float32Array(HIDDEN_SIZE);
  const caches = [];

  for (const frame of frames) {
    const z = new Float32Array(gateSize);
    z.set(b);
    for (let ic = 0; ic < frame.length; ic += 1) {
      const inputValue = frame[ic];
      if (inputValue === 0) continue;
      const inputOffset = ic * gateSize;
      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
        z[gateIndex] += inputValue * wx[inputOffset + gateIndex];
      }
    }
    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const hiddenValue = hPrev[hiddenIndex];
      if (hiddenValue === 0) continue;
      const hiddenOffset = hiddenIndex * gateSize;
      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
        z[gateIndex] += hiddenValue * wh[hiddenOffset + gateIndex];
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
    caches.push({ frame, hPrev, cPrev, inputGate, forgetGate, candidate, outputGate, c, h });
    hPrev = h;
    cPrev = c;
  }

  return { finalH: caches[caches.length - 1].h, caches };
};

const cnnForward = (model, frames) => {
  const conv1In = new Float32Array(SEQUENCE_LENGTH * FEATURE_DIMENSION);
  for (let t = 0; t < SEQUENCE_LENGTH; t += 1) {
    conv1In.set(frames[t], t * FEATURE_DIMENSION);
  }

  const conv1Out = conv1dForward(conv1In, model.conv1, 1);
  const relu1Out = reluForward(conv1Out);
  const conv2Out = conv1dForward(relu1Out, model.conv2, 1);
  const relu2Out = reluForward(conv2Out);
  const { output: poolOut, maxIndices } = maxpool1dForward(relu2Out, CONV_FILTERS);

  const lstmFrames = [];
  const T = CNN_OUTPUT_STEPS;
  for (let t = 0; t < T; t += 1) {
    const frame = new Float32Array(CONV_FILTERS);
    for (let c = 0; c < CONV_FILTERS; c += 1) {
      frame[c] = poolOut[t * CONV_FILTERS + c];
    }
    lstmFrames.push(frame);
  }

  const { finalH, caches } = lstmForward(lstmFrames, model.lstm.wx, model.lstm.wh, model.lstm.b);

  return {
    conv1In, conv1Out, relu1Out, conv2Out, relu2Out, poolOut, maxIndices,
    lstmFrames, lstmCaches: caches, finalH
  };
};

const forward = (model, sample, { training = false, rng = null } = {}) => {
  const cnn = cnnForward(model, sample.frames);
  const dropoutMask = training ? createDropoutMask(HIDDEN_SIZE, rng) : null;
  const classifierInput = new Float32Array(HIDDEN_SIZE);
  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    classifierInput[hiddenIndex] = cnn.finalH[hiddenIndex] * (dropoutMask?.[hiddenIndex] ?? 1);
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
  for (const logit of logits) maxLogit = Math.max(maxLogit, logit);
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

  return { cnn, classifierInput, dropoutMask, probabilities };
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

const applyAdam = (weights, gradients, firstMoment, secondMoment, step, beta1Power, beta2Power) => {
  for (let index = 0; index < weights.length; index += 1) {
    const gradient = gradients[index];
    if (gradient === 0) continue;
    firstMoment[index] = BETA_1 * firstMoment[index] + (1 - BETA_1) * gradient;
    secondMoment[index] = BETA_2 * secondMoment[index] + (1 - BETA_2) * gradient * gradient;
    const correctedFirstMoment = firstMoment[index] / (1 - beta1Power);
    const correctedSecondMoment = secondMoment[index] / (1 - beta2Power);
    weights[index] -= (LEARNING_RATE * correctedFirstMoment) / (Math.sqrt(correctedSecondMoment) + EPSILON);
  }
};

const lstmBptt = (caches, dhNext, dcNext, wx, wh, b, deltaClassRaw, dropoutMask) => {
  const gateSize = HIDDEN_SIZE * 4;
  const gradients = {
    wx: new Float32Array(wx.length),
    wh: new Float32Array(wh.length),
    b: new Float32Array(b.length)
  };

  if (deltaClassRaw) {
    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      dhNext[hiddenIndex] += deltaClassRaw[hiddenIndex] * (dropoutMask?.[hiddenIndex] ?? 1);
    }
  }

  for (let timeIndex = caches.length - 1; timeIndex >= 0; timeIndex -= 1) {
    const cache = caches[timeIndex];
    const dz = new Float32Array(gateSize);
    const dhPrev = new Float32Array(HIDDEN_SIZE);
    const dcPrev = new Float32Array(HIDDEN_SIZE);

    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const cellValue = cache.c[hiddenIndex];
      const tanhCell = Math.tanh(cellValue);
      const dh = dhNext[hiddenIndex];
      const dc = dcNext[hiddenIndex] + dh * cache.outputGate[hiddenIndex] * (1 - tanhCell * tanhCell);
      const outputGateGradient = dh * tanhCell;
      const inputGateGradient = dc * cache.candidate[hiddenIndex];
      const candidateGradient = dc * cache.inputGate[hiddenIndex];
      const forgetGateGradient = dc * cache.cPrev[hiddenIndex];

      dz[hiddenIndex] = clipGradient(inputGateGradient * cache.inputGate[hiddenIndex] * (1 - cache.inputGate[hiddenIndex]));
      dz[HIDDEN_SIZE + hiddenIndex] = clipGradient(forgetGateGradient * cache.forgetGate[hiddenIndex] * (1 - cache.forgetGate[hiddenIndex]));
      dz[HIDDEN_SIZE * 2 + hiddenIndex] = clipGradient(candidateGradient * (1 - cache.candidate[hiddenIndex] * cache.candidate[hiddenIndex]));
      dz[HIDDEN_SIZE * 3 + hiddenIndex] = clipGradient(outputGateGradient * cache.outputGate[hiddenIndex] * (1 - cache.outputGate[hiddenIndex]));
      dcPrev[hiddenIndex] = dc * cache.forgetGate[hiddenIndex];
    }

    for (let ic = 0; ic < cache.frame.length; ic += 1) {
      const inputValue = cache.frame[ic];
      if (inputValue === 0) continue;
      const inputOffset = ic * gateSize;
      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
        gradients.wx[inputOffset + gateIndex] += inputValue * dz[gateIndex];
      }
    }

    for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
      const hiddenOffset = hiddenIndex * gateSize;
      for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
        gradients.wh[hiddenOffset + gateIndex] += cache.hPrev[hiddenIndex] * dz[gateIndex];
        dhPrev[hiddenIndex] += wh[hiddenOffset + gateIndex] * dz[gateIndex];
      }
    }

    for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
      gradients.b[gateIndex] += dz[gateIndex];
    }

    dhNext.set(dhPrev);
    dcNext.set(dcPrev);
  }

  for (const gradientArray of Object.values(gradients)) {
    for (let index = 0; index < gradientArray.length; index += 1) {
      gradientArray[index] = clipGradient(gradientArray[index]);
    }
  }

  return gradients;
};

const updateModel = (model, grads) => {
  model.optStep += 1;
  model.optBeta1Power *= BETA_1;
  model.optBeta2Power *= BETA_2;

  const apply = (weights, g, mArr, vArr) => {
    applyAdam(weights, g, mArr, vArr, model.optStep, model.optBeta1Power, model.optBeta2Power);
  };

  apply(model.conv1.kernel, grads.conv1K, model.optConv1K.m, model.optConv1K.v);
  apply(model.conv1.bias, grads.conv1B, model.optConv1B.m, model.optConv1B.v);
  apply(model.conv2.kernel, grads.conv2K, model.optConv2K.m, model.optConv2K.v);
  apply(model.conv2.bias, grads.conv2B, model.optConv2B.m, model.optConv2B.v);
  apply(model.lstm.wx, grads.lstmWx, model.optWx.m, model.optWx.v);
  apply(model.lstm.wh, grads.lstmWh, model.optWh.m, model.optWh.v);
  apply(model.lstm.b, grads.lstmB, model.optB.m, model.optB.v);
  apply(model.wy, grads.wy, model.optWy.m, model.optWy.v);
  apply(model.by, grads.by, model.optBy.m, model.optBy.v);
};

const trainSample = (model, sample, rng) => {
  const { cnn, classifierInput, dropoutMask, probabilities } = forward(model, sample, { training: true, rng });
  const loss = -Math.log(Math.max(probabilities[sample.labelId], Number.EPSILON));
  const predictedClass = predictionFromProbabilities(probabilities);
  const deltaOutput = Float32Array.from(probabilities);
  deltaOutput[sample.labelId] -= 1;

  const grads = {
    conv1K: new Float32Array(model.conv1.kernel.length),
    conv1B: new Float32Array(model.conv1.bias.length),
    conv2K: new Float32Array(model.conv2.kernel.length),
    conv2B: new Float32Array(model.conv2.bias.length),
    lstmWx: new Float32Array(model.lstm.wx.length),
    lstmWh: new Float32Array(model.lstm.wh.length),
    lstmB: new Float32Array(model.lstm.b.length),
    wy: new Float32Array(model.wy.length),
    by: new Float32Array(model.by.length)
  };

  for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
    grads.by[classIndex] += deltaOutput[classIndex];
  }

  const deltaHidden = new Float32Array(HIDDEN_SIZE);
  for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
    const outputOffset = hiddenIndex * model.outputClasses;
    let grad = 0;
    for (let classIndex = 0; classIndex < model.outputClasses; classIndex += 1) {
      grads.wy[outputOffset + classIndex] += classifierInput[hiddenIndex] * deltaOutput[classIndex];
      grad += model.wy[outputOffset + classIndex] * deltaOutput[classIndex];
    }
    deltaHidden[hiddenIndex] = grad * (dropoutMask?.[hiddenIndex] ?? 1);
  }

  const dhNext = new Float32Array(HIDDEN_SIZE);
  const dcNext = new Float32Array(HIDDEN_SIZE);
  dhNext.set(deltaHidden);

  const lstmGrads = lstmBptt(cnn.lstmCaches, dhNext, dcNext, model.lstm.wx, model.lstm.wh, model.lstm.b, null, null);
  grads.lstmWx.set(lstmGrads.wx);
  grads.lstmWh.set(lstmGrads.wh);
  grads.lstmB.set(lstmGrads.b);

  const gradPoolFlat = new Float32Array(CNN_OUTPUT_STEPS * CONV_FILTERS);
  for (let t = 0; t < CNN_OUTPUT_STEPS; t += 1) {
    for (let c = 0; c < CONV_FILTERS; c += 1) {
      gradPoolFlat[t * CONV_FILTERS + c] = dhNext[c] * 0;
    }
  }

  const lstmInputGrads = new Float32Array(CNN_OUTPUT_STEPS * CONV_FILTERS);
  {
    const gateSize = HIDDEN_SIZE * 4;
    const dhFromLstm = new Float32Array(HIDDEN_SIZE);
    const dcFromLstm = new Float32Array(HIDDEN_SIZE);
    for (let timeIndex = cnn.lstmCaches.length - 1; timeIndex >= 0; timeIndex -= 1) {
      const cache = cnn.lstmCaches[timeIndex];
      const dz = new Float32Array(gateSize);
      const dhPrev = new Float32Array(HIDDEN_SIZE);
      const dcPrev = new Float32Array(HIDDEN_SIZE);

      for (let hiddenIndex = 0; hiddenIndex < HIDDEN_SIZE; hiddenIndex += 1) {
        const cellValue = cache.c[hiddenIndex];
        const tanhCell = Math.tanh(cellValue);
        const dh = dhFromLstm[hiddenIndex];
        const dc = dcFromLstm[hiddenIndex] + dh * cache.outputGate[hiddenIndex] * (1 - tanhCell * tanhCell);
        const outputGateGradient = dh * tanhCell;
        const inputGateGradient = dc * cache.candidate[hiddenIndex];
        const candidateGradient = dc * cache.inputGate[hiddenIndex];
        const forgetGateGradient = dc * cache.cPrev[hiddenIndex];

        dz[hiddenIndex] = clipGradient(inputGateGradient * cache.inputGate[hiddenIndex] * (1 - cache.inputGate[hiddenIndex]));
        dz[HIDDEN_SIZE + hiddenIndex] = clipGradient(forgetGateGradient * cache.forgetGate[hiddenIndex] * (1 - cache.forgetGate[hiddenIndex]));
        dz[HIDDEN_SIZE * 2 + hiddenIndex] = clipGradient(candidateGradient * (1 - cache.candidate[hiddenIndex] * cache.candidate[hiddenIndex]));
        dz[HIDDEN_SIZE * 3 + hiddenIndex] = clipGradient(outputGateGradient * cache.outputGate[hiddenIndex] * (1 - cache.outputGate[hiddenIndex]));
        dcPrev[hiddenIndex] = dc * cache.forgetGate[hiddenIndex];
      }

      for (let ic = 0; ic < CONV_FILTERS; ic += 1) {
        let grad = 0;
        const inputOffset = ic * gateSize;
        for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
          grad += model.lstm.wh[inputOffset + gateIndex] * dz[gateIndex];
        }
        dhPrev[ic] = grad;
      }

      const frameGrad = new Float32Array(CONV_FILTERS);
      for (let ic = 0; ic < CONV_FILTERS; ic += 1) {
        frameGrad[ic] = dhPrev[ic];
        const inputOffset = ic * gateSize;
        for (let gateIndex = 0; gateIndex < gateSize; gateIndex += 1) {
          grads.lstmWx[inputOffset + gateIndex] += cache.frame[ic] * dz[gateIndex];
        }
      }

      for (let c = 0; c < CONV_FILTERS; c += 1) {
        lstmInputGrads[timeIndex * CONV_FILTERS + c] = frameGrad[c];
      }

      dhFromLstm.set(dhPrev);
      dcFromLstm.set(dcPrev);
    }
  }

  const poolGrad = maxpool1dBackward(lstmInputGrads, cnn.maxIndices, CONV_FILTERS);
  const relu2Grad = reluBackward(poolGrad, cnn.relu2Out);
  const conv2Grad = conv1dBackward(cnn.relu1Out, relu2Grad, model.conv2, 1);
  grads.conv2K.set(conv2Grad.gradKernel);
  grads.conv2B.set(conv2Grad.gradBias);
  const relu1Grad = reluBackward(conv2Grad.gradInput, cnn.relu1Out);
  const conv1Grad = conv1dBackward(cnn.conv1In, relu1Grad, model.conv1, 1);
  grads.conv1K.set(conv1Grad.gradKernel);
  grads.conv1B.set(conv1Grad.gradBias);

  updateModel(model, grads);
  return { loss, correct: predictedClass === sample.labelId ? 1 : 0 };
};

const createEmptyConfusionMatrix = (classCount) => {
  return Array.from({ length: classCount }, () => new Array(classCount).fill(0));
};

const computePerLabelMetrics = (confusionMatrix, labels) => {
  const perLabel = {};
  let macroPrecision = 0, macroRecall = 0, macroF1 = 0;
  let weightedPrecision = 0, weightedRecall = 0, weightedF1 = 0;
  let totalSupport = 0;

  for (let classIndex = 0; classIndex < labels.length; classIndex += 1) {
    const truePositive = confusionMatrix[classIndex][classIndex];
    let falsePositive = 0, falseNegative = 0, support = 0;
    for (let otherIndex = 0; otherIndex < labels.length; otherIndex += 1) {
      if (otherIndex !== classIndex) {
        falsePositive += confusionMatrix[otherIndex][classIndex];
        falseNegative += confusionMatrix[classIndex][otherIndex];
      }
      support += confusionMatrix[classIndex][otherIndex];
    }
    const precision = truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive);
    const recall = truePositive + falseNegative === 0 ? 0 : truePositive / (truePositive + falseNegative);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    perLabel[labels[classIndex]] = { precision, recall, f1, support };
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
    macroAverage: { precision: macroPrecision / labels.length, recall: macroRecall / labels.length, f1: macroF1 / labels.length, support: totalSupport },
    weightedAverage: { precision: totalSupport === 0 ? 0 : weightedPrecision / totalSupport, recall: totalSupport === 0 ? 0 : weightedRecall / totalSupport, f1: totalSupport === 0 ? 0 : weightedF1 / totalSupport, support: totalSupport }
  };
};

const evaluate = (model, samples, labels) => {
  const confusionMatrix = createEmptyConfusionMatrix(labels.length);
  let correct = 0, loss = 0;
  for (const sample of samples) {
    const { probabilities } = forward(model, sample);
    const predictedClass = predictionFromProbabilities(probabilities);
    loss += -Math.log(Math.max(probabilities[sample.labelId], Number.EPSILON));
    correct += predictedClass === sample.labelId ? 1 : 0;
    confusionMatrix[sample.labelId][predictedClass] += 1;
  }
  const metrics = computePerLabelMetrics(confusionMatrix, labels);
  return {
    sampleCount: samples.length,
    loss: loss / samples.length,
    accuracy: correct / samples.length,
    macroF1: metrics.macroAverage.f1,
    weightedF1: metrics.weightedAverage.f1,
    confusionMatrix,
    perLabelMetrics: metrics
  };
};

const roundedArray = (typedArray) =>
  Array.from(typedArray, (value) => Number(value.toFixed(8)));

const saveOutputs = ({ labelsData, metadata, model, trainMetrics, validationMetrics, testMetrics, history }) => {
  ensureDir(OUTPUT_DIR);
  const createdAt = new Date().toISOString();

  const config = {
    modelType: "cnn-lstm",
    description: "Stage 3 FSL alphabet CNN-LSTM hybrid sequence model.",
    architecture: {
      cnnLayers: [
        { type: "conv1d", filters: CONV_FILTERS, kernelSize: CONV_KERNEL_SIZE, padding: "same", activation: "relu", inputChannels: FEATURE_DIMENSION },
        { type: "conv1d", filters: CONV_FILTERS, kernelSize: CONV_KERNEL_SIZE, padding: "same", activation: "relu" },
        { type: "maxpool1d", poolSize: POOL_SIZE, stride: POOL_SIZE }
      ],
      recurrentLayers: [
        { type: "lstm", hiddenSize: HIDDEN_SIZE, direction: "forward" }
      ],
      classifier: { type: "dense-softmax", outputClasses: labelsData.labels.length }
    },
    sequenceLength: SEQUENCE_LENGTH,
    featureDimension: FEATURE_DIMENSION,
    inputShape: [SEQUENCE_LENGTH, FEATURE_DIMENSION],
    outputClasses: labelsData.labels.length,
    optimizer: "adam", learningRate: LEARNING_RATE,
    epochsRequested: EPOCHS, epochsCompleted: history.length,
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
    artifactType: "fsl-alphabet-cnn-lstm",
    createdAt,
    labels: labelsData.labels,
    labelToId: labelsData.labelToId,
    idToLabel: labelsData.idToLabel,
    config,
    weights: {
      conv1: { kernel: roundedArray(model.conv1.kernel), bias: roundedArray(model.conv1.bias) },
      conv2: { kernel: roundedArray(model.conv2.kernel), bias: roundedArray(model.conv2.bias) },
      lstm: { wx: roundedArray(model.lstm.wx), wh: roundedArray(model.lstm.wh), b: roundedArray(model.lstm.b) },
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

  const trainSamples = loadSplit("train", labelsData);
  const validationSamples = loadSplit("validation", labelsData);
  const testSamples = loadSplit("test", labelsData);
  const model = createModel(labelsData.labels.length);
  const history = [];
  const rng = mulberry32(RANDOM_SEED + 1);
  let bestValidationLoss = Number.POSITIVE_INFINITY;
  let epochsWithoutImprovement = 0;

  console.log("Training FSL alphabet Stage 3 CNN-LSTM");
  console.log(`Input shape: [${SEQUENCE_LENGTH}, ${FEATURE_DIMENSION}]`);
  console.log(`Conv1D: ${CONV_FILTERS} filters, kernel=${CONV_KERNEL_SIZE}, same padding`);
  console.log(`Conv1D x2 -> MaxPool(pool=${POOL_SIZE}) -> LSTM(${HIDDEN_SIZE}) -> Dense(${labelsData.labels.length})`);
  console.log(`CNN output steps: ${CNN_OUTPUT_STEPS}`);
  console.log(`Dropout: ${DROPOUT_RATE}`);
  console.log(`Samples -> train: ${trainSamples.length}, validation: ${validationSamples.length}, test: ${testSamples.length}`);

  for (let epoch = 1; epoch <= EPOCHS; epoch += 1) {
    const order = shuffle(Array.from({ length: trainSamples.length }, (_, index) => index), rng);
    let trainLoss = 0, trainCorrect = 0;

    for (const sampleIndex of order) {
      const result = trainSample(model, trainSamples[sampleIndex], rng);
      trainLoss += result.loss;
      trainCorrect += result.correct;
    }

    const valMetrics = evaluate(model, validationSamples, labelsData.labels);
    const epochStats = {
      epoch,
      trainLoss: trainLoss / trainSamples.length,
      trainAccuracy: trainCorrect / trainSamples.length,
      validationLoss: valMetrics.loss,
      validationAccuracy: valMetrics.accuracy
    };
    history.push(epochStats);

    console.log(
      `Epoch ${epoch}/${EPOCHS} - loss ${epochStats.trainLoss.toFixed(4)} acc ${formatPercent(epochStats.trainAccuracy)} val_loss ${epochStats.validationLoss.toFixed(4)} val_acc ${formatPercent(epochStats.validationAccuracy)}`
    );

    if (valMetrics.loss < bestValidationLoss - MIN_VALIDATION_DELTA) {
      bestValidationLoss = valMetrics.loss;
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

  saveOutputs({ labelsData, metadata, model, trainMetrics, validationMetrics, testMetrics, history });

  console.log("Stage 3 CNN-LSTM training complete.");
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
  console.error("Stage 3 CNN-LSTM training failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
