import fs from "fs";
import path from "path";

const ALPHA_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_kaggle_v2");
const FSL_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_105");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_unified", "cnn_bilstm");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const RANDOM_SEED = 2026;
const TEMPORAL_STEPS = Number.parseInt(process.env.CNN_TEMPORAL_STEPS ?? "30", 10);
const HIDDEN_SIZE = Number.parseInt(process.env.CNN_HIDDEN_SIZE ?? "32", 10);
const COMBINED_SIZE = HIDDEN_SIZE * 2;
const EPOCHS = Number.parseInt(process.env.CNN_EPOCHS ?? "60", 10);
const LEARNING_RATE = Number.parseFloat(process.env.CNN_LEARNING_RATE ?? "0.002");
const DROPOUT_RATE = Number.parseFloat(process.env.CNN_DROPOUT ?? "0.2");
const CNN_FILTERS = Number.parseInt(process.env.CNN_FILTERS ?? "64", 10);
const CNN_KERNEL = Number.parseInt(process.env.CNN_KERNEL ?? "3", 10);
const EARLY_STOPPING_PATIENCE = Number.parseInt(process.env.CNN_PATIENCE ?? "12", 10);
const MIN_VALIDATION_DELTA = 0.0001;
const GRADIENT_CLIP_VALUE = 1;
const BETA_1 = 0.9; const BETA_2 = 0.999; const EPSILON = 1e-8;

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const writeJson = (fp, p) => fs.writeFileSync(fp, JSON.stringify(p, null, 2));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const isValidNumber = (v) => typeof v === "number" && Number.isFinite(v);

const sigmoid = (v) => { if (v >= 0) { const z = Math.exp(-v); return 1 / (1 + z); } const z = Math.exp(v); return z / (1 + z); };
const clip = (v) => { if (v > GRADIENT_CLIP_VALUE) return GRADIENT_CLIP_VALUE; if (v < -GRADIENT_CLIP_VALUE) return -GRADIENT_CLIP_VALUE; return v; };

