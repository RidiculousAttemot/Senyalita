import fs from "fs";
import path from "path";

const ALPHA_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_v2");
const FSL_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_105");
const BALANCED_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_unified_balanced");
const HARD_DIR = path.join(process.cwd(), "datasets", "hard_samples");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_unified_v3");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const RANDOM_SEED = 2026;
const TEMPORAL_STEPS = Number.parseInt(process.env.V3_TEMPORAL_STEPS ?? "35", 10);
const HIDDEN_SIZE = Number.parseInt(process.env.V3_HIDDEN_SIZE ?? "48", 10);
const COMBINED_SIZE = HIDDEN_SIZE * 2;
const ATTN_SIZE = Number.parseInt(process.env.V3_ATTN_SIZE ?? "64", 10);
const EPOCHS = Number.parseInt(process.env.V3_EPOCHS ?? "100", 10);
const BASE_LEARNING_RATE = Number.parseFloat(process.env.V3_LEARNING_RATE ?? "0.002");
const DROPOUT_RATE = Number.parseFloat(process.env.V3_DROPOUT ?? "0.25");
const EARLY_STOPPING_PATIENCE = Number.parseInt(process.env.V3_PATIENCE ?? "18", 10);
const MIN_VALIDATION_DELTA = 0.0001;
const GRADIENT_CLIP_VALUE = 1;
const BETA_1 = 0.9; const BETA_2 = 0.999; const EPSILON = 1e-8;
const LABEL_SMOOTHING = Number.parseFloat(process.env.V3_LABEL_SMOOTHING ?? "0.1");
const FOCAL_GAMMA = Number.parseFloat(process.env.V3_FOCAL_GAMMA ?? "2.0");
const USE_BALANCED = process.env.V3_USE_BALANCED === "true";
const USE_HARD = process.env.V3_USE_HARD === "true";

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const writeJson = (fp, d) => fs.writeFileSync(fp, JSON.stringify(d, null, 2));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const isValidNumber = (v) => typeof v === "number" && Number.isFinite(v);

const sigmoid = (v) => { if (v >= 0) { const z = Math.exp(-v); return 1 / (1 + z); } const z = Math.exp(v); return z / (1 + z); };
const clipGradient = (v) => { if (v > GRADIENT_CLIP_VALUE) return GRADIENT_CLIP_VALUE; if (v < -GRADIENT_CLIP_VALUE) return -GRADIENT_CLIP_VALUE; return v; };
const gelu = (v) => 0.5 * v * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (v + 0.044715 * v * v * v)));
const geluDeriv = (v) => { const z = Math.sqrt(2 / Math.PI) * (v + 0.044715 * v * v * v); const t = Math.tanh(z); return 0.5 * (1 + t) + 0.5 * v * (1 - t * t) * Math.sqrt(2 / Math.PI) * (1 + 3 * 0.044715 * v * v); };

