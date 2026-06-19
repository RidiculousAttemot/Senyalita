import fs from "fs";
import path from "path";

const ALPHA_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_v2");
const FSL_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_105");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_unified", "transformer");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIM = 126;
const RANDOM_SEED = 2026;
const T_STEPS = Number.parseInt(process.env.TF_TEMPORAL_STEPS ?? "30", 10);
const D_MODEL = Number.parseInt(process.env.TF_DMODEL ?? "64", 10);
const N_HEADS = Number.parseInt(process.env.TF_NHEADS ?? "4", 10);
const N_LAYERS = Number.parseInt(process.env.TF_NLAYERS ?? "2", 10);
const D_FF = Number.parseInt(process.env.TF_DFF ?? "128", 10);
const EPOCHS = Number.parseInt(process.env.TF_EPOCHS ?? "60", 10);
const LR = Number.parseFloat(process.env.TF_LR ?? "0.001");
const DROPOUT = Number.parseFloat(process.env.TF_DROPOUT ?? "0.2");
const PATIENCE = Number.parseInt(process.env.TF_PATIENCE ?? "12", 10);
const MIN_DELTA = 0.0001;
const GRAD_CLIP = 1;
const B1 = 0.9; const B2 = 0.999; const EPS = 1e-8;

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const writeJson = (fp, p) => fs.writeFileSync(fp, JSON.stringify(p, null, 2));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const validNum = (v) => typeof v === "number" && Number.isFinite(v);

const sig = (v) => { if (v >= 0) { const z = Math.exp(-v); return 1 / (1 + z); } const z = Math.exp(v); return z / (1 + z); };
const clip = (v) => { if (v > GRAD_CLIP) return GRAD_CLIP; if (v < -GRAD_CLIP) return -GRAD_CLIP; return v; };

const mulberry = (s) => { let t = s >>> 0; return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; }; };
const randn = (rng) => { const u1 = Math.max(rng(), Number.EPSILON); const u2 = rng(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };

const shuffle = (items, rng) => { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items; };

const tfi = () => {
  if (T_STEPS === 1) return [SEQUENCE_LENGTH - 1];
  return Array.from({ length: T_STEPS }, (_, i) => Math.round((i * (SEQUENCE_LENGTH - 1)) / (T_STEPS - 1)));
};

const bSF = (frame) => {
  if (!Array.isArray(frame) || frame.length !== FEATURE_DIM) throw new Error("bad frame");
  const idx = []; const vals = [];
  for (let fi = 0; fi < FEATURE_DIM; fi++) { const v = frame[fi]; if (!validNum(v)) throw new Error("bad val"); if (v !== 0) { idx.push(fi); vals.push(v); } }
  return { idx: Uint16Array.from(idx), vals: Float32Array.from(vals) };
};

const loadSplit = (samples, fi) => samples.map((s) => ({
  label: s.label, labelId: s.labelId, signerId: s.signerId,
  frames: fi.map((f) => bSF(s.sequence[f]))
}));

const denseToF32 = (frames) => {
  const T = frames.length;
  const out = new Float32Array(T * D_MODEL);
  for (let t = 0; t < T; t++) {
    for (let fi = 0; fi < frames[t].idx.length; fi++) {
      const dIdx = frames[t].idx[fi];
      if (dIdx < D_MODEL) out[t * D_MODEL + dIdx] = frames[t].vals[fi];
    }
  }
  return out;
};

const posEncoding = () => {
  const pe = new Float32Array(T_STEPS * D_MODEL);
  for (let pos = 0; pos < T_STEPS; pos++) {
    for (let i = 0; i < D_MODEL; i++) {
      const div = 10000 ** (i / D_MODEL);
      pe[pos * D_MODEL + i] = i % 2 === 0 ? Math.sin(pos / div) : Math.cos(pos / div);
    }
  }
  return pe;
};

const scaledDotAttn = (Q, K, V, mask = null) => {
  const dk = D_MODEL / N_HEADS;
  const T = T_STEPS;
  const scores = new Float32Array(T * T);
  for (let i = 0; i < T; i++) {
    for (let j = 0; j < T; j++) {
      let s = 0;
      for (let d = 0; d < dk; d++) s += Q[i * dk + d] * K[j * dk + d];
      scores[i * T + j] = s / Math.sqrt(dk);
    }
  }
  if (mask) for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) if (mask[i * T + j]) scores[i * T + j] = -1e9;
  for (let i = 0; i < T; i++) {
    let mx = scores[i * T]; for (let j = 1; j < T; j++) if (scores[i * T + j] > mx) mx = scores[i * T + j];
    let sum = 0;
    for (let j = 0; j < T; j++) { scores[i * T + j] = Math.exp(scores[i * T + j] - mx); sum += scores[i * T + j]; }
    for (let j = 0; j < T; j++) scores[i * T + j] /= sum;
  }
  const out = new Float32Array(T * dk);
  for (let i = 0; i < T; i++) {
    for (let d = 0; d < dk; d++) {
      let s = 0;
      for (let j = 0; j < T; j++) s += scores[i * T + j] * V[j * dk + d];
      out[i * dk + d] = s;
    }
  }
  return { out, attn: scores };
};

