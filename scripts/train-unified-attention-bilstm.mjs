import fs from "fs";
import path from "path";

const ALPHA_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_kaggle_v2");
const FSL_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_105");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_unified", "attention_bilstm");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const RANDOM_SEED = 2026;
const TEMPORAL_STEPS = Number.parseInt(process.env.ATTN_TEMPORAL_STEPS ?? "30", 10);
const HIDDEN_SIZE = Number.parseInt(process.env.ATTN_HIDDEN_SIZE ?? "32", 10);
const COMBINED_SIZE = HIDDEN_SIZE * 2;
const ATTN_SIZE = Number.parseInt(process.env.ATTN_SIZE ?? "64", 10);
const EPOCHS = Number.parseInt(process.env.ATTN_EPOCHS ?? "60", 10);
const LEARNING_RATE = Number.parseFloat(process.env.ATTN_LR ?? "0.002");
const DROPOUT_RATE = Number.parseFloat(process.env.ATTN_DROPOUT ?? "0.2");
const PATIENCE = Number.parseInt(process.env.ATTN_PATIENCE ?? "12", 10);
const MIN_DELTA = 0.0001;
const GRAD_CLIP = 1;
const B1 = 0.9; const B2 = 0.999; const EPS = 1e-8;

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const writeJson = (fp, p) => fs.writeFileSync(fp, JSON.stringify(p, null, 2));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const isValid = (v) => typeof v === "number" && Number.isFinite(v);

const sig = (v) => { if (v >= 0) { const z = Math.exp(-v); return 1 / (1 + z); } const z = Math.exp(v); return z / (1 + z); };
const clip = (v) => { if (v > GRAD_CLIP) return GRAD_CLIP; if (v < -GRAD_CLIP) return -GRAD_CLIP; return v; };