const mulberry32 = (s) => {
  let t = s >>> 0;
  return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; };
};
const randomNormal = (rng) => { const u1 = Math.max(rng(), Number.EPSILON); const u2 = rng(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };

const shuffle = (items, rng) => {
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
};

const temporalFrameIndices = () => {
  if (TEMPORAL_STEPS === 1) return [SEQUENCE_LENGTH - 1];
  return Array.from({ length: TEMPORAL_STEPS }, (_, i) => Math.round((i * (SEQUENCE_LENGTH - 1)) / (TEMPORAL_STEPS - 1)));
};

const buildSparseFrame = (frame) => {
  if (!Array.isArray(frame) || frame.length !== FEATURE_DIMENSION) throw new Error("Frame dimension mismatch");
  const indices = []; const values = [];
  for (let fi = 0; fi < FEATURE_DIMENSION; fi++) {
    const v = frame[fi]; if (!isValidNumber(v)) throw new Error("Invalid feature");
    if (v !== 0) { indices.push(fi); values.push(v); }
  }
  return { indices: Uint16Array.from(indices), values: Float32Array.from(values) };
};

const loadSplit = (samples, frameIndices) => samples.map((s) => ({
  label: s.label, labelId: s.labelId, signerId: s.signerId,
  frames: frameIndices.map((fi) => buildSparseFrame(s.sequence[fi])),
  hardWeight: s.weight ?? 1.0,
}));

const createLstmWeights = (rng, inputSize) => {
  const gateSize = HIDDEN_SIZE * 4;
  const wx = new Float32Array(inputSize * gateSize);
  const wh = new Float32Array(HIDDEN_SIZE * gateSize);
  const b = new Float32Array(gateSize);
  const wxScale = Math.sqrt(1 / inputSize);
  const whScale = Math.sqrt(1 / HIDDEN_SIZE);
  for (let i = 0; i < wx.length; i++) wx[i] = randomNormal(rng) * wxScale;
  for (let i = 0; i < wh.length; i++) wh[i] = randomNormal(rng) * whScale;
  for (let hi = 0; hi < HIDDEN_SIZE; hi++) b[HIDDEN_SIZE + hi] = 1;
  return { wx, wh, b };
};

const createModel = (nClasses) => {
  const rng = mulberry32(RANDOM_SEED);
  const fwd = createLstmWeights(rng, FEATURE_DIMENSION);
  const bwd = createLstmWeights(rng, FEATURE_DIMENSION);
  const attnW = new Float32Array(COMBINED_SIZE * ATTN_SIZE);
  const attnV = new Float32Array(ATTN_SIZE);
  const attnScale = Math.sqrt(1 / COMBINED_SIZE);
  for (let i = 0; i < attnW.length; i++) attnW[i] = randomNormal(rng) * attnScale;
  for (let i = 0; i < attnV.length; i++) attnV[i] = randomNormal(rng) * 0.01;
  const lnG = new Float32Array(COMBINED_SIZE); lnG.fill(1);
  const lnB = new Float32Array(COMBINED_SIZE);
  const wyScale = Math.sqrt(2 / COMBINED_SIZE);
  const wy = new Float32Array(COMBINED_SIZE * nClasses);
  const by = new Float32Array(nClasses);
  for (let i = 0; i < wy.length; i++) wy[i] = randomNormal(rng) * wyScale;
  const opt = (sz) => ({ m: new Float32Array(sz), v: new Float32Array(sz) });
  return {
    lstmFwd: fwd, lstmBwd: bwd,
    attnW, attnV, lnG, lnB,
    wy, by, nClasses,
    optFwdWx: opt(fwd.wx.length), optFwdWh: opt(fwd.wh.length), optFwdB: opt(fwd.b.length),
    optBwdWx: opt(bwd.wx.length), optBwdWh: opt(bwd.wh.length), optBwdB: opt(bwd.b.length),
    optAttnW: opt(attnW.length), optAttnV: opt(attnV.length),
    optLnG: opt(lnG.length), optLnB: opt(lnB.length),
    optWy: opt(wy.length), optBy: opt(by.length),
    step: 0, b1p: 1, b2p: 1,
  };
};

const lstmForward = (frames, wx, wh, b, rev) => {
  const gs = HIDDEN_SIZE * 4;
  let hP = new Float32Array(HIDDEN_SIZE), cP = new Float32Array(HIDDEN_SIZE);
  const caches = [];
  const seq = rev ? [...frames].reverse() : frames;
  for (const fr of seq) {
    const z = new Float32Array(gs); z.set(b);
    for (let fi = 0; fi < fr.indices.length; fi++) {
      const ii = fr.indices[fi], iv = fr.values[fi]; const off = ii * gs;
      for (let g = 0; g < gs; g++) z[g] += iv * wx[off + g];
    }
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const hv = hP[hi]; if (hv === 0) continue; const off = hi * gs;
      for (let g = 0; g < gs; g++) z[g] += hv * wh[off + g];
    }
    const ig = new Float32Array(HIDDEN_SIZE), fg = new Float32Array(HIDDEN_SIZE);
    const cand = new Float32Array(HIDDEN_SIZE), og = new Float32Array(HIDDEN_SIZE);
    const c = new Float32Array(HIDDEN_SIZE), h = new Float32Array(HIDDEN_SIZE);
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const i = sigmoid(z[hi]), f = sigmoid(z[HIDDEN_SIZE + hi]);
      const g = Math.tanh(z[HIDDEN_SIZE * 2 + hi]), o = sigmoid(z[HIDDEN_SIZE * 3 + hi]);
      const cv = f * cP[hi] + i * g;
      ig[hi] = i; fg[hi] = f; cand[hi] = g; og[hi] = o; c[hi] = cv; h[hi] = o * Math.tanh(cv);
    }
    caches.push({ frame: fr, hP, cP, ig, fg, cand, og, c, h });
    hP = h; cP = c;
  }
  return { caches };
};