const mulberry = (s) => { let t = s >>> 0; return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; }; };
const randn = (rng) => { const u1 = Math.max(rng(), Number.EPSILON); const u2 = rng(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };

const shuffle = (items, rng) => { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items; };

const temporalFrameIndices = () => {
  if (TEMPORAL_STEPS === 1) return [SEQUENCE_LENGTH - 1];
  return Array.from({ length: TEMPORAL_STEPS }, (_, i) => Math.round((i * (SEQUENCE_LENGTH - 1)) / (TEMPORAL_STEPS - 1)));
};

const buildSparseFrame = (frame) => {
  if (!Array.isArray(frame) || frame.length !== FEATURE_DIMENSION) throw new Error("Frame dim mismatch");
  const indices = []; const values = [];
  for (let fi = 0; fi < FEATURE_DIMENSION; fi++) {
    const v = frame[fi]; if (!isValidNumber(v)) throw new Error("Invalid feature");
    if (v !== 0) { indices.push(fi); values.push(v); }
  }
  return { indices: Uint16Array.from(indices), values: Float32Array.from(values) };
};

const loadSplit = (samples, frameIndices) => samples.map((s) => ({
  label: s.label, labelId: s.labelId, signerId: s.signerId,
  frames: frameIndices.map((fi) => buildSparseFrame(s.sequence[fi]))
}));

const conv1d = (frames, kernel, bias, stride = 1) => {
  const inChannels = FEATURE_DIMENSION;
  const outChannels = CNN_FILTERS;
  const kLen = kernel.length / (inChannels * outChannels);
  const T = frames.length;
  const outT = Math.floor((T - kLen) / stride) + 1;
  const output = new Array(outT);
  for (let t = 0; t < outT; t++) {
    const convOut = new Float32Array(outChannels);
    for (let c = 0; c < outChannels; c++) {
      let sum = bias[c];
      for (let k = 0; k < kLen; k++) {
        for (let cin = 0; cin < inChannels; cin++) {
          const frameVal = frames[t * stride + k].values[frames[t * stride + k].indices.indexOf(cin)] ?? 0;
          if (frameVal !== 0) sum += frameVal * kernel[((c * kLen + k) * inChannels + cin)];
        }
      }
      convOut[c] = Math.max(0, sum);
    }
    output.push(convOut);
  }
  return output;
};

const createConvWeights = (rng) => {
  const kLen = CNN_KERNEL;
  const scale = Math.sqrt(2 / (FEATURE_DIMENSION * kLen));
  const kernel = new Float32Array(CNN_FILTERS * kLen * FEATURE_DIMENSION);
  const bias = new Float32Array(CNN_FILTERS);
  for (let i = 0; i < kernel.length; i++) kernel[i] = randn(rng) * scale;
  return { kernel, bias };
};

const createLstmWeights = (rng, inputSize) => {
  const gateSize = HIDDEN_SIZE * 4;
  const wx = new Float32Array(inputSize * gateSize);
  const wh = new Float32Array(HIDDEN_SIZE * gateSize);
  const b = new Float32Array(gateSize);
  const wxScale = Math.sqrt(1 / inputSize);
  const whScale = Math.sqrt(1 / HIDDEN_SIZE);
  for (let i = 0; i < wx.length; i++) wx[i] = randn(rng) * wxScale;
  for (let i = 0; i < wh.length; i++) wh[i] = randn(rng) * whScale;
  for (let hi = 0; hi < HIDDEN_SIZE; hi++) b[HIDDEN_SIZE + hi] = 1;
  return { wx, wh, b };
};

const createModel = (outputClasses) => {
  const rng = mulberry(RANDOM_SEED);
  const conv = createConvWeights(rng);
  const fwd = createLstmWeights(rng, CNN_FILTERS);
  const bwd = createLstmWeights(rng, CNN_FILTERS);
  const wyScale = Math.sqrt(2 / COMBINED_SIZE);
  const wy = new Float32Array(COMBINED_SIZE * outputClasses);
  const by = new Float32Array(outputClasses);
  for (let i = 0; i < wy.length; i++) wy[i] = randn(rng) * wyScale;
  const opt = (sz) => ({ m: new Float32Array(sz), v: new Float32Array(sz) });
  return {
    convKernel: conv.kernel, convBias: conv.bias,
    lstmFwd: fwd, lstmBwd: bwd, wy, by, outputClasses,
    optConvK: opt(conv.kernel.length), optConvB: opt(conv.bias.length),
    optFwdWx: opt(fwd.wx.length), optFwdWh: opt(fwd.wh.length), optFwdB: opt(fwd.b.length),
    optBwdWx: opt(bwd.wx.length), optBwdWh: opt(bwd.wh.length), optBwdB: opt(bwd.b.length),
    optWy: opt(wy.length), optBy: opt(by.length),
    optStep: 0, optBeta1Power: 1, optBeta2Power: 1
  };
};

const lstmForward = (frames, wx, wh, b, reverse) => {
  const gateSize = HIDDEN_SIZE * 4;
  let hPrev = new Float32Array(HIDDEN_SIZE), cPrev = new Float32Array(HIDDEN_SIZE);
  const caches = [];
  const seq = reverse ? [...frames].reverse() : frames;
  for (const frame of seq) {
    const z = new Float32Array(gateSize); z.set(b);
    for (let fi = 0; fi < frame.length; fi++) {
      const val = frame[fi]; if (val === 0) continue;
      const off = fi * gateSize;
      for (let g = 0; g < gateSize; g++) z[g] += val * wx[off + g];
    }
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const hv = hPrev[hi]; if (hv === 0) continue;
      const off = hi * gateSize;
      for (let g = 0; g < gateSize; g++) z[g] += hv * wh[off + g];
    }
    const ig = new Float32Array(HIDDEN_SIZE), fg = new Float32Array(HIDDEN_SIZE);
    const cand = new Float32Array(HIDDEN_SIZE), og = new Float32Array(HIDDEN_SIZE);
    const c = new Float32Array(HIDDEN_SIZE), h = new Float32Array(HIDDEN_SIZE);
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const i = sigmoid(z[hi]), f = sigmoid(z[HIDDEN_SIZE + hi]);
      const g = Math.tanh(z[HIDDEN_SIZE * 2 + hi]), o = sigmoid(z[HIDDEN_SIZE * 3 + hi]);
      const cv = f * cPrev[hi] + i * g;
      ig[hi] = i; fg[hi] = f; cand[hi] = g; og[hi] = o;
      c[hi] = cv; h[hi] = o * Math.tanh(cv);
    }
    caches.push({ frame, hPrev, cPrev, ig, fg, cand, og, c, h });
    hPrev = h; cPrev = c;
  }
  return { finalH: caches[caches.length - 1].h, caches };
};

const dmask = (sz, rng) => {
  const m = new Float32Array(sz);
  if (DROPOUT_RATE <= 0) { m.fill(1); return m; }
  const kp = 1 - DROPOUT_RATE, s = 1 / kp;
  for (let i = 0; i < sz; i++) m[i] = rng() < kp ? s : 0;
  return m;
};

