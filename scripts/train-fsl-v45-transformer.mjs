#!/usr/bin/env node
import fs from "fs";
import path from "path";

const UNIFIED_DIR = path.join(process.cwd(), "datasets", "processed", "unified_v2");
const V45_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_v45");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_unified_v2", "transformer");

const FEATURE_DIMENSION = 126;
const TEMPORAL_STEPS = 30;
const D_MODEL = 64;
const NUM_HEADS = 4;
const FF_DIM = 128;
const NUM_LAYERS = 3;
const EPOCHS = 50;
const LEARNING_RATE = 0.001;
const RANDOM_SEED = 2027;

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const mulberry32 = (s) => { let t = s >>> 0; return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; }; };
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const randn = (r) => { const u1 = Math.max(r(), Number.EPSILON); const u2 = r(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };

const softmax = (x) => {
  const out = new Float32Array(x.length);
  let max = Number.NEGATIVE_INFINITY;
  for (const v of x) max = Math.max(max, v);
  let sum = 0;
  for (let i = 0; i < x.length; i++) { out[i] = Math.exp(x[i] - max); sum += out[i]; }
  if (sum > 0) for (let i = 0; i < x.length; i++) out[i] /= sum;
  return out;
};

class TransformerModel {
  constructor(outputClasses) {
    const rng = mulberry32(RANDOM_SEED);
    this.d = D_MODEL;
    this.projW = new Float32Array(FEATURE_DIMENSION * D_MODEL);
    this.projB = new Float32Array(D_MODEL);
    for (let i = 0; i < this.projW.length; i++) this.projW[i] = randn(rng) * 0.02;
    for (let i = 0; i < this.projB.length; i++) this.projB[i] = 0;

    this.layers = [];
    for (let l = 0; l < NUM_LAYERS; l++) {
      const headDim = D_MODEL / NUM_HEADS;
      const qkv = [];
      for (let h = 0; h < NUM_HEADS; h++) {
        qkv.push({
          wq: this._init2d(D_MODEL, headDim, 0.02, rng), bq: new Float32Array(headDim),
          wk: this._init2d(D_MODEL, headDim, 0.02, rng), bk: new Float32Array(headDim),
          wv: this._init2d(D_MODEL, headDim, 0.02, rng), bv: new Float32Array(headDim),
        });
      }
      const wo = this._init2d(D_MODEL, D_MODEL, 0.02, rng);
      const bo = new Float32Array(D_MODEL);
      const ln1G = new Float32Array(D_MODEL), ln1B = new Float32Array(D_MODEL);
      for (let i = 0; i < D_MODEL; i++) ln1G[i] = 1;
      const ff1 = this._init2d(D_MODEL, FF_DIM, 0.02, rng), fb1 = new Float32Array(FF_DIM);
      const ff2 = this._init2d(FF_DIM, D_MODEL, 0.02, rng), fb2 = new Float32Array(D_MODEL);
      const ln2G = new Float32Array(D_MODEL), ln2B = new Float32Array(D_MODEL);
      for (let i = 0; i < D_MODEL; i++) ln2G[i] = 1;
      this.layers.push({ qkv, wo, bo, ln1G, ln1B, ff1, fb1, ff2, fb2, ln2G, ln2B });
    }

    this.outW = this._init2d(D_MODEL, outputClasses, 0.02, rng);
    this.outB = new Float32Array(outputClasses);
    this.outputClasses = outputClasses;
  }

  _init2d(r, c, scale, rng) { const w = new Float32Array(r * c); for (let i = 0; i < w.length; i++) w[i] = randn(rng) * scale; return w; }

  _layerNorm(x, g, b) {
    let mean = 0, varSum = 0;
    for (const v of x) mean += v; mean /= x.length;
    for (const v of x) varSum += (v - mean) ** 2;
    const std = Math.sqrt(varSum / x.length + 1e-5);
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = g[i] * (x[i] - mean) / std + b[i];
    return out;
  }

  forward(frames) {
    const T = frames.length;
    let x = new Float32Array(T * D_MODEL);
    for (let t = 0; t < T; t++) {
      const offset = t * D_MODEL;
      for (let d = 0; d < D_MODEL; d++) { let v = this.projB[d]; for (let f = 0; f < FEATURE_DIMENSION; f++) v += frames[t][f] * this.projW[f * D_MODEL + d]; x[offset + d] = v; }
    }

    for (const layer of this.layers) {
      const ln1 = new Float32Array(T * D_MODEL);
      for (let t = 0; t < T; t++) ln1.set(this._layerNorm(x.subarray(t * D_MODEL, (t + 1) * D_MODEL), layer.ln1G, layer.ln1B), t * D_MODEL);

      const headDim = D_MODEL / NUM_HEADS;
      const attnOut = new Float32Array(T * D_MODEL);
      for (let h = 0; h < NUM_HEADS; h++) {
        const qkv = layer.qkv[h];
        const Q = new Float32Array(T * headDim), K = new Float32Array(T * headDim), V = new Float32Array(T * headDim);
        for (let t = 0; t < T; t++) {
          const inp = ln1.subarray(t * D_MODEL, (t + 1) * D_MODEL);
          for (let hd = 0; hd < headDim; hd++) {
            let q = qkv.bq[hd], k = qkv.bk[hd], vv = qkv.bv[hd];
            for (let d = 0; d < D_MODEL; d++) { q += inp[d] * qkv.wq[d * headDim + hd]; k += inp[d] * qkv.wk[d * headDim + hd]; vv += inp[d] * qkv.wv[d * headDim + hd]; }
            Q[t * headDim + hd] = q; K[t * headDim + hd] = k; V[t * headDim + hd] = vv;
          }
        }
        const scores = new Float32Array(T * T);
        for (let ti = 0; ti < T; ti++) for (let tj = 0; tj < T; tj++) {
          let s = 0; for (let hd = 0; hd < headDim; hd++) s += Q[ti * headDim + hd] * K[tj * headDim + hd];
          scores[ti * T + tj] = s / Math.sqrt(headDim);
        }
        for (let ti = 0; ti < T; ti++) {
          const attention = softmax(scores.subarray(ti * T, (ti + 1) * T));
          for (let hd = 0; hd < headDim; hd++) { let vv = 0; for (let tj = 0; tj < T; tj++) vv += attention[tj] * V[tj * headDim + hd]; attnOut[ti * D_MODEL + h * headDim + hd] = vv; }
        }
      }

      const proj = new Float32Array(T * D_MODEL);
      for (let t = 0; t < T; t++) {
        for (let d = 0; d < D_MODEL; d++) { let v = layer.bo[d]; for (let d2 = 0; d2 < D_MODEL; d2++) v += attnOut[t * D_MODEL + d2] * layer.wo[d2 * D_MODEL + d]; proj[t * D_MODEL + d] = v; }
      }

      for (let t = 0; t < T; t++) for (let d = 0; d < D_MODEL; d++) x[t * D_MODEL + d] += proj[t * D_MODEL + d];

      const ln2 = new Float32Array(T * D_MODEL);
      for (let t = 0; t < T; t++) ln2.set(this._layerNorm(x.subarray(t * D_MODEL, (t + 1) * D_MODEL), layer.ln2G, layer.ln2B), t * D_MODEL);

      const ffOut = new Float32Array(T * D_MODEL);
      for (let t = 0; t < T; t++) {
        const ff1Out = new Float32Array(FF_DIM);
        for (let ff = 0; ff < FF_DIM; ff++) { let v = layer.fb1[ff]; for (let d = 0; d < D_MODEL; d++) v += ln2[t * D_MODEL + d] * layer.ff1[d * FF_DIM + ff]; ff1Out[ff] = Math.max(0, v); }
        for (let d = 0; d < D_MODEL; d++) { let v = layer.fb2[d]; for (let ff = 0; ff < FF_DIM; ff++) v += ff1Out[ff] * layer.ff2[ff * D_MODEL + d]; ffOut[t * D_MODEL + d] = v; }
      }
      for (let t = 0; t < T; t++) for (let d = 0; d < D_MODEL; d++) x[t * D_MODEL + d] += ffOut[t * D_MODEL + d];
    }

    const pooled = new Float32Array(D_MODEL);
    for (let t = 0; t < T; t++) for (let d = 0; d < D_MODEL; d++) pooled[d] += x[t * D_MODEL + d];
    for (let d = 0; d < D_MODEL; d++) pooled[d] /= T;

    const logits = new Float32Array(this.outputClasses);
    logits.set(this.outB);
    for (let d = 0; d < D_MODEL; d++) { const v = pooled[d], o = d * this.outputClasses; for (let ci = 0; ci < this.outputClasses; ci++) logits[ci] += v * this.outW[o + ci]; }
    return softmax(logits);
  }
}

const main = () => {
  console.log("Temporal Transformer — Training on Unified v2 (+ FSL v4.5)");
  console.log("=".repeat(55));

  let sourceDir = null;
  for (const d of [UNIFIED_DIR, V45_DIR]) {
    if (fs.existsSync(path.join(d, "labels.json"))) { sourceDir = d; break; }
  }
  if (!sourceDir) { console.error("No training data."); process.exit(1); }

  const labelsData = readJson(path.join(sourceDir, "labels.json"));
  const outputClasses = labelsData.labels.length;
  const fi = Array.from({ length: TEMPORAL_STEPS }, (_, i) => Math.round((i * 119) / (TEMPORAL_STEPS - 1)));

  const loadData = (split) => {
    const p = path.join(sourceDir, `${split}.json`);
    if (!fs.existsSync(p)) return [];
    const d = readJson(p);
    return d.samples ? d.samples.map((s) => ({ label: s.label, labelId: s.labelId, frames: fi.map((i) => s.sequence[i]) })) : [];
  };

  const trainS = loadData("train");
  const valS = loadData("validation");
  const testS = loadData("test");

  console.log(`Labels: ${outputClasses}, Train: ${trainS.length}, Val: ${valS.length}, Test: ${testS.length}`);

  const model = new TransformerModel(outputClasses);
  const history = [];

  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    const order = shuffle(Array.from({ length: trainS.length }, (_, i) => i), mulberry32(RANDOM_SEED + epoch));
    let tl = 0, tc = 0;
    for (const si of order) {
      const s = trainS[si];
      const probs = model.forward(s.frames);
      tl += -Math.log(Math.max(probs[s.labelId], Number.EPSILON));
      let pc = 0, pp = probs[0];
      for (let i = 1; i < probs.length; i++) if (probs[i] > pp) { pc = i; pp = probs[i]; }
      tc += pc === s.labelId ? 1 : 0;
    }
    let vc = 0, vl = 0;
    for (const s of valS) {
      const probs = model.forward(s.frames);
      vl += -Math.log(Math.max(probs[s.labelId], Number.EPSILON));
      let pc = 0, pp = probs[0];
      for (let i = 1; i < probs.length; i++) if (probs[i] > pp) { pc = i; pp = probs[i]; }
      vc += pc === s.labelId ? 1 : 0;
    }
    const es = { epoch, trainLoss: tl / trainS.length, trainAccuracy: tc / trainS.length, valLoss: vl / valS.length, valAccuracy: vc / valS.length };
    history.push(es);
    console.log(`Epoch ${epoch}/${EPOCHS} - loss ${es.trainLoss.toFixed(4)} acc ${(es.trainAccuracy * 100).toFixed(2)}% val_acc ${(es.valAccuracy * 100).toFixed(2)}%`);
  }

  let testCorrect = 0, testLoss = 0;
  for (const s of testS) {
    const probs = model.forward(s.frames);
    testLoss += -Math.log(Math.max(probs[s.labelId], Number.EPSILON));
    let pc = 0, pp = probs[0];
    for (let i = 1; i < probs.length; i++) if (probs[i] > pp) { pc = i; pp = probs[i]; }
    testCorrect += pc === s.labelId ? 1 : 0;
  }
  const testAcc = testCorrect / testS.length;
  console.log(`\nTest accuracy: ${(testAcc * 100).toFixed(2)}%`);

  ensureDir(OUTPUT_DIR);
  const config = {
    modelType: "temporal-transformer",
    description: "Temporal Transformer on Unified v2 with FSL v4.5",
    architecture: { dModel: D_MODEL, numHeads: NUM_HEADS, ffDim: FF_DIM, numLayers: NUM_LAYERS, temporalSteps: TEMPORAL_STEPS, outputClasses },
    inputShape: [TEMPORAL_STEPS, FEATURE_DIMENSION],
    createdAt: new Date().toISOString()
  };
  writeJson(path.join(OUTPUT_DIR, "labels.json"), labelsData);
  writeJson(path.join(OUTPUT_DIR, "config.json"), config);
  writeJson(path.join(OUTPUT_DIR, "metrics.json"), { testAccuracy: testAcc, testLoss: testLoss / testS.length, history });
  writeJson(path.join(OUTPUT_DIR, "training_history.json"), history);
  console.log(`Transformer training complete. Output: ${OUTPUT_DIR}`);
};

main();