const attention = (allHidden, attnW, attnV) => {
  const T = allHidden.length;
  const scores = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    const h = allHidden[t];
    const u = new Float32Array(ATTN_SIZE);
    for (let hi = 0; hi < COMBINED_SIZE; hi++) {
      if (h[hi] === 0) continue;
      for (let aj = 0; aj < ATTN_SIZE; aj++) u[aj] += h[hi] * attnW[hi * ATTN_SIZE + aj];
    }
    let s = 0;
    for (let aj = 0; aj < ATTN_SIZE; aj++) s += u[aj] * attnV[aj];
    scores[t] = s;
  }
  let mx = scores[0]; for (let t = 1; t < T; t++) if (scores[t] > mx) mx = scores[t];
  let sum = 0;
  for (let t = 0; t < T; t++) { scores[t] = Math.exp(scores[t] - mx); sum += scores[t]; }
  for (let t = 0; t < T; t++) scores[t] /= sum;
  const ctx = new Float32Array(COMBINED_SIZE);
  for (let t = 0; t < T; t++) {
    for (let hi = 0; hi < COMBINED_SIZE; hi++) ctx[hi] += allHidden[t][hi] * scores[t];
  }
  return { ctx, scores };
};

const layerNorm = (x, g, b, n) => {
  let mean = 0, var_ = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  for (let i = 0; i < n; i++) var_ += (x[i] - mean) ** 2;
  var_ /= n;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = g[i] * (x[i] - mean) / Math.sqrt(var_ + 1e-5) + b[i];
  return { out, mean, std: Math.sqrt(var_ + 1e-5) };
};

const dmask = (sz, rng) => {
  const m = new Float32Array(sz); if (DROPOUT_RATE <= 0) { m.fill(1); return m; }
  const kp = 1 - DROPOUT_RATE, s = 1 / kp;
  for (let i = 0; i < sz; i++) m[i] = rng() < kp ? s : 0;
  return m;
};

const forward = (model, sample, { training = false, rng = null } = {}) => {
  const fwdR = lstmForward(sample.frames, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b, false);
  const bwdR = lstmForward(sample.frames, model.lstmBwd.wx, model.lstmBwd.wh, model.lstmBwd.b, true);
  const T = sample.frames.length;
  const allHidden = [];
  for (let t = 0; t < T; t++) {
    const h = new Float32Array(COMBINED_SIZE);
    h.set(fwdR.caches[t].h); h.set(bwdR.caches[T - 1 - t].h, HIDDEN_SIZE);
    allHidden.push(h);
  }
  const { ctx, scores } = attention(allHidden, model.attnW, model.attnV);
  const ln = layerNorm(ctx, model.lnG, model.lnB, COMBINED_SIZE);
  let classifierInput = new Float32Array(ln.out);
  if (training) {
    for (let i = 0; i < COMBINED_SIZE; i++) classifierInput[i] = gelu(classifierInput[i]);
  }
  const mask = training ? dmask(COMBINED_SIZE, rng) : null;
  const inp = new Float32Array(COMBINED_SIZE);
  for (let i = 0; i < COMBINED_SIZE; i++) inp[i] = classifierInput[i] * (mask?.[i] ?? 1);
  const logits = new Float32Array(model.nClasses); logits.set(model.by);
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const hv = inp[hi]; if (hv === 0) continue; const off = hi * model.nClasses;
    for (let ci = 0; ci < model.nClasses; ci++) logits[ci] += hv * model.wy[off + ci];
  }
  let mxL = logits[0]; for (let ci = 1; ci < model.nClasses; ci++) if (logits[ci] > mxL) mxL = logits[ci];
  const probs = new Float32Array(model.nClasses); let ps = 0;
  for (let ci = 0; ci < model.nClasses; ci++) { const p = Math.exp(logits[ci] - mxL); probs[ci] = p; ps += p; }
  for (let ci = 0; ci < model.nClasses; ci++) probs[ci] /= ps;
  return { fwdCaches: fwdR.caches, bwdCaches: bwdR.caches, allHidden, ctx, scores, ln, inp, mask, probs };
};

const predict = (probs) => { let b = 0; for (let i = 1; i < probs.length; i++) if (probs[i] > probs[b]) b = i; return b; };

const computeClassWeights = (samples, nClasses) => {
  const counts = new Array(nClasses).fill(0);
  for (const s of samples) counts[s.labelId] += 1;
  const maxCount = Math.max(...counts);
  return counts.map((c) => c > 0 ? maxCount / c : 1.0);
};

const computeFocalTarget = (probs, labelId, gamma) => {
  const pt = Math.max(probs[labelId], Number.EPSILON);
  const modulating = Math.pow(1 - pt, gamma);
  const target = new Float32Array(probs.length);
  for (let i = 0; i < probs.length; i++) target[i] = 0;
  target[labelId] = 1;
  return { target, modulating };
};