const forwardCNNBiLSTM = (model, sample, { training = false, rng = null } = {}) => {
  const kLen = CNN_KERNEL;
  const T = sample.frames.length;
  const outT = T - kLen + 1;
  const convOut = [];
  for (let t = 0; t < outT; t++) {
    const co = new Float32Array(CNN_FILTERS);
    for (let c = 0; c < CNN_FILTERS; c++) {
      let s = model.convBias[c];
      for (let k = 0; k < kLen; k++) {
        const frame = sample.frames[t + k];
        for (let fi = 0; fi < frame.indices.length; fi++) {
          const idx = frame.indices[fi], val = frame.values[fi];
          s += val * model.convKernel[((c * kLen + k) * FEATURE_DIMENSION) + idx];
        }
      }
      co[c] = Math.max(0, s);
    }
    convOut.push(co);
  }
  const fwdRes = lstmForward(convOut, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b, false);
  const bwdRes = lstmForward(convOut, model.lstmBwd.wx, model.lstmBwd.wh, model.lstmBwd.b, true);
  const combined = new Float32Array(COMBINED_SIZE);
  combined.set(fwdRes.finalH); combined.set(bwdRes.finalH, HIDDEN_SIZE);
  const mask = training ? dmask(COMBINED_SIZE, rng) : null;
  const inp = new Float32Array(COMBINED_SIZE);
  for (let i = 0; i < COMBINED_SIZE; i++) inp[i] = combined[i] * (mask?.[i] ?? 1);
  const logits = new Float32Array(model.outputClasses); logits.set(model.by);
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const hv = inp[hi]; if (hv === 0) continue;
    const off = hi * model.outputClasses;
    for (let ci = 0; ci < model.outputClasses; ci++) logits[ci] += hv * model.wy[off + ci];
  }
  let mx = Number.NEGATIVE_INFINITY; for (const l of logits) mx = Math.max(mx, l);
  const probs = new Float32Array(model.outputClasses); let sum = 0;
  for (let ci = 0; ci < model.outputClasses; ci++) { const p = Math.exp(logits[ci] - mx); probs[ci] = p; sum += p; }
  for (let ci = 0; ci < model.outputClasses; ci++) probs[ci] /= sum;
  return { fwdRes, bwdRes, convOut, inp, mask, probs };
};

const predict = (probs) => { let best = 0; for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i; return best; };

const applyAdam = (w, g, m, v, step, b1p, b2p, lr) => {
  for (let i = 0; i < w.length; i++) {
    if (g[i] === 0) continue;
    m[i] = BETA_1 * m[i] + (1 - BETA_1) * g[i];
    v[i] = BETA_2 * v[i] + (1 - BETA_2) * g[i] * g[i];
    w[i] -= (lr * m[i] / (1 - b1p)) / (Math.sqrt(v[i] / (1 - b2p)) + EPSILON);
  }
};

const lstmBptt = (caches, dhNext, dcNext, wx, wh, b) => {
  const gateSize = HIDDEN_SIZE * 4;
  const grads = { wx: new Float32Array(wx.length), wh: new Float32Array(wh.length), b: new Float32Array(b.length) };
  for (let ti = caches.length - 1; ti >= 0; ti--) {
    const cache = caches[ti]; const dz = new Float32Array(gateSize);
    const dhP = new Float32Array(HIDDEN_SIZE), dcP = new Float32Array(HIDDEN_SIZE);
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const cv = cache.c[hi], th = Math.tanh(cv);
      const dh = dhNext[hi], dc = dcNext[hi] + dh * cache.og[hi] * (1 - th * th);
      const ogG = dh * th, igG = dc * cache.cand[hi], candG = dc * cache.ig[hi], fgG = dc * cache.cPrev[hi];
      dz[hi] = clip(igG * cache.ig[hi] * (1 - cache.ig[hi]));
      dz[HIDDEN_SIZE + hi] = clip(fgG * cache.fg[hi] * (1 - cache.fg[hi]));
      dz[HIDDEN_SIZE * 2 + hi] = clip(candG * (1 - cache.cand[hi] * cache.cand[hi]));
      dz[HIDDEN_SIZE * 3 + hi] = clip(ogG * cache.og[hi] * (1 - cache.og[hi]));
      dcP[hi] = dc * cache.fg[hi];
    }
    for (let fi = 0; fi < cache.frame.length; fi++) {
      const val = cache.frame[fi]; if (val === 0) continue;
      const off = fi * gateSize;
      for (let g = 0; g < gateSize; g++) grads.wx[off + g] += val * dz[g];
    }
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const off = hi * gateSize;
      for (let g = 0; g < gateSize; g++) { grads.wh[off + g] += cache.hPrev[hi] * dz[g]; dhP[hi] += wh[off + g] * dz[g]; }
    }
    for (let g = 0; g < gateSize; g++) grads.b[g] += dz[g];
    dhNext.set(dhP); dcNext.set(dcP);
  }
  for (const arr of Object.values(grads)) for (let i = 0; i < arr.length; i++) arr[i] = clip(arr[i]);
  return grads;
};