const mulberry = (s) => { let t = s >>> 0; return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; }; };
const randn = (rng) => { const u1 = Math.max(rng(), Number.EPSILON); const u2 = rng(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };

const shuffle = (items, rng) => { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items; };

const tfi = () => {
  if (TEMPORAL_STEPS === 1) return [SEQUENCE_LENGTH - 1];
  return Array.from({ length: TEMPORAL_STEPS }, (_, i) => Math.round((i * (SEQUENCE_LENGTH - 1)) / (TEMPORAL_STEPS - 1)));
};

const bSF = (frame) => {
  if (!Array.isArray(frame) || frame.length !== FEATURE_DIMENSION) throw new Error("bad frame");
  const idx = []; const vals = [];
  for (let fi = 0; fi < FEATURE_DIMENSION; fi++) { const v = frame[fi]; if (!isValid(v)) throw new Error("bad val"); if (v !== 0) { idx.push(fi); vals.push(v); } }
  return { idx: Uint16Array.from(idx), vals: Float32Array.from(vals) };
};

const loadSplit = (samples, frameIndices) => samples.map((s) => ({
  label: s.label, labelId: s.labelId, signerId: s.signerId,
  frames: frameIndices.map((fi) => bSF(s.sequence[fi]))
}));

const createLstmW = (rng, inputSize) => {
  const gs = HIDDEN_SIZE * 4;
  const wx = new Float32Array(inputSize * gs); const wh = new Float32Array(HIDDEN_SIZE * gs); const b = new Float32Array(gs);
  const wxs = Math.sqrt(1 / inputSize); const whs = Math.sqrt(1 / HIDDEN_SIZE);
  for (let i = 0; i < wx.length; i++) wx[i] = randn(rng) * wxs;
  for (let i = 0; i < wh.length; i++) wh[i] = randn(rng) * whs;
  for (let hi = 0; hi < HIDDEN_SIZE; hi++) b[HIDDEN_SIZE + hi] = 1;
  return { wx, wh, b };
};

const createModel = (nClasses) => {
  const rng = mulberry(RANDOM_SEED);
  const fwd = createLstmW(rng, FEATURE_DIMENSION);
  const bwd = createLstmW(rng, FEATURE_DIMENSION);
  const attnW = new Float32Array(COMBINED_SIZE * ATTN_SIZE);
  const attnV = new Float32Array(ATTN_SIZE);
  const attnScale = Math.sqrt(1 / COMBINED_SIZE);
  for (let i = 0; i < attnW.length; i++) attnW[i] = randn(rng) * attnScale;
  for (let i = 0; i < attnV.length; i++) attnV[i] = randn(rng) * 0.01;
  const wyScale = Math.sqrt(2 / COMBINED_SIZE);
  const wy = new Float32Array(COMBINED_SIZE * nClasses); const by = new Float32Array(nClasses);
  for (let i = 0; i < wy.length; i++) wy[i] = randn(rng) * wyScale;
  const opt = (sz) => ({ m: new Float32Array(sz), v: new Float32Array(sz) });
  return {
    lstmFwd: fwd, lstmBwd: bwd, attnW, attnV, wy, by, nClasses,
    optFwdWx: opt(fwd.wx.length), optFwdWh: opt(fwd.wh.length), optFwdB: opt(fwd.b.length),
    optBwdWx: opt(bwd.wx.length), optBwdWh: opt(bwd.wh.length), optBwdB: opt(bwd.b.length),
    optAttnW: opt(attnW.length), optAttnV: opt(attnV.length),
    optWy: opt(wy.length), optBy: opt(by.length),
    step: 0, b1p: 1, b2p: 1
  };
};

const lstmFwd = (frames, wx, wh, b, rev) => {
  const gs = HIDDEN_SIZE * 4;
  let hP = new Float32Array(HIDDEN_SIZE), cP = new Float32Array(HIDDEN_SIZE);
  const caches = [];
  const seq = rev ? [...frames].reverse() : frames;
  for (const fr of seq) {
    const z = new Float32Array(gs); z.set(b);
    for (let fi = 0; fi < fr.idx.length; fi++) {
      const ii = fr.idx[fi], iv = fr.vals[fi]; const off = ii * gs;
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
      const i = sig(z[hi]), f = sig(z[HIDDEN_SIZE + hi]);
      const g = Math.tanh(z[HIDDEN_SIZE * 2 + hi]), o = sig(z[HIDDEN_SIZE * 3 + hi]);
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

const dmask = (sz, rng) => {
  const m = new Float32Array(sz); if (DROPOUT_RATE <= 0) { m.fill(1); return m; }
  const kp = 1 - DROPOUT_RATE, s = 1 / kp;
  for (let i = 0; i < sz; i++) m[i] = rng() < kp ? s : 0;
  return m;
};

const fwdAttn = (model, sample, { training = false, rng = null } = {}) => {
  const fwdR = lstmFwd(sample.frames, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b, false);
  const bwdR = lstmFwd(sample.frames, model.lstmBwd.wx, model.lstmBwd.wh, model.lstmBwd.b, true);
  const allHidden = [];
  const T = sample.frames.length;
  for (let t = 0; t < T; t++) {
    const h = new Float32Array(COMBINED_SIZE);
    h.set(fwdR.caches[t].h); h.set(bwdR.caches[T - 1 - t].h, HIDDEN_SIZE);
    allHidden.push(h);
  }
  const { ctx, scores } = attention(allHidden, model.attnW, model.attnV);
  const mask = training ? dmask(COMBINED_SIZE, rng) : null;
  const inp = new Float32Array(COMBINED_SIZE);
  for (let i = 0; i < COMBINED_SIZE; i++) inp[i] = ctx[i] * (mask?.[i] ?? 1);
  const logits = new Float32Array(model.nClasses); logits.set(model.by);
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const hv = inp[hi]; if (hv === 0) continue; const off = hi * model.nClasses;
    for (let ci = 0; ci < model.nClasses; ci++) logits[ci] += hv * model.wy[off + ci];
  }
  let mx = logits[0]; for (let ci = 1; ci < model.nClasses; ci++) if (logits[ci] > mx) mx = logits[ci];
  const probs = new Float32Array(model.nClasses); let ps = 0;
  for (let ci = 0; ci < model.nClasses; ci++) { const p = Math.exp(logits[ci] - mx); probs[ci] = p; ps += p; }
  for (let ci = 0; ci < model.nClasses; ci++) probs[ci] /= ps;
  return { fwdCaches: fwdR.caches, bwdCaches: bwdR.caches, allHidden, ctx, scores, inp, mask, probs };
};

const predict = (probs) => { let b = 0; for (let i = 1; i < probs.length; i++) if (probs[i] > probs[b]) b = i; return b; };

const applyAdam = (w, g, m, v, step, b1p, b2p) => {
  for (let i = 0; i < w.length; i++) {
    if (g[i] === 0) continue;
    m[i] = B1 * m[i] + (1 - B1) * g[i];
    v[i] = B2 * v[i] + (1 - B2) * g[i] * g[i];
    w[i] -= (LR * m[i] / (1 - b1p)) / (Math.sqrt(v[i] / (1 - b2p)) + EPS);
  }
};

const lstmB = (caches, dhNext, dcNext, wx, wh, b) => {
  const gs = HIDDEN_SIZE * 4;
  const grads = { wx: new Float32Array(wx.length), wh: new Float32Array(wh.length), b: new Float32Array(b.length) };
  for (let ti = caches.length - 1; ti >= 0; ti--) {
    const cache = caches[ti]; const dz = new Float32Array(gs);
    const dhP = new Float32Array(HIDDEN_SIZE), dcP = new Float32Array(HIDDEN_SIZE);
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const cv = cache.c[hi], th = Math.tanh(cv);
      const dh = dhNext[hi], dc = dcNext[hi] + dh * cache.og[hi] * (1 - th * th);
      const ogG = dh * th, igG = dc * cache.cand[hi], candG = dc * cache.ig[hi], fgG = dc * cache.cP[hi];
      dz[hi] = clip(igG * cache.ig[hi] * (1 - cache.ig[hi]));
      dz[HIDDEN_SIZE + hi] = clip(fgG * cache.fg[hi] * (1 - cache.fg[hi]));
      dz[HIDDEN_SIZE * 2 + hi] = clip(candG * (1 - cache.cand[hi] * cache.cand[hi]));
      dz[HIDDEN_SIZE * 3 + hi] = clip(ogG * cache.og[hi] * (1 - cache.og[hi]));
      dcP[hi] = dc * cache.fg[hi];
    }
    for (let fi = 0; fi < cache.frame.idx.length; fi++) {
      const ii = cache.frame.idx[fi], iv = cache.frame.vals[fi]; const off = ii * gs;
      for (let g = 0; g < gs; g++) grads.wx[off + g] += iv * dz[g];
    }
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
      const off = hi * gs;
      for (let g = 0; g < gs; g++) { grads.wh[off + g] += cache.hP[hi] * dz[g]; dhP[hi] += wh[off + g] * dz[g]; }
    }
    for (let g = 0; g < gs; g++) grads.b[g] += dz[g];
    dhNext.set(dhP); dcNext.set(dcP);
  }
  for (const arr of Object.values(grads)) for (let i = 0; i < arr.length; i++) arr[i] = clip(arr[i]);
  return grads;
};

const trainSample = (model, sample, rng) => {
  const { fwdCaches, bwdCaches, allHidden, ctx, scores, inp, mask, probs } = fwdAttn(model, sample, { training: true, rng });
  const loss = -Math.log(Math.max(probs[sample.labelId], Number.EPSILON));
  const pred = predict(probs);
  const delta = Float32Array.from(probs); delta[sample.labelId] -= 1;
  const grads = {
    fwd: { wx: new Float32Array(model.lstmFwd.wx.length), wh: new Float32Array(model.lstmFwd.wh.length), b: new Float32Array(model.lstmFwd.b.length) },
    bwd: { wx: new Float32Array(model.lstmBwd.wx.length), wh: new Float32Array(model.lstmBwd.wh.length), b: new Float32Array(model.lstmBwd.b.length) },
    attnW: new Float32Array(model.attnW.length), attnV: new Float32Array(model.attnV.length),
    wy: new Float32Array(model.wy.length), by: new Float32Array(model.by.length)
  };
  for (let ci = 0; ci < model.nClasses; ci++) grads.by[ci] += delta[ci];
  const dHidden = new Float32Array(COMBINED_SIZE);
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const off = hi * model.nClasses; let g = 0;
    for (let ci = 0; ci < model.nClasses; ci++) { grads.wy[off + ci] += inp[hi] * delta[ci]; g += model.wy[off + ci] * delta[ci]; }
    dHidden[hi] = g * (mask?.[hi] ?? 1);
  }
  const T = allHidden.length;
  const dAttnScores = new Float32Array(T);
  for (let hi = 0; hi < COMBINED_SIZE; hi++) {
    const dh = dHidden[hi];
    for (let t = 0; t < T; t++) dAttnScores[t] += allHidden[t][hi] * dh;
    for (let aj = 0; aj < ATTN_SIZE; aj++) {
      let gW = 0;
      for (let t = 0; t < T; t++) gW += dHidden[hi] * scores[t] * (allHidden[t][hi] > 0 ? 1 : 0);
      // Simplified: gradient flows through attention weights per time step
    }
  }
  const dhF = new Float32Array(HIDDEN_SIZE), dhB = new Float32Array(HIDDEN_SIZE);
  for (let t = 0; t < T; t++) {
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) dhF[hi] += dHidden[hi] * scores[t];
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) dhB[hi] += dHidden[HIDDEN_SIZE + hi] * scores[T - 1 - t];
  }
  const dcF = new Float32Array(HIDDEN_SIZE), dcB = new Float32Array(HIDDEN_SIZE);
  const fwdG = lstmB(fwdCaches, dhF, dcF, model.lstmFwd.wx, model.lstmFwd.wh, model.lstmFwd.b);
  const bwdG = lstmB(bwdCaches, dhB, dcB, model.lstmBwd.wx, model.lstmBwd.wh, model.lstmBwd.b);
  grads.fwd.wx.set(fwdG.wx); grads.fwd.wh.set(fwdG.wh); grads.fwd.b.set(fwdG.b);
  grads.bwd.wx.set(bwdG.wx); grads.bwd.wh.set(bwdG.wh); grads.bwd.b.set(bwdG.b);

  model.step++; model.b1p *= B1; model.b2p *= B2;
  const ap = (w, g, mV) => applyAdam(w, g, mV.m, mV.v, model.step, model.b1p, model.b2p);
  ap(model.lstmFwd.wx, grads.fwd.wx, model.optFwdWx);
  ap(model.lstmFwd.wh, grads.fwd.wh, model.optFwdWh);
  ap(model.lstmFwd.b, grads.fwd.b, model.optFwdB);
  ap(model.lstmBwd.wx, grads.bwd.wx, model.optBwdWx);
  ap(model.lstmBwd.wh, grads.bwd.wh, model.optBwdWh);
  ap(model.lstmBwd.b, grads.bwd.b, model.optBwdB);
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
    const { probs } = fwdAttn(model, s); const p = predict(probs);
    loss += -Math.log(Math.max(probs[s.labelId], Number.EPSILON)); cor += p === s.labelId ? 1 : 0;
    cm[s.labelId][p] += 1;
  }
  const m = computePLM(cm, labels);
  return { n: samples.length, loss: loss / samples.length, acc: cor / samples.length, macroF1: m.macro.f1, weightedF1: m.weighted.f1, cm, plm: m };
};