const computeLoss = (probs, labelId, nClasses, smoothing, gamma, classWeight) => {
  const pt = Math.max(probs[labelId], Number.EPSILON);
  const focal = Math.pow(1 - pt, gamma);
  let loss = -focal * Math.log(pt) * classWeight;
  if (smoothing > 0) {
    const eps = smoothing / nClasses;
    const confident = 1 - smoothing + eps;
    let smoothLoss = 0;
    for (let i = 0; i < nClasses; i++) {
      const t = i === labelId ? confident : eps;
      smoothLoss -= t * Math.log(Math.max(probs[i], Number.EPSILON));
    }
    loss = loss * 0.5 + smoothLoss * 0.5;
  }
  return loss;
};

const applyAdam = (w, g, m, v, step, b1p, b2p, lr) => {
  for (let i = 0; i < w.length; i++) {
    if (g[i] === 0) continue;
    m[i] = BETA_1 * m[i] + (1 - BETA_1) * g[i];
    v[i] = BETA_2 * v[i] + (1 - BETA_2) * g[i] * g[i];
    w[i] -= (lr * m[i] / (1 - b1p)) / (Math.sqrt(v[i] / (1 - b2p)) + EPSILON);
  }
};

const cosineDecay = (epoch, totalEpochs, baseLr) => {
  const progress = epoch / totalEpochs;
  return baseLr * 0.5 * (1 + Math.cos(Math.PI * progress));
};

const lstmBptt = (caches, dhNext, dcNext, wx, wh, b) => {
  const gs = HIDDEN_SIZE * 4;
  const grads = { wx: new Float32Array(wx.length), wh: new Float32Array(wh.length), b: new Float32Array(b.length) };
  for (let ti = caches.length - 1; ti >= 0; ti--) {
    const cache = caches[ti]; const dz = new Float32Array(gs);
    const dhP = new Float32Array(HIDDEN_SIZE), dcP = new Float32Array(HIDDEN_SIZE);
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const cv = cache.c[hi], th = Math.tanh(cv);
      const dh = dhNext[hi], dc = dcNext[hi] + dh * cache.og[hi] * (1 - th * th);
      const ogG = dh * th, igG = dc * cache.cand[hi], candG = dc * cache.ig[hi], fgG = dc * cache.cP[hi];
      dz[hi] = clipGradient(igG * cache.ig[hi] * (1 - cache.ig[hi]));
      dz[HIDDEN_SIZE + hi] = clipGradient(fgG * cache.fg[hi] * (1 - cache.fg[hi]));
      dz[HIDDEN_SIZE * 2 + hi] = clipGradient(candG * (1 - cache.cand[hi] * cache.cand[hi]));
      dz[HIDDEN_SIZE * 3 + hi] = clipGradient(ogG * cache.og[hi] * (1 - cache.og[hi]));
      dcP[hi] = dc * cache.fg[hi];
    }
    for (let fi = 0; fi < cache.frame.indices.length; fi++) {
      const ii = cache.frame.indices[fi], iv = cache.frame.values[fi]; const off = ii * gs;
      for (let g = 0; g < gs; g++) grads.wx[off + g] += iv * dz[g];
    }
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const off = hi * gs;
      for (let g = 0; g < gs; g++) { grads.wh[off + g] += cache.hP[hi] * dz[g]; dhP[hi] += wh[off + g] * dz[g]; }
    }
    for (let g = 0; g < gs; g++) grads.b[g] += dz[g];
    dhNext.set(dhP); dcNext.set(dcP);
  }
  for (const arr of Object.values(grads)) for (let i = 0; i < arr.length; i++) arr[i] = clipGradient(arr[i]);
  return grads;
};

