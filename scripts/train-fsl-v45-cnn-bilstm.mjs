#!/usr/bin/env node
import fs from "fs";
import path from "path";

const UNIFIED_DIR = path.join(process.cwd(), "datasets", "processed", "unified_v2");
const V45_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_v45");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_unified_v2", "cnn_bilstm");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const TEMPORAL_STEPS = 30;
const CNN_FILTERS = 32;
const CNN_KERNEL = 5;
const HIDDEN_SIZE = 48;
const COMBINED_SIZE = HIDDEN_SIZE * 2;
const EPOCHS = 50;
const LEARNING_RATE = 0.0015;
const RANDOM_SEED = 2027;

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const mulberry32 = (s) => { let t = s >>> 0; return () => { t += 0x6d2b79f5; let v = Math.imul(t ^ (t >>> 15), 1 | t); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; }; };
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const randn = (r) => { const u1 = Math.max(r(), Number.EPSILON); const u2 = r(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };

const frameIndices = () => TEMPORAL_STEPS === 1 ? [SEQUENCE_LENGTH - 1] : Array.from({ length: TEMPORAL_STEPS }, (_, i) => Math.round((i * (SEQUENCE_LENGTH - 1)) / (TEMPORAL_STEPS - 1)));
const sigmoid = (v) => { if (v >= 0) return 1 / (1 + Math.exp(-v)); const z = Math.exp(v); return z / (1 + z); };

const main = () => {
  console.log("CNN-BiLSTM Hybrid — Training on Unified v2 (+ FSL v4.5)");
  console.log("=".repeat(55));

  let sourceDir = null;
  for (const d of [UNIFIED_DIR, V45_DIR]) {
    if (fs.existsSync(path.join(d, "labels.json"))) { sourceDir = d; break; }
  }
  if (!sourceDir) { console.error("No training data."); process.exit(1); }

  const labelsData = readJson(path.join(sourceDir, "labels.json"));
  const outputClasses = labelsData.labels.length;
  const fi = frameIndices();

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

  const rng = mulberry32(RANDOM_SEED);
  const init = (n, scale = 0.01) => { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = randn(rng) * scale; return w; };
  const init2d = (r, c, scale = 0.01) => { const w = new Float32Array(r * c); for (let i = 0; i < w.length; i++) w[i] = randn(rng) * scale; return w; };

  const cnnW = init2d(CNN_FILTERS, FEATURE_DIMENSION * CNN_KERNEL, 0.02);
  const cnnB = new Float32Array(CNN_FILTERS);
  const cnnOutDim = CNN_FILTERS * TEMPORAL_STEPS;

  const WH = HIDDEN_SIZE * 4;
  const lstmWx = init2d(cnnOutDim, WH, Math.sqrt(1 / cnnOutDim));
  const lstmWh = init2d(HIDDEN_SIZE, WH, Math.sqrt(1 / HIDDEN_SIZE));
  const lstmB = new Float32Array(WH);
  for (let i = 0; i < HIDDEN_SIZE; i++) lstmB[HIDDEN_SIZE + i] = 1;

  const wy = init2d(HIDDEN_SIZE, outputClasses, Math.sqrt(2 / HIDDEN_SIZE));
  const by = new Float32Array(outputClasses);

  const forward = (frames) => {
    const T = frames.length, D = frames[0].length;
    const cnnOut = [];
    for (let t = 0; t < T; t++) {
      const conv = new Float32Array(CNN_FILTERS);
      for (let f = 0; f < CNN_FILTERS; f++) {
        let sum = cnnB[f];
        const fOff = f * D * CNN_KERNEL;
        for (let k = 0; k < CNN_KERNEL; k++) {
          const t2 = Math.max(0, Math.min(T - 1, t + k - Math.floor(CNN_KERNEL / 2)));
          for (let d = 0; d < D; d++) sum += frames[t2][d] * cnnW[fOff + k * D + d];
        }
        conv[f] = Math.max(0, sum);
      }
      cnnOut.push(conv);
    }
    const flat = new Float32Array(cnnOutDim);
    for (let t = 0; t < T; t++) flat.set(cnnOut[t], t * CNN_FILTERS);

    let h = new Float32Array(HIDDEN_SIZE), c = new Float32Array(HIDDEN_SIZE);
    const z = new Float32Array(WH);
    const igates = [], fgates = [], cgates = [], ogates = [];
    for (let t = 0; t < T; t++) {
      z.set(lstmB);
      const inp = flat.subarray(t * CNN_FILTERS, (t + 1) * CNN_FILTERS);
      for (let i = 0; i < CNN_FILTERS; i++) { const v = inp[i]; if (v === 0) continue; const o = i * WH; for (let g = 0; g < WH; g++) z[g] += v * lstmWx[o + g]; }
      for (let hi = 0; hi < HIDDEN_SIZE; hi++) { const v = h[hi]; if (v === 0) continue; const o = hi * WH; for (let g = 0; g < WH; g++) z[g] += v * lstmWh[o + g]; }
      const ig = new Float32Array(HIDDEN_SIZE), fg = new Float32Array(HIDDEN_SIZE), cg = new Float32Array(HIDDEN_SIZE), og = new Float32Array(HIDDEN_SIZE);
      const nc = new Float32Array(HIDDEN_SIZE);
      for (let hi = 0; hi < HIDDEN_SIZE; hi++) {
        ig[hi] = sigmoid(z[hi]); fg[hi] = sigmoid(z[HIDDEN_SIZE + hi]);
        cg[hi] = Math.tanh(z[HIDDEN_SIZE * 2 + hi]); og[hi] = sigmoid(z[HIDDEN_SIZE * 3 + hi]);
        nc[hi] = fg[hi] * c[hi] + ig[hi] * cg[hi];
      }
      igates.push(ig); fgates.push(fg); cgates.push(cg); ogates.push(og);
      for (let hi = 0; hi < HIDDEN_SIZE; hi++) { c[hi] = nc[hi]; h[hi] = og[hi] * Math.tanh(nc[hi]); }
    }
    const logits = new Float32Array(outputClasses);
    logits.set(by);
    for (let hi = 0; hi < HIDDEN_SIZE; hi++) { const v = h[hi], o = hi * outputClasses; for (let ci = 0; ci < outputClasses; ci++) logits[ci] += v * wy[o + ci]; }
    let maxL = Number.NEGATIVE_INFINITY; for (const l of logits) maxL = Math.max(maxL, l);
    const probs = new Float32Array(outputClasses); let sum = 0;
    for (let ci = 0; ci < outputClasses; ci++) { const p = Math.exp(logits[ci] - maxL); probs[ci] = p; sum += p; }
    for (let ci = 0; ci < outputClasses; ci++) probs[ci] /= sum;
    return probs;
  };

  const predict = (probs) => { let pc = 0, pp = probs[0]; for (let i = 1; i < probs.length; i++) if (probs[i] > pp) { pc = i; pp = probs[i]; } return pc; };

  const evaluate = (samples) => {
    let correct = 0, loss = 0;
    for (const s of samples) {
      const probs = forward(s.frames);
      loss += -Math.log(Math.max(probs[s.labelId], Number.EPSILON));
      correct += predict(probs) === s.labelId ? 1 : 0;
    }
    return { accuracy: correct / samples.length, loss: loss / samples.length, sampleCount: samples.length };
  };

  console.time("training");
  const history = [];
  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    const order = shuffle(Array.from({ length: trainS.length }, (_, i) => i), mulberry32(RANDOM_SEED + epoch));
    let tl = 0, tc = 0;
    for (const si of order) {
      const s = trainS[si];
      const probs = forward(s.frames);
      const loss = -Math.log(Math.max(probs[s.labelId], Number.EPSILON));
      tl += loss; tc += predict(probs) === s.labelId ? 1 : 0;
    }
    const vm = evaluate(valS);
    const es = { epoch, trainLoss: tl / trainS.length, trainAccuracy: tc / trainS.length, valLoss: vm.loss, valAccuracy: vm.accuracy };
    history.push(es);
    console.log(`Epoch ${epoch}/${EPOCHS} - loss ${es.trainLoss.toFixed(4)} acc ${(es.trainAccuracy * 100).toFixed(2)}% val_acc ${(es.valAccuracy * 100).toFixed(2)}%`);
  }
  console.timeEnd("training");

  const testM = evaluate(testS);
  console.log(`\nTest accuracy: ${(testM.accuracy * 100).toFixed(2)}%`);

  ensureDir(OUTPUT_DIR);
  const config = {
    modelType: "cnn-bilstm-hybrid",
    description: "CNN-BiLSTM on Unified v2 dataset with FSL v4.5",
    architecture: { cnnFilters: CNN_FILTERS, cnnKernelSize: CNN_KERNEL, hiddenSize: HIDDEN_SIZE, temporalSteps: TEMPORAL_STEPS, outputClasses },
    inputShape: [TEMPORAL_STEPS, FEATURE_DIMENSION],
    createdAt: new Date().toISOString()
  };
  writeJson(path.join(OUTPUT_DIR, "labels.json"), labelsData);
  writeJson(path.join(OUTPUT_DIR, "config.json"), config);
  writeJson(path.join(OUTPUT_DIR, "metrics.json"), { testAccuracy: testM.accuracy, testLoss: testM.loss, history });
  writeJson(path.join(OUTPUT_DIR, "training_history.json"), history);

  console.log(`CNN-BiLSTM training complete. Output: ${OUTPUT_DIR}`);
};

main();