const updateModel = (model, grads) => {
  model.optStep++; model.optBeta1Power *= BETA_1; model.optBeta2Power *= BETA_2;
  const ap = (w, g, mArr, vArr) => applyAdam(w, g, mArr, vArr, model.optStep, model.optBeta1Power, model.optBeta2Power, LEARNING_RATE);
  ap(model.convKernel, grads.convKernel, model.optConvK.m, model.optConvK.v);
  ap(model.convBias, grads.convBias, model.optConvB.m, model.optConvB.v);
  ap(model.lstmFwd.wx, grads.fwd.wx, model.optFwdWx.m, model.optFwdWx.v);
  ap(model.lstmFwd.wh, grads.fwd.wh, model.optFwdWh.m, model.optFwdWh.v);
  ap(model.lstmFwd.b, grads.fwd.b, model.optFwdB.m, model.optFwdB.v);
  ap(model.lstmBwd.wx, grads.bwd.wx, model.optBwdWx.m, model.optBwdWx.v);
  ap(model.lstmBwd.wh, grads.bwd.wh, model.optBwdWh.m, model.optBwdWh.v);
  ap(model.lstmBwd.b, grads.bwd.b, model.optBwdB.m, model.optBwdB.v);
  ap(model.wy, grads.wy, model.optWy.m, model.optWy.v);
  ap(model.by, grads.by, model.optBy.m, model.optBy.v);
};

const trainSample = (model, sample, rng) => {
  const { fwdRes, bwdRes, convOut, inp, mask, probs } = forwardCNNBiLSTM(model, sample, { training: true, rng });
  const loss = -Math.log(Math.max(probs[sample.labelId], Number.EPSILON));
  const pred = predict(probs);
  const delta = Float32Array.from(probs); delta[sample.labelId] -= 1;
  const grads = {
    convKernel: new Float32Array(model.convKernel.length), convBias: new Float32Array(model.convBias.length),
    fwd: { wx: new Float32Array(model.lstmFwd.wx.length), wh: new Float32Array(model.lstmFwd.wh.length), b: new Float32Array(model.lstmFwd.b.length) },
    bwd: { wx: new Float32Array(model.lstmBwd.wx.length), wh: new Float32Array(model.lstmBwd.wh.length), b: new Float32Array(model.lstmBwd.b.length) },
    wy: new Float32Array(model.wy.length), by: new Float32Array(model.by.length)
  };
  for (let ci = 0; ci < model.outputClasses; ci++) grads.by[ci] += delta[ci];
  const dh = new Float32Array(COMBINED_SIZE);
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const off = hi * model.outputClasses; let g = 0;
    for (let ci = 0; ci < model.outputClasses; ci++) { grads.wy[off + ci] += inp[hi] * delta[ci]; g += model.wy[off + ci] * delta[ci]; }
    dh[hi] = g * (mask?.[hi] ?? 1);
  }
  const dhF = new Float32Array(HIDDEN_SIZE), dhB = new Float32Array(HIDDEN_SIZE);
  for (let i = 0; i < HIDDEN_SIZE; i++) { dhF[i] = dh[i]; dhB[i] = dh[HIDDEN_SIZE + i]; }
  const dcF = new Float32Array(HIDDEN_SIZE), dcB = new Float32Array(HIDDEN_SIZE);
  const fwdG = lstmBptt(fwdRes.caches, dhF, dcF, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b);
  const bwdG = lstmBptt(bwdRes.caches, dhB, dcB, model.lstmBwd.wx, model.lstmBwd.wh, model.lstmBwd.b);
  grads.fwd.wx.set(fwdG.wx); grads.fwd.wh.set(fwdG.wh); grads.fwd.b.set(fwdG.b);
  grads.bwd.wx.set(bwdG.wx); grads.bwd.wh.set(bwdG.wh); grads.bwd.b.set(bwdG.b);

  const kLen = CNN_KERNEL;
  const outT = TEMPORAL_STEPS - kLen + 1;
  for (let c = 0; c < CNN_FILTERS; c++) {
    let gBias = 0;
    for (let t = 0; t < outT; t++) {
      const dH = new Float32Array(HIDDEN_SIZE), dC = new Float32Array(HIDDEN_SIZE);
      const dHr = lstmBptt(fwdRes.caches.slice(t, t + 1), dH, dC, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b);
      gBias += dHr.wx[0];
    }
    grads.convBias[c] = clip(gBias);
  }

  updateModel(model, grads);
  return { loss, correct: pred === sample.labelId ? 1 : 0 };
};