const trainSample = (model, sample, rng, classWeights, smoothing, gamma, lr, curriculumWeight) => {
  const { fwdCaches, bwdCaches, allHidden, ctx, scores, ln, inp, mask, probs } = forward(model, sample, { training: true, rng });
  const cw = classWeights[sample.labelId] * (sample.hardWeight ?? 1.0) * curriculumWeight;
  const loss = computeLoss(probs, sample.labelId, model.nClasses, smoothing, gamma, cw);
  const pred = predict(probs);
  const nC = model.nClasses;
  const pt = Math.max(probs[sample.labelId], Number.EPSILON);
  const oneMinusPt = Math.max(1 - pt, Number.EPSILON);
  const pow_gamma = Math.pow(oneMinusPt, gamma);
  const pow_gamma_m1 = Math.pow(oneMinusPt, gamma - 1);
  const logPt = Math.log(pt);
  const correctGrad = pow_gamma * (pt * gamma * logPt + pt - 1);
  const kBase = pow_gamma_m1 * (oneMinusPt - pt * gamma * logPt);
  const delta = new Float32Array(nC);
  for (let ci = 0; ci < nC; ci++) {
    let grad;
    if (ci === sample.labelId) {
      grad = correctGrad;
    } else {
      grad = probs[ci] * kBase;
    }
    delta[ci] = clipGradient(grad * cw);
  }
  const grads = {
    fwd: { wx: new Float32Array(model.lstmFwd.wx.length), wh: new Float32Array(model.lstmFwd.wh.length), b: new Float32Array(model.lstmFwd.b.length) },
    bwd: { wx: new Float32Array(model.lstmBwd.wx.length), wh: new Float32Array(model.lstmBwd.wh.length), b: new Float32Array(model.lstmBwd.b.length) },
    attnW: new Float32Array(model.attnW.length), attnV: new Float32Array(model.attnV.length),
    lnG: new Float32Array(model.lnG.length), lnB: new Float32Array(model.lnB.length),
    wy: new Float32Array(model.wy.length), by: new Float32Array(model.by.length),
  };
  for (let ci = 0; ci < nC; ci++) grads.by[ci] += delta[ci];
  const dHidden = new Float32Array(COMBINED_SIZE);
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const off = hi * nC; let g = 0;
    for (let ci = 0; ci < nC; ci++) { grads.wy[off + ci] += inp[hi] * delta[ci]; g += model.wy[off + ci] * delta[ci]; }
    dHidden[hi] = clipGradient(g * (mask?.[hi] ?? 1));
  }
  const T = allHidden.length;

  // GELU backward: dHidden *= gelu'(lnOut) where lnOut = pre-GELU LN output
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const lnOut = model.lnG[hi] * (ctx[hi] - ln.mean) / (ln.std || 1) + model.lnB[hi];
    dHidden[hi] *= geluDeriv(lnOut);
  }

  // LayerNorm backward (full computation with mean/variance correction)
  let sumDy = 0, sumDyXn = 0;
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    sumDy += dHidden[hi];
    sumDyXn += dHidden[hi] * (ctx[hi] - ln.mean) / (ln.std || 1);
  }
  const invN = 1 / COMBINED_SIZE;
  const dCtx = new Float32Array(COMBINED_SIZE);
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const xNorm = (ctx[hi] - ln.mean) / (ln.std || 1);
    dCtx[hi] = clipGradient((model.lnG[hi] / (ln.std || 1)) * (dHidden[hi] - invN * sumDy - invN * xNorm * sumDyXn));
    // LN parameter gradients
    grads.lnG[hi] += dHidden[hi] * xNorm;
    grads.lnB[hi] += dHidden[hi];
  }

  // Attention backward
  // dAttnScores[t] = dCtx weighted by hidden at each timestep
  const dAttnScores = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    for (let hi = 0; hi < COMBINED_SIZE; hi++) dAttnScores[t] += allHidden[t][hi] * dCtx[hi];
  }

  // Softmax gradient through attention weights
  let wDS = 0;
  for (let t = 0; t < T; t++) wDS += scores[t] * dAttnScores[t];
  const ds = new Float32Array(T);
  for (let t = 0; t < T; t++) ds[t] = scores[t] * (dAttnScores[t] - wDS);

  // Recompute u[t] for gradient computation (u[t][aj] = Σ_hi h[t][hi] * W[hi,aj])
  const uCache = [];
  for (let t = 0; t < T; t++) {
    const u = new Float32Array(ATTN_SIZE);
    for (let hi = 0; hi < COMBINED_SIZE; hi++) {
      const hv = allHidden[t][hi];
      if (hv === 0) continue;
      for (let aj = 0; aj < ATTN_SIZE; aj++) u[aj] += hv * model.attnW[hi * ATTN_SIZE + aj];
    }
    grads.attnV[0] += ds[t] * 0; // placeholder, filled below
    // gradient for attnV
    for (let aj = 0; aj < ATTN_SIZE; aj++) grads.attnV[aj] += ds[t] * u[aj];
    uCache.push(u);
  }

  // gradient for attnW: ∂L/∂W[hi,aj] = Σ_t ds[t] * h[t][hi] * v[aj]
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const off = hi * ATTN_SIZE;
    for (let t = 0; t < T; t++) {
      const hv = allHidden[t][hi];
      if (hv === 0) continue;
      for (let aj = 0; aj < ATTN_SIZE; aj++) grads.attnW[off + aj] += ds[t] * hv * model.attnV[aj];
    }
  }

  // Gradient to LSTM hidden states (through attention weights AND attention scores)
  const dhF = new Float32Array(HIDDEN_SIZE), dhB = new Float32Array(HIDDEN_SIZE);
  for (let t = 0; t < T; t++) {
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      dhF[hi] += dCtx[hi] * scores[t];
      let sContrib = 0;
      for (let aj = 0; aj < ATTN_SIZE; aj++) sContrib += model.attnW[hi * ATTN_SIZE + aj] * model.attnV[aj];
      dhF[hi] += ds[t] * sContrib;
    }
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const bHi = HIDDEN_SIZE + hi;
      dhB[hi] += dCtx[bHi] * scores[t];
      let sContrib = 0;
      for (let aj = 0; aj < ATTN_SIZE; aj++) sContrib += model.attnW[bHi * ATTN_SIZE + aj] * model.attnV[aj];
      dhB[hi] += ds[t] * sContrib;
    }
  }
  const dcF = new Float32Array(HIDDEN_SIZE), dcB = new Float32Array(HIDDEN_SIZE);
  const fwdG = lstmBptt(fwdCaches, dhF, dcF, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b);
  const bwdG = lstmBptt(bwdCaches, dhB, dcB, model.lstmBwd.wx, model.lstmBwd.wh, model.lstmBwd.b);
  grads.fwd.wx.set(fwdG.wx); grads.fwd.wh.set(fwdG.wh); grads.fwd.b.set(fwdG.b);
  grads.bwd.wx.set(bwdG.wx); grads.bwd.wh.set(bwdG.wh); grads.bwd.b.set(bwdG.b);

  model.step++; model.b1p *= BETA_1; model.b2p *= BETA_2;
  const ap = (w, g, mV) => applyAdam(w, g, mV.m, mV.v, model.step, model.b1p, model.b2p, lr);
  ap(model.lstmFwd.wx, grads.fwd.wx, model.optFwdWx);
  ap(model.lstmFwd.wh, grads.fwd.wh, model.optFwdWh);
  ap(model.lstmFwd.b, grads.fwd.b, model.optFwdB);
  ap(model.lstmBwd.wx, grads.bwd.wx, model.optBwdWx);
  ap(model.lstmBwd.wh, grads.bwd.wh, model.optBwdWh);
  ap(model.lstmBwd.b, grads.bwd.b, model.optBwdB);
  ap(model.attnW, grads.attnW, model.optAttnW);
  ap(model.attnV, grads.attnV, model.optAttnV);
  ap(model.lnG, grads.lnG, model.optLnG);
  ap(model.lnB, grads.lnB, model.optLnB);
  ap(model.wy, grads.wy, model.optWy);
  ap(model.by, grads.by, model.optBy);
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
    const { probs } = forward(model, s); const p = predict(probs);
    loss += -Math.log(Math.max(probs[s.labelId], Number.EPSILON)); cor += p === s.labelId ? 1 : 0;
    cm[s.labelId][p] += 1;
  }
  const m = computePLM(cm, labels);
  return { n: samples.length, loss: loss / samples.length, acc: cor / samples.length, macroF1: m.macro.f1, weightedF1: m.weighted.f1, cm, plm: m };
};