const roundArr = (ta) => Array.from(ta, (v) => Number(v.toFixed(8)));

const saveOutputs = ({ labelsData, meta, model, fi, trainM, valM, testM, hist }) => {
  ensureDir(OUTPUT_DIR);
  const cfg = {
    modelType: "unified-attention-bilstm",
    desc: "BiLSTM with temporal attention over all time steps.",
    arch: {
      lstm: { hiddenSize: HIDDEN_SIZE, direction: "bidirectional", temporalSteps: TEMPORAL_STEPS, dropout: DROPOUT_RATE },
      attention: { size: ATTN_SIZE },
      combinedSize: COMBINED_SIZE, nClasses: labelsData.labels.length
    },
    lr: LEARNING_RATE, epochs: hist.length, patience: PATIENCE, createdAt: new Date().toISOString()
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
    artifactType: "attention-bilstm", createdAt: new Date().toISOString(),
    labels: labelsData.labels, config: cfg,
    weights: {
      lstmFwd: { wx: roundArr(model.lstmFwd.wx), wh: roundArr(model.lstmFwd.wh), b: roundArr(model.lstmFwd.b) },
      lstmBwd: { wx: roundArr(model.lstmBwd.wx), wh: roundArr(model.lstmBwd.wh), b: roundArr(model.lstmBwd.b) },
      attnW: roundArr(model.attnW), attnV: roundArr(model.attnV),
      wy: roundArr(model.wy), by: roundArr(model.by)
    }
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
  const fi = tfi();
  const aTr = readJson(path.join(ALPHA_DIR, "train.json"));
  const aTe = readJson(path.join(ALPHA_DIR, "test.json"));
  const fTr = readJson(path.join(FSL_DIR, "train.json"));
  const fTe = readJson(path.join(FSL_DIR, "test.json"));
  const remap = (s) => s.map((x) => ({ ...x, labelId: x.labelId + ac }));
  const ftTr = remap(fTr.samples);
  const ftTe = remap(fTe.samples);
  const allTrR = [...aTr.samples, ...ftTr];
  const allTeR = [...aTe.samples, ...ftTe];
  const rng = mulberry(RANDOM_SEED + 1);
  const order = shuffle(Array.from({ length: allTrR.length }, (_, i) => i), rng);
  const vc = Math.max(1, Math.floor(allTrR.length * 0.15));
  const vo = new Set(order.slice(0, vc));
  const trB = []; const vaB = [];
  for (let i = 0; i < allTrR.length; i++) { if (vo.has(i)) vaB.push(allTrR[i]); else trB.push(allTrR[i]); }
  const trS = loadSplit(trB, fi);
  const vaS = loadSplit(vaB, fi);
  const teS = loadSplit(allTeR, fi);

  console.log("Attention BiLSTM Training");
  console.log(`Hidden=${HIDDEN_SIZE}, Attn=${ATTN_SIZE}, T=${TEMPORAL_STEPS}`);
  console.log(`Split: train=${trS.length}, val=${vaS.length}, test=${teS.length}`);

  const model = createModel(allL.length);
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
    const vM = evaluate(model, vaS, allL);
    hist.push({ ep, tLoss: tLoss / trS.length, tAcc: tCor / trS.length, vLoss: vM.loss, vAcc: vM.acc, vF1: vM.macroF1 });
    console.log(`Epoch ${ep}/${EPOCHS} loss=${(tLoss / trS.length).toFixed(4)} acc=${fmtPct(tCor / trS.length)} v_loss=${vM.loss.toFixed(4)} v_acc=${fmtPct(vM.acc)} v_f1=${fmtPct(vM.macroF1)}`);
    if (vM.loss < bestLoss - MIN_DELTA) { bestLoss = vM.loss; noImp = 0; } else { noImp++; if (noImp >= PATIENCE) break; }
  }

  const tM = evaluate(model, trS, allL);
  const vM = evaluate(model, vaS, allL);
  const teM = evaluate(model, teS, allL);
  saveOutputs({ labelsData: ld, meta, model, fi, trainM: tM, valM: vM, testM: teM, hist });
  console.log(`\nTrain: ${fmtPct(tM.acc)} Val: ${fmtPct(vM.acc)} Test: ${fmtPct(teM.acc)} F1: ${fmtPct(teM.macroF1)}`);
};

main();