const createEmptyCM = (n) => Array.from({ length: n }, () => new Array(n).fill(0));

const computePLM = (cm, labels) => {
  const pl = {}; let mp = 0, mr = 0, mf = 0; let wp = 0, wr = 0, wf = 0; let ts = 0;
  for (let ci = 0; ci < labels.length; ci++) {
    const tp = cm[ci][ci]; let fp = 0, fn = 0, sup = 0;
    for (let oj = 0; oj < labels.length; oj++) { if (oj !== ci) { fp += cm[oj][ci]; fn += cm[ci][oj]; } sup += cm[ci][oj]; }
    const p = tp + fp === 0 ? 0 : tp / (tp + fp), r = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = p + r === 0 ? 0 : (2 * p * r) / (p + r);
    pl[labels[ci]] = { p, r, f1, sup }; mp += p; mr += r; mf += f1; wp += p * sup; wr += r * sup; wf += f1 * sup; ts += sup;
  }
  return { labels: pl, macro: { p: mp / labels.length, r: mr / labels.length, f1: mf / labels.length, sup: ts }, weighted: { p: ts === 0 ? 0 : wp / ts, r: ts === 0 ? 0 : wr / ts, f1: ts === 0 ? 0 : wf / ts, sup: ts } };
};

const evaluate = (model, samples, labels) => {
  const cm = createEmptyCM(labels.length); let cor = 0, loss = 0;
  for (const s of samples) {
    const { probs } = forwardCNNBiLSTM(model, s); const p = predict(probs);
    loss += -Math.log(Math.max(probs[s.labelId], Number.EPSILON)); cor += p === s.labelId ? 1 : 0;
    cm[s.labelId][p] += 1;
  }
  const m = computePLM(cm, labels);
  return { n: samples.length, loss: loss / samples.length, acc: cor / samples.length, macroF1: m.macro.f1, weightedF1: m.weighted.f1, cm, plm: m };
};

const roundArr = (ta) => Array.from(ta, (v) => Number(v.toFixed(8)));

const saveOutputs = ({ labelsData, meta, model, frameIndices, trainM, valM, testM, hist }) => {
  ensureDir(OUTPUT_DIR);
  const cfg = {
    modelType: "unified-cnn-bilstm",
    desc: "CNN-BiLSTM: 1D Conv + BiLSTM on unified data.",
    arch: {
      cnn: { filters: CNN_FILTERS, kernelSize: CNN_KERNEL },
      lstm: { hiddenSize: HIDDEN_SIZE, temporalSteps: TEMPORAL_STEPS, dropout: DROPOUT_RATE },
      combinedSize: COMBINED_SIZE, outputClasses: labelsData.labels.length
    },
    dataset: { splits: meta.splits },
    lr: LEARNING_RATE, epochs: hist.length, patience: EARLY_STOPPING_PATIENCE, createdAt: new Date().toISOString()
  };
  writeJson(path.join(OUTPUT_DIR, "labels.json"), labelsData);
  writeJson(path.join(OUTPUT_DIR, "config.json"), cfg);
  writeJson(path.join(OUTPUT_DIR, "metrics.json"), {
    trainAcc: trainM.acc, valAcc: valM.acc, testAcc: testM.acc, testLoss: testM.loss,
    macroF1: testM.macroF1, weightedF1: testM.weightedF1,
    train: trainM, val: valM, test: testM, history: hist
  });
  writeJson(path.join(OUTPUT_DIR, "confusion_matrix.json"), { labels: labelsData.labels, matrix: testM.cm });
  writeJson(path.join(OUTPUT_DIR, "model.json"), {
    artifactType: "cnn-bilstm", createdAt: new Date().toISOString(),
    labels: labelsData.labels, config: cfg,
    weights: {
      convKernel: roundArr(model.convKernel), convBias: roundArr(model.convBias),
      lstmFwd: { wx: roundArr(model.lstmFwd.wx), wh: roundArr(model.lstmFwd.wh), b: roundArr(model.lstmFwd.b) },
      lstmBwd: { wx: roundArr(model.lstmBwd.wx), wh: roundArr(model.lstmBwd.wh), b: roundArr(model.lstmBwd.b) },
      wy: roundArr(model.wy), by: roundArr(model.by)
    }
  });
};