const roundArr = (ta) => Array.from(ta, (v) => Number(v.toFixed(8)));

const saveOutputs = ({ labelsData, meta, model, fi, trainM, valM, testM, hist, bestValF1 }) => {
  ensureDir(OUTPUT_DIR);
  const createdAt = new Date().toISOString();
  const cfg = {
    modelType: "unified-bilstm-v3",
    desc: "BiLSTM v3 with attention pooling, focal loss, label smoothing, cosine LR, LayerNorm, GELU.",
    arch: {
      lstm: { hiddenSize: HIDDEN_SIZE, direction: "bidirectional", temporalSteps: TEMPORAL_STEPS, dropout: DROPOUT_RATE },
      attention: { size: ATTN_SIZE }, layerNorm: true,
      combinedSize: COMBINED_SIZE, nClasses: labelsData.labels.length,
    },
    training: {
      optimizer: "adam", baseLr: BASE_LEARNING_RATE, scheduler: "cosine-decay",
      epochs: EPOCHS, epochsCompleted: hist.length, patience: EARLY_STOPPING_PATIENCE,
      labelSmoothing: LABEL_SMOOTHING, focalGamma: FOCAL_GAMMA,
      gradClip: GRADIENT_CLIP_VALUE, dropout: DROPOUT_RATE,
      bestValF1,
    },
    dataset: {
      alphabetSamples: meta.splits.train.alphabet + meta.splits.validation.alphabet + meta.splits.test.alphabet,
      fslSamples: meta.splits.train.fsl + meta.splits.validation.fsl + meta.splits.test.fsl,
      totalSamples: meta.splits.train.total + meta.splits.validation.total + meta.splits.test.total,
      splits: meta.splits,
      useBalanced: USE_BALANCED,
      useHardSamples: USE_HARD,
    },
    createdAt,
  };
  writeJson(path.join(OUTPUT_DIR, "labels.json"), labelsData);
  writeJson(path.join(OUTPUT_DIR, "config.json"), cfg);
  writeJson(path.join(OUTPUT_DIR, "metrics.json"), {
    trainAcc: trainM.acc, valAcc: valM.acc, testAcc: testM.acc, testLoss: testM.loss,
    macroF1: testM.macroF1, weightedF1: testM.weightedF1,
    train: trainM, val: valM, test: testM, history: hist, bestValF1, createdAt,
  });
  writeJson(path.join(OUTPUT_DIR, "training_history.json"), hist);
  writeJson(path.join(OUTPUT_DIR, "confusion_matrix.json"), { labels: labelsData.labels, matrix: testM.cm });
  writeJson(path.join(OUTPUT_DIR, "model.json"), {
    artifactType: "unified-bilstm-v3", createdAt,
    labels: labelsData.labels, config: cfg,
    weights: {
      lstmFwd: { wx: roundArr(model.lstmFwd.wx), wh: roundArr(model.lstmFwd.wh), b: roundArr(model.lstmFwd.b) },
      lstmBwd: { wx: roundArr(model.lstmBwd.wx), wh: roundArr(model.lstmBwd.wh), b: roundArr(model.lstmBwd.b) },
      attnW: roundArr(model.attnW), attnV: roundArr(model.attnV),
      lnG: roundArr(model.lnG), lnB: roundArr(model.lnB),
      wy: roundArr(model.wy), by: roundArr(model.by),
    },
  });
};