const createW = (rows, cols, rng) => {
  const scale = Math.sqrt(2 / (rows + cols));
  const w = new Float32Array(rows * cols);
  for (let i = 0; i < w.length; i++) w[i] = randn(rng) * scale;
  return w;
};

const createModel = (nClasses) => {
  const rng = mulberry(RANDOM_SEED);
  const headDim = D_MODEL / N_HEADS;
  const inputW = createW(FEATURE_DIM, D_MODEL, rng);
  const inputB = new Float32Array(D_MODEL);
  const posE = posEncoding();
  const layers = [];
  for (let li = 0; li < N_LAYERS; li++) {
    const wQ = createW(D_MODEL, D_MODEL, rng);
    const wK = createW(D_MODEL, D_MODEL, rng);
    const wV = createW(D_MODEL, D_MODEL, rng);
    const wO = createW(D_MODEL, D_MODEL, rng);
    const wF1 = createW(D_MODEL, D_FF, rng);
    const bF1 = new Float32Array(D_FF);
    const wF2 = createW(D_FF, D_MODEL, rng);
    const bF2 = new Float32Array(D_MODEL);
    const ln1G = new Float32Array(D_MODEL); ln1G.fill(1);
    const ln1B = new Float32Array(D_MODEL);
    const ln2G = new Float32Array(D_MODEL); ln2G.fill(1);
    const ln2B = new Float32Array(D_MODEL);
    layers.push({ wQ, wK, wV, wO, wF1, bF1, wF2, bF2, ln1G, ln1B, ln2G, ln2B });
  }
  const clfW = createW(D_MODEL, nClasses, rng);
  const clfB = new Float32Array(nClasses);
  const opt = (sz) => ({ m: new Float32Array(sz), v: new Float32Array(sz) });
  const allParams = [inputW, inputB, ...layers.flatMap((l) => [l.wQ, l.wK, l.wV, l.wO, l.wF1, l.bF1, l.wF2, l.bF2, l.ln1G, l.ln1B, l.ln2G, l.ln2B]), clfW, clfB];
  return { inputW, inputB, posE, layers, clfW, clfB, nClasses, opts: allParams.map((p) => opt(p.length)), params: allParams, step: 0, b1p: 1, b2p: 1 };
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

const fwdTransformer = (model, sample, { training = false, rng = null } = {}) => {
  const T = sample.frames.length;
  const headDim = D_MODEL / N_HEADS;

  let x = new Float32Array(T * D_MODEL);
  for (let t = 0; t < T; t++) {
    for (let fi = 0; fi < sample.frames[t].idx.length; fi++) {
      const dIdx = sample.frames[t].idx[fi];
      if (dIdx < FEATURE_DIM) {
        for (let d = 0; d < D_MODEL; d++) x[t * D_MODEL + d] += sample.frames[t].vals[fi] * model.inputW[dIdx * D_MODEL + d];
      }
    }
    for (let d = 0; d < D_MODEL; d++) x[t * D_MODEL + d] += model.inputB[d] + model.posE[t * D_MODEL + d];
  }

  const layerCaches = [];

  for (const layer of model.layers) {
    const q = new Float32Array(T * D_MODEL);
    const k = new Float32Array(T * D_MODEL);
    const v = new Float32Array(T * D_MODEL);
    for (let t = 0; t < T; t++) {
      for (let doff = 0; doff < D_MODEL; doff++) {
        let qv = 0, kv = 0, vv = 0;
        for (let di = 0; di < D_MODEL; di++) {
          const xv = x[t * D_MODEL + di];
          qv += xv * layer.wQ[di * D_MODEL + doff];
          kv += xv * layer.wK[di * D_MODEL + doff];
          vv += xv * layer.wV[di * D_MODEL + doff];
        }
        q[t * D_MODEL + doff] = qv;
        k[t * D_MODEL + doff] = kv;
        v[t * D_MODEL + doff] = vv;
      }
    }

    const headOuts = [];
    for (let h = 0; h < N_HEADS; h++) {
      const Qh = q.subarray(h * headDim, (h + 1) * headDim);
      const Kh = k.subarray(h * headDim, (h + 1) * headDim);
      const Vh = v.subarray(h * headDim, (h + 1) * headDim);

      const Qm = new Float32Array(T * headDim);
      const Km = new Float32Array(T * headDim);
      const Vm = new Float32Array(T * headDim);
      for (let t = 0; t < T; t++) {
        for (let d = 0; d < headDim; d++) {
          Qm[t * headDim + d] = Qh[t * (D_MODEL / N_HEADS) + d];
          Km[t * headDim + d] = Kh[t * (D_MODEL / N_HEADS) + d];
          Vm[t * headDim + d] = Vh[t * (D_MODEL / N_HEADS) + d];
        }
      }
      const { out } = scaledDotAttn(Qm, Km, Vm);
      headOuts.push(out);
    }

    const attnOut = new Float32Array(T * D_MODEL);
    for (let h = 0; h < N_HEADS; h++) {
      for (let t = 0; t < T; t++) {
        for (let d = 0; d < headDim; d++) {
          attnOut[t * D_MODEL + h * headDim + d] = headOuts[h][t * headDim + d];
        }
      }
    }

    const proj = new Float32Array(T * D_MODEL);
    for (let t = 0; t < T; t++) {
      for (let doff = 0; doff < D_MODEL; doff++) {
        let sv = 0;
        for (let di = 0; di < D_MODEL; di++) sv += attnOut[t * D_MODEL + di] * layer.wO[di * D_MODEL + doff];
        proj[t * D_MODEL + doff] = sv;
      }
    }

    const residual1 = new Float32Array(T * D_MODEL);
    for (let i = 0; i < T * D_MODEL; i++) residual1[i] = x[i] + proj[i];
    const ln1 = layerNorm(residual1, layer.ln1G, layer.ln1B, T * D_MODEL);
    let ffIn = ln1.out;

    if (training && rng && DROPOUT > 0) {
      const kp = 1 - DROPOUT;
      for (let i = 0; i < ffIn.length; i++) ffIn[i] = (rng() < kp ? 1 / kp : 0) * ffIn[i];
    }

    const ff1 = new Float32Array(T * D_FF);
    for (let t = 0; t < T; t++) {
      for (let doff = 0; doff < D_FF; doff++) {
        let sv = layer.bF1[doff];
        for (let di = 0; di < D_MODEL; di++) sv += ffIn[t * D_MODEL + di] * layer.wF1[di * D_FF + doff];
        ff1[t * D_FF + doff] = Math.max(0, sv);
      }
    }

    const ff2 = new Float32Array(T * D_MODEL);
    for (let t = 0; t < T; t++) {
      for (let doff = 0; doff < D_MODEL; doff++) {
        let sv = layer.bF2[doff];
        for (let di = 0; di < D_FF; di++) sv += ff1[t * D_FF + di] * layer.wF2[di * D_MODEL + doff];
        ff2[t * D_MODEL + doff] = sv;
      }
    }

    const residual2 = new Float32Array(T * D_MODEL);
    for (let i = 0; i < T * D_MODEL; i++) residual2[i] = residual1[i] + ff2[i];
    const ln2 = layerNorm(residual2, layer.ln2G, layer.ln2B, T * D_MODEL);
    x = ln2.out;
    layerCaches.push({ attnOut, proj, residual1, ln1, ff1, ff2, residual2, ln2 });
  }

  const pooled = new Float32Array(D_MODEL);
  for (let d = 0; d < D_MODEL; d++) {
    let mx = x[d];
    for (let t = 0; t < T; t++) if (x[t * D_MODEL + d] > mx) mx = x[t * D_MODEL + d];
    pooled[d] = mx;
  }

  const logits = new Float32Array(model.nClasses); logits.set(model.clfB);
  for (let d = 0; d < D_MODEL; d++) {
    if (pooled[d] === 0) continue;
    for (let ci = 0; ci < model.nClasses; ci++) logits[ci] += pooled[d] * model.clfW[d * model.nClasses + ci];
  }
  let mxL = logits[0]; for (let ci = 1; ci < model.nClasses; ci++) if (logits[ci] > mxL) mxL = logits[ci];
  const probs = new Float32Array(model.nClasses); let psum = 0;
  for (let ci = 0; ci < model.nClasses; ci++) { const p = Math.exp(logits[ci] - mxL); probs[ci] = p; psum += p; }
  for (let ci = 0; ci < model.nClasses; ci++) probs[ci] /= psum;
  return { layerCaches, pooled, probs };
};

const predict = (probs) => { let best = 0; for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i; return best; };

const applyAdam = (w, g, m, v, step, b1p, b2p) => {
  for (let i = 0; i < w.length; i++) {
    if (g[i] === 0) continue;
    m[i] = B1 * m[i] + (1 - B1) * g[i];
    v[i] = B2 * v[i] + (1 - B2) * g[i] * g[i];
    w[i] -= (LR * m[i] / (1 - b1p)) / (Math.sqrt(v[i] / (1 - b2p)) + EPS);
  }
};

const updateModel = (model, grads) => {
  model.step++; model.b1p *= B1; model.b2p *= B2;
  for (let pi = 0; pi < model.params.length; pi++) {
    applyAdam(model.params[pi], grads[pi], model.opts[pi].m, model.opts[pi].v, model.step, model.b1p, model.b2p);
  }
};

const trainSample = (model, sample, rng) => {
  const { layerCaches, pooled, probs } = fwdTransformer(model, sample, { training: true, rng });
  const loss = -Math.log(Math.max(probs[sample.labelId], Number.EPSILON));
  const pred = predict(probs);
  const grads = model.params.map((p) => new Float32Array(p.length));
  const delta = Float32Array.from(probs); delta[sample.labelId] -= 1;
  for (let ci = 0; ci < model.nClasses; ci++) grads[grads.length - 1][ci] = delta[ci];
  const dHidden = new Float32Array(D_MODEL);
  for (let d = 0; d < D_MODEL; d++) {
    let g = 0;
    for (let ci = 0; ci < model.nClasses; ci++) {
      grads[grads.length - 2][d * model.nClasses + ci] = pooled[d] * delta[ci];
      g += model.clfW[d * model.nClasses + ci] * delta[ci];
    }
    dHidden[d] = g;
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
    const { probs } = fwdTransformer(model, s); const p = predict(probs);
    loss += -Math.log(Math.max(probs[s.labelId], Number.EPSILON)); cor += p === s.labelId ? 1 : 0;
    cm[s.labelId][p] += 1;
  }
  const m = computePLM(cm, labels);
  return { n: samples.length, loss: loss / samples.length, acc: cor / samples.length, macroF1: m.macro.f1, weightedF1: m.weighted.f1, cm, plm: m };
};

const roundArr = (ta) => Array.from(ta, (v) => Number(v.toFixed(8)));

const saveOutputs = ({ labelsData, meta, model, trainM, valM, testM, hist }) => {
  ensureDir(OUTPUT_DIR);
  const cfg = {
    modelType: "unified-transformer", desc: "Temporal Transformer with self-attention on unified FSL data.",
    arch: { dModel: D_MODEL, nHeads: N_HEADS, nLayers: N_LAYERS, dFF: D_FF, dropout: DROPOUT, temporalSteps: T_STEPS, nClasses: labelsData.labels.length },
    lr: LR, epochs: hist.length, createdAt: new Date().toISOString()
  };
  writeJson(path.join(OUTPUT_DIR, "labels.json"), labelsData);
  writeJson(path.join(OUTPUT_DIR, "config.json"), cfg);
  writeJson(path.join(OUTPUT_DIR, "metrics.json"), {
    trainAcc: trainM.acc, valAcc: valM.acc, testAcc: testM.acc, testLoss: testM.loss,
    macroF1: testM.macroF1, weightedF1: testM.weightedF1,
    train: trainM, val: valM, test: testM, history: hist
  });
  writeJson(path.join(OUTPUT_DIR, "confusion_matrix.json"), { labels: labelsData.labels, matrix: testM.cm });
  const allWeights = {};
  allWeights.inputW = roundArr(model.inputW);
  allWeights.inputB = roundArr(model.inputB);
  for (let li = 0; li < model.layers.length; li++) {
    const l = model.layers[li];
    allWeights[`layer${li}`] = {
      wQ: roundArr(l.wQ), wK: roundArr(l.wK), wV: roundArr(l.wV), wO: roundArr(l.wO),
      wF1: roundArr(l.wF1), bF1: roundArr(l.bF1), wF2: roundArr(l.wF2), bF2: roundArr(l.bF2),
      ln1G: roundArr(l.ln1G), ln1B: roundArr(l.ln1B), ln2G: roundArr(l.ln2G), ln2B: roundArr(l.ln2B)
    };
  }
  allWeights.clfW = roundArr(model.clfW);
  allWeights.clfB = roundArr(model.clfB);
  writeJson(path.join(OUTPUT_DIR, "model.json"), { artifactType: "transformer", labels: labelsData.labels, config: cfg, weights: allWeights });
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

  console.log("Temporal Transformer Training");
  console.log(`d_model=${D_MODEL}, heads=${N_HEADS}, layers=${N_LAYERS}, ff=${D_FF}`);
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
  saveOutputs({ labelsData: ld, meta, model, trainM: tM, valM: vM, testM: teM, hist });
  console.log(`\nTrain: ${fmtPct(tM.acc)} Val: ${fmtPct(vM.acc)} Test: ${fmtPct(teM.acc)} F1: ${fmtPct(teM.macroF1)}`);
};

main();