const fmtPct = (v) => `${(v * 100).toFixed(2)}%`;

const main = () => {
  const aLabels = readJson(path.join(ALPHA_DIR, "labels.json"));
  const fLabels = readJson(path.join(FSL_DIR, "labels.json"));
  const meta = readJson(path.join(process.cwd(), "datasets", "processed", "fsl_unified", "metadata.json"));
  const allLabels = [...aLabels.labels, ...fLabels.labels];
  const alphaCount = aLabels.labels.length;
  const ld = { labels: allLabels };
  const fi = temporalFrameIndices();
  const aTr = readJson(path.join(ALPHA_DIR, "train.json"));
  const aTe = readJson(path.join(ALPHA_DIR, "test.json"));
  const fTr = readJson(path.join(FSL_DIR, "train.json"));
  const fTe = readJson(path.join(FSL_DIR, "test.json"));
  const remap = (s) => s.map((x) => ({ ...x, labelId: x.labelId + alphaCount }));
  const fTrR = remap(fTr.samples);
  const fTeR = remap(fTe.samples);
  const allTrRaw = [...aTr.samples, ...fTrR];
  const allTeRaw = [...aTe.samples, ...fTeR];
  const rng = mulberry(RANDOM_SEED + 1);
  const order = shuffle(Array.from({ length: allTrRaw.length }, (_, i) => i), rng);
  const vc = Math.max(1, Math.floor(allTrRaw.length * 0.15));
  const vo = new Set(order.slice(0, vc));
  const trainB = []; const valB = [];
  for (let i = 0; i < allTrRaw.length; i++) { if (vo.has(i)) valB.push(allTrRaw[i]); else trainB.push(allTrRaw[i]); }
  const trS = loadSplit(trainB, fi);
  const vaS = loadSplit(valB, fi);
  const teS = loadSplit(allTeRaw, fi);

  console.log("CNN-BiLSTM Training");
  console.log(`Classes: ${allLabels.length}, CNN filters: ${CNN_FILTERS}, kernel: ${CNN_KERNEL}`);
  console.log(`Split: train=${trS.length}, val=${vaS.length}, test=${teS.length}`);

  const model = createModel(allLabels.length);
  const hist = [];
  const trRng = mulberry(RANDOM_SEED + 2);
  let bestLoss = Number.POSITIVE_INFINITY, noImp = 0;

  for (let ep = 1; ep <= EPOCHS; ep++) {
    const to = shuffle(Array.from({ length: trS.length }, (_, i) => i), trRng);
    let tLoss = 0, tCor = 0;
    for (const si of to) {
      const r = trainSample(model, trS[si], trRng);
      tLoss += r.loss; tCor += r.correct;
    }
    const vM = evaluate(model, vaS, allLabels);
    hist.push({ ep, tLoss: tLoss / trS.length, tAcc: tCor / trS.length, vLoss: vM.loss, vAcc: vM.acc, vF1: vM.macroF1 });
    console.log(`Epoch ${ep}/${EPOCHS} loss=${(tLoss / trS.length).toFixed(4)} acc=${fmtPct(tCor / trS.length)} v_loss=${vM.loss.toFixed(4)} v_acc=${fmtPct(vM.acc)} v_f1=${fmtPct(vM.macroF1)}`);
    if (vM.loss < bestLoss - MIN_VALIDATION_DELTA) { bestLoss = vM.loss; noImp = 0; } else { noImp++; if (noImp >= EARLY_STOPPING_PATIENCE) break; }
  }

  const tM = evaluate(model, trS, allLabels);
  const vM = evaluate(model, vaS, allLabels);
  const teM = evaluate(model, teS, allLabels);
  saveOutputs({ labelsData: ld, meta, model, frameIndices: fi, trainM: tM, valM: vM, testM: teM, hist });

  console.log(`\nTrain: ${fmtPct(tM.acc)} Val: ${fmtPct(vM.acc)} Test: ${fmtPct(teM.acc)} F1: ${fmtPct(teM.macroF1)}`);
};

main();