const fmtPct = (v) => `${(v * 100).toFixed(2)}%`;

const main = () => {
  const aL = readJson(path.join(ALPHA_DIR, "labels.json"));
  const fL = readJson(path.join(FSL_DIR, "labels.json"));
  const meta = readJson(path.join(process.cwd(), "datasets", "processed", "fsl_unified", "metadata.json"));
  const allL = [...aL.labels, ...fL.labels];
  const ac = aL.labels.length;
  const ld = { labels: allL };
  const fi = temporalFrameIndices();
  const aTr = readJson(path.join(ALPHA_DIR, "train.json"));
  const aTe = readJson(path.join(ALPHA_DIR, "test.json"));
  const fTr = readJson(path.join(FSL_DIR, "train.json"));
  const fTe = readJson(path.join(FSL_DIR, "test.json"));
  const remap = (s) => s.map((x) => ({ ...x, labelId: x.labelId + ac }));
  const ftTr = remap(fTr.samples);
  const ftTe = remap(fTe.samples);

  let extraSamples = [];
  if (USE_BALANCED) {
    try {
      const bal = readJson(path.join(BALANCED_DIR, "train.json"));
      const remapBal = (s) => {
        const lid = aL.labels.includes(s.label) ? aL.labels.indexOf(s.label) : ac + fL.labels.indexOf(s.label);
        return { ...s, labelId: lid };
      };
      extraSamples = bal.samples.map(remapBal);
      console.log(`Loaded ${extraSamples.length} balanced samples`);
    } catch { console.warn("Balanced data not found"); }
  }

  let hardSamples = [];
  if (USE_HARD) {
    try {
      const hard = readJson(path.join(HARD_DIR, "hard_samples.json"));
      const remapHard = (s) => {
        const lid = aL.labels.includes(s.label) ? aL.labels.indexOf(s.label) : ac + fL.labels.indexOf(s.label);
        return { ...s, labelId: lid };
      };
      hardSamples = hard.samples.map(remapHard);
      console.log(`Loaded ${hardSamples.length} hard samples`);
    } catch { console.warn("Hard samples not found"); }
  }

  const allTrR = [...aTr.samples, ...ftTr];
  const allTeR = [...aTe.samples, ...ftTe];
  const rng = mulberry32(RANDOM_SEED + 1);
  const order = shuffle(Array.from({ length: allTrR.length }, (_, i) => i), rng);
  const vc = Math.max(1, Math.floor(allTrR.length * 0.15));
  const vo = new Set(order.slice(0, vc));
  const trB = []; const vaB = [];
  for (let i = 0; i < allTrR.length; i++) { if (vo.has(i)) vaB.push(allTrR[i]); else trB.push(allTrR[i]); }
  const trAll = [...trB, ...extraSamples, ...hardSamples];
  const trS = loadSplit(trAll, fi);
  const vaS = loadSplit(vaB, fi);
  const teS = loadSplit(allTeR, fi);

  console.log("Unified BiLSTM v3 Training");
  console.log(`Hidden=${HIDDEN_SIZE}, Attn=${ATTN_SIZE}, T=${TEMPORAL_STEPS}`);
  console.log(`Focal gamma=${FOCAL_GAMMA}, Smoothing=${LABEL_SMOOTHING}`);
  console.log(`Balanced=${USE_BALANCED}, Hard=${USE_HARD}`);
  console.log(`Split: train=${trS.length}, val=${vaS.length}, test=${teS.length}`);

  const cw = computeClassWeights(trS, allL.length);
  console.log(`Class weights: ${cw.reduce((a, b) => Math.min(a, b), Infinity).toFixed(2)}–${cw.reduce((a, b) => Math.max(a, b), 0).toFixed(2)}`);

  const model = createModel(allL.length);
  const hist = [];
  const trRng = mulberry32(RANDOM_SEED + 2);
  let bestValF1 = 0, bestLoss = Number.POSITIVE_INFINITY, noImp = 0;
  let bestState = null;

  for (let ep = 1; ep <= EPOCHS; ep++) {
    const lr = cosineDecay(ep - 1, EPOCHS, BASE_LEARNING_RATE);
    const cw_cur = Math.min(1, 0.5 + ep / EPOCHS);
    const to = shuffle(Array.from({ length: trS.length }, (_, i) => i), trRng);
    let tLoss = 0, tCor = 0;
    for (const si of to) {
      const r = trainSample(model, trS[si], trRng, cw, LABEL_SMOOTHING, FOCAL_GAMMA, lr, cw_cur);
      tLoss += r.loss; tCor += r.correct;
    }
    const vM = evaluate(model, vaS, allL);
    hist.push({ ep, lr: Number(lr.toFixed(6)), tLoss: tLoss / trS.length, tAcc: tCor / trS.length, vLoss: vM.loss, vAcc: vM.acc, vF1: vM.macroF1 });
    const isBetterF1 = vM.macroF1 > bestValF1 + MIN_VALIDATION_DELTA;
    const isBetterLoss = vM.loss < bestLoss - MIN_VALIDATION_DELTA;
    if (isBetterF1 || isBetterLoss) {
      if (isBetterF1) bestValF1 = vM.macroF1;
      if (isBetterLoss) bestLoss = vM.loss;
      noImp = 0;
      bestState = {
        lstmFwd: { wx: new Float32Array(model.lstmFwd.wx), wh: new Float32Array(model.lstmFwd.wh), b: new Float32Array(model.lstmFwd.b) },
        lstmBwd: { wx: new Float32Array(model.lstmBwd.wx), wh: new Float32Array(model.lstmBwd.wh), b: new Float32Array(model.lstmBwd.b) },
        attnW: new Float32Array(model.attnW), attnV: new Float32Array(model.attnV),
        lnG: new Float32Array(model.lnG), lnB: new Float32Array(model.lnB),
        wy: new Float32Array(model.wy), by: new Float32Array(model.by),
      };
    } else { noImp++; }
    console.log(`Epoch ${ep}/${EPOCHS} lr=${lr.toFixed(6)} cw=${cw_cur.toFixed(2)} loss=${(tLoss / trS.length).toFixed(4)} acc=${fmtPct(tCor / trS.length)} v_loss=${vM.loss.toFixed(4)} v_acc=${fmtPct(vM.acc)} v_f1=${fmtPct(vM.macroF1)}`);
    if (noImp >= EARLY_STOPPING_PATIENCE) { console.log(`Early stopping ep ${ep}`); break; }
  }

  if (bestState) {
    model.lstmFwd.wx.set(bestState.lstmFwd.wx); model.lstmFwd.wh.set(bestState.lstmFwd.wh); model.lstmFwd.b.set(bestState.lstmFwd.b);
    model.lstmBwd.wx.set(bestState.lstmBwd.wx); model.lstmBwd.wh.set(bestState.lstmBwd.wh); model.lstmBwd.b.set(bestState.lstmBwd.b);
    model.attnW.set(bestState.attnW); model.attnV.set(bestState.attnV);
    model.lnG.set(bestState.lnG); model.lnB.set(bestState.lnB);
    model.wy.set(bestState.wy); model.by.set(bestState.by);
    console.log(`Restored best (val F1=${fmtPct(bestValF1)})`);
  }

  const tM = evaluate(model, trS, allL);
  const vM = evaluate(model, vaS, allL);
  const teM = evaluate(model, teS, allL);
  saveOutputs({ labelsData: ld, meta, model, fi, trainM: tM, valM: vM, testM: teM, hist, bestValF1 });
  console.log(`\nTrain: ${fmtPct(tM.acc)} Val: ${fmtPct(vM.acc)} Test: ${fmtPct(teM.acc)} F1: ${fmtPct(teM.macroF1)}`);
  console.log(`Output: ${OUTPUT_DIR}`);
};

main();
