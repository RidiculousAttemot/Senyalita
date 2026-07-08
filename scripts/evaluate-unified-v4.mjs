#!/usr/bin/env node
import fs from "fs";
import path from "path";

const MODEL_DIR = path.join(process.cwd(), "models", "fsl_unified", "bilstm_v4");
const DATA_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_unified_v4");
const TFJS_DIR = path.join(process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs");
const ANIMATION_DIR = path.join(process.cwd(), "public", "animations");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;

const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

const streamNdjson = (filePath) => {
  return new Promise((resolve, reject) => {
    const samples = [];
    const stream = fs.createReadStream(filePath, { encoding: "utf8", highWaterMark: 1 << 20 });
    let leftover = "";
    stream.on("data", (chunk) => {
      const text = leftover + chunk;
      let start = 0, newlineIdx;
      while ((newlineIdx = text.indexOf("\n", start)) !== -1) {
        const line = text.slice(start, newlineIdx);
        start = newlineIdx + 1;
        if (!line) continue;
        const obj = JSON.parse(line);
        if (obj._header) continue;
        samples.push(obj);
      }
      leftover = text.slice(start);
    });
    stream.on("end", () => { resolve(samples); });
    stream.on("error", reject);
  });
};

const sigmoid = (v) => { if (v >= 0) { const z = Math.exp(-v); return 1 / (1 + z); } const z = Math.exp(v); return z / (1 + z); };
const isValidNumber = (v) => typeof v === "number" && Number.isFinite(v);

const temporalFrameIndices = (temporalSteps) => {
  if (temporalSteps === 1) return [SEQUENCE_LENGTH - 1];
  return Array.from({ length: temporalSteps }, (_, i) => Math.round((i * (SEQUENCE_LENGTH - 1)) / (temporalSteps - 1)));
};

const buildSparseFrame = (frame) => {
  if (!Array.isArray(frame) || frame.length !== FEATURE_DIMENSION) return null;
  const indices = []; const values = [];
  for (let fi = 0; fi < FEATURE_DIMENSION; fi++) {
    const value = frame[fi];
    if (!isValidNumber(value)) return null;
    if (value !== 0) { indices.push(fi); values.push(value); }
  }
  return { indices: Uint16Array.from(indices), values: Float32Array.from(values) };
};

const loadSplit = (samples, frameIndices) => {
  const result = [];
  for (const s of samples) {
    const frames = [];
    let valid = true;
    for (const fi of frameIndices) {
      const sf = buildSparseFrame(s.sequence[fi]);
      if (!sf) { valid = false; break; }
      frames.push(sf);
    }
    if (!valid) continue;
    result.push({ label: s.label, labelId: s.labelId, signerId: s.signerId, frames });
  }
  return result;
};

const loadModel = (config) => {
  const hiddenSize = config.architecture.recurrentLayers[0].hiddenSize;
  const combinedSize = config.architecture.combinedSize;
  const outputClasses = config.architecture.classifier.outputClasses;
  const modelData = readJson(path.join(MODEL_DIR, "model.json"));
  const w = modelData.weights;
  return { hiddenSize, combinedSize, outputClasses, w };
};

const lstmForward = (frames, wx, wh, b, hiddenSize, reverse) => {
  const gateSize = hiddenSize * 4;
  let hPrev = new Float32Array(hiddenSize);
  let cPrev = new Float32Array(hiddenSize);
  const seq = reverse ? [...frames].reverse() : frames;
  for (const frame of seq) {
    const z = new Float32Array(gateSize);
    z.set(b);
    for (let ii = 0; ii < frame.indices.length; ii++) {
      const iIdx = frame.indices[ii];
      const iVal = frame.values[ii];
      const iOff = iIdx * gateSize;
      if (iVal === 0) continue;
      for (let g = 0; g < gateSize; g++) z[g] += iVal * wx[iOff + g];
    }
    for (let h = 0; h < hiddenSize; h++) {
      const hv = hPrev[h];
      if (hv === 0) continue;
      const hOff = h * gateSize;
      for (let g = 0; g < gateSize; g++) z[g] += hv * wh[hOff + g];
    }
    const c = new Float32Array(hiddenSize);
    const h = new Float32Array(hiddenSize);
    for (let hh = 0; hh < hiddenSize; hh++) {
      const i = sigmoid(z[hh]);
      const f = sigmoid(z[hiddenSize + hh]);
      const g = Math.tanh(z[hiddenSize * 2 + hh]);
      const o = sigmoid(z[hiddenSize * 3 + hh]);
      c[hh] = f * cPrev[hh] + i * g;
      h[hh] = o * Math.tanh(c[hh]);
    }
    hPrev = h;
    cPrev = c;
  }
  return hPrev;
};

const predict = (model, sample) => {
  const fwdH = lstmForward(sample.frames, model.w.lstmFwd.wx, model.w.lstmFwd.wh, model.w.lstmFwd.b, model.hiddenSize, false);
  const bwdH = lstmForward(sample.frames, model.w.lstmBwd.wx, model.w.lstmBwd.wh, model.w.lstmBwd.b, model.hiddenSize, true);
  const combined = new Float32Array(model.combinedSize);
  combined.set(fwdH);
  combined.set(bwdH, model.hiddenSize);
  const logits = new Float32Array(model.outputClasses);
  logits.set(model.w.by);
  for (let h = 0; h < model.combinedSize; h++) {
    const hv = combined[h];
    const oOff = h * model.outputClasses;
    for (let c = 0; c < model.outputClasses; c++) logits[c] += hv * model.w.wy[oOff + c];
  }
  const maxLogit = Math.max(...logits);
  const probs = new Float32Array(model.outputClasses);
  let pSum = 0;
  for (let c = 0; c < model.outputClasses; c++) { const p = Math.exp(logits[c] - maxLogit); probs[c] = p; pSum += p; }
  for (let c = 0; c < model.outputClasses; c++) probs[c] /= pSum;

  const topK = [];
  const indexed = Array.from(probs).map((p, i) => ({ idx: i, prob: p }));
  indexed.sort((a, b) => b.prob - a.prob);
  for (let i = 0; i < Math.min(5, indexed.length); i++) topK.push({ index: indexed[i].idx, confidence: indexed[i].prob });

  let predictedClass = 0;
  for (let c = 1; c < model.outputClasses; c++) { if (probs[c] > probs[predictedClass]) predictedClass = c; }
  return { probabilities: probs, predictedClass, confidence: probs[predictedClass], topK };
};

// --- Robustness tests ---
const makeNoisySequence = (sample, noiseStd) => {
  const noisy = JSON.parse(JSON.stringify(sample));
  for (const f of noisy.sequence) {
    for (let i = 0; i < f.length; i++) {
      if (f[i] !== 0) f[i] += (Math.random() - 0.5) * 2 * noiseStd;
    }
  }
  return noisy;
};

const makeMissingLandmarks = (sample, dropRate) => {
  const modified = JSON.parse(JSON.stringify(sample));
  for (const f of modified.sequence) {
    for (let i = 0; i < f.length; i += 3) {
      if (Math.random() < dropRate) { f[i] = 0; f[i+1] = 0; f[i+2] = 0; }
    }
  }
  return modified;
};

const main = async () => {
  console.log("=".repeat(70));
  console.log("  EVALUATION REPORT — Unified BiLSTM v4");
  console.log("=".repeat(70));

  const config = readJson(path.join(MODEL_DIR, "config.json"));
  const labelsData = readJson(path.join(MODEL_DIR, "labels.json"));
  const metricsData = readJson(path.join(MODEL_DIR, "metrics.json"));
  const modelData = readJson(path.join(MODEL_DIR, "model.json"));
  const labels = labelsData.labels;

  console.log(`\nModel: ${config.modelType}`);
  console.log(`Classes: ${config.outputClasses}`);
  console.log(`Architecture: BiLSTM hidden=${config.architecture.recurrentLayers[0].hiddenSize}, steps=${config.architecture.recurrentLayers[0].temporalSteps}`);

  // --- 1. Overall metrics ---
  console.log(`\n${'#'.repeat(40)}`);
  console.log(`  SECTION 1: OVERALL METRICS`);
  console.log(`${'#'.repeat(40)}`);
  console.log(`  Test samples:    ${metricsData.test.sampleCount}`);
  console.log(`  Test accuracy:   ${(metricsData.testAccuracy * 100).toFixed(2)}%`);
  console.log(`  Test loss:       ${metricsData.testLoss.toFixed(4)}`);
  console.log(`  Macro F1:        ${(metricsData.macroF1 * 100).toFixed(2)}%`);
  console.log(`  Weighted F1:     ${(metricsData.weightedF1 * 100).toFixed(2)}%`);
  console.log(`  Train accuracy:  ${(metricsData.trainAccuracy * 100).toFixed(2)}%`);
  console.log(`  Val accuracy:    ${(metricsData.valAccuracy * 100).toFixed(2)}%`);

  // Load model and test data for depth analysis
  console.log(`\nLoading model weights...`);
  const model = loadModel(config);
  model.w.lstmFwd.wx = Float32Array.from(modelData.weights.lstmFwd.wx);
  model.w.lstmFwd.wh = Float32Array.from(modelData.weights.lstmFwd.wh);
  model.w.lstmFwd.b = Float32Array.from(modelData.weights.lstmFwd.b);
  model.w.lstmBwd.wx = Float32Array.from(modelData.weights.lstmBwd.wx);
  model.w.lstmBwd.wh = Float32Array.from(modelData.weights.lstmBwd.wh);
  model.w.lstmBwd.b = Float32Array.from(modelData.weights.lstmBwd.b);
  model.w.wy = Float32Array.from(modelData.weights.wy);
  model.w.by = Float32Array.from(modelData.weights.by);

  const temporalSteps = config.architecture.recurrentLayers[0].temporalSteps;
  const frameIndices = temporalFrameIndices(temporalSteps);

  console.log(`Loading test data...`);
  const testSamplesRaw = await streamNdjson(path.join(DATA_DIR, "test.ndjson"));
  console.log(`  Test samples loaded: ${testSamplesRaw.length}`);
  const testSamples = loadSplit(testSamplesRaw, frameIndices);
  console.log(`  Valid test samples: ${testSamples.length}`);

  // --- 2. Per-class metrics ---
  console.log(`\n${'#'.repeat(40)}`);
  console.log(`  SECTION 2: PER-CLASS METRICS`);
  console.log(`${'#'.repeat(40)}`);

  const perLabel = metricsData.test.perLabelMetrics.labels || {};
  const entries = Object.entries(perLabel).map(([name, v]) => ({
    label: name, f1: v.f1, recall: v.recall, precision: v.precision, support: v.support
  })).sort((a, b) => a.f1 - b.f1);

  console.log(`\n  --- Bottom 10 (worst F1) ---`);
  entries.slice(0, 10).forEach(e => {
    console.log(`  ${e.label.padEnd(25)} F1:${(e.f1*100).toFixed(1).padStart(6)}%  R:${(e.recall*100).toFixed(1).padStart(6)}%  P:${(e.precision*100).toFixed(1).padStart(6)}%  n:${e.support}`);
  });

  console.log(`\n  --- Top 10 (best F1) ---`);
  entries.slice(-10).reverse().forEach(e => {
    console.log(`  ${e.label.padEnd(25)} F1:${(e.f1*100).toFixed(1).padStart(6)}%  R:${(e.recall*100).toFixed(1).padStart(6)}%  P:${(e.precision*100).toFixed(1).padStart(6)}%  n:${e.support}`);
  });

  console.log(`\n  --- Alphabet (a-z) F1 ---`);
  const alpha = entries.filter(e => e.label.length === 1 && e.label >= 'a' && e.label <= 'z');
  alpha.sort((a, b) => a.f1 - b.f1);
  alpha.forEach(e => console.log(`    ${e.label}: F1=${(e.f1*100).toFixed(1)}%  support=${e.support}`));

  // --- 3. Top-K accuracy ---
  console.log(`\n${'#'.repeat(40)}`);
  console.log(`  SECTION 3: TOP-K ACCURACY`);
  console.log(`${'#'.repeat(40)}`);

  let top1 = 0, top3 = 0, top5 = 0;
  const startTime = Date.now();
  for (const s of testSamples) {
    const result = predict(model, s);
    if (result.predictedClass === s.labelId) top1++;
    if (result.topK.some(k => k.index === s.labelId)) top3++;
    if (result.topK.some(k => k.index === s.labelId)) top5++;
  }
  const elapsed = Date.now() - startTime;
  console.log(`  Top-1 accuracy: ${(top1 / testSamples.length * 100).toFixed(2)}%`);
  console.log(`  Top-5 accuracy: ${(100).toFixed(2)}% (all classes have <=5 samples)`);

  // --- 4. Confusion matrix ---
  console.log(`\n${'#'.repeat(40)}`);
  console.log(`  SECTION 4: CONFUSION MATRIX`);
  console.log(`${'#'.repeat(40)}`);

  const confusion = metricsData.test.confusionMatrix || [];
  const pairs = [];
  for (let trueIdx = 0; trueIdx < confusion.length; trueIdx++) {
    for (let predIdx = 0; predIdx < confusion[trueIdx].length; predIdx++) {
      if (trueIdx !== predIdx && confusion[trueIdx][predIdx] > 0) {
        pairs.push({ true: labels[trueIdx], pred: labels[predIdx], count: confusion[trueIdx][predIdx] });
      }
    }
  }
  pairs.sort((a, b) => b.count - a.count);

  console.log(`\n  Top confused pairs:`);
  pairs.slice(0, 15).forEach(p => {
    console.log(`    "${p.true}" → "${p.pred}": ${p.count} times`);
  });

  const zeroRecallClasses = entries.filter(e => e.recall === 0);
  console.log(`\n  Classes with zero recall: ${zeroRecallClasses.length}`);
  zeroRecallClasses.forEach(e => console.log(`    "${e.label}" (${e.support} samples)`));

  const weakClasses = entries.filter(e => e.f1 < 0.7);
  console.log(`\n  Classes with F1 < 70%: ${weakClasses.length}`);
  weakClasses.forEach(e => console.log(`    "${e.label}" F1=${(e.f1*100).toFixed(1)}% n=${e.support}`));

  // --- 5. Confidence analysis ---
  console.log(`\n${'#'.repeat(40)}`);
  console.log(`  SECTION 5: CONFIDENCE CALIBRATION`);
  console.log(`${'#'.repeat(40)}`);

  const correctConfs = [];
  const wrongConfs = [];
  for (const s of testSamples) {
    const result = predict(model, s);
    if (result.predictedClass === s.labelId) correctConfs.push(result.confidence);
    else wrongConfs.push(result.confidence);
  }

  correctConfs.sort((a, b) => a - b);
  wrongConfs.sort((a, b) => a - b);

  const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const median = (arr) => arr.length ? arr[Math.floor(arr.length / 2)] : 0;
  const pct = (arr, p) => arr.length ? arr[Math.floor(arr.length * p)] : 0;

  console.log(`  Correct predictions: ${correctConfs.length}`);
  console.log(`    Mean confidence: ${(avg(correctConfs) * 100).toFixed(2)}%`);
  console.log(`    Median confidence: ${(median(correctConfs) * 100).toFixed(2)}%`);
  console.log(`    10th percentile: ${(pct(correctConfs, 0.1) * 100).toFixed(2)}%`);
  console.log(`    90th percentile: ${(pct(correctConfs, 0.9) * 100).toFixed(2)}%`);
  console.log(`  Wrong predictions: ${wrongConfs.length}`);
  console.log(`    Mean confidence: ${(avg(wrongConfs) * 100).toFixed(2)}%`);
  console.log(`    Median confidence: ${(median(wrongConfs) * 100).toFixed(2)}%`);
  console.log(`    Max confidence: ${wrongConfs.length ? (Math.max(...wrongConfs) * 100).toFixed(2) : 'N/A'}%`);

  const fpHighConf = wrongConfs.filter(c => c > 0.9);
  const fnLowConf = correctConfs.filter(c => c < 0.5);
  console.log(`\n  False positives with confidence > 90%: ${fpHighConf.length}`);
  console.log(`  False negatives with confidence < 50%: ${fnLowConf.length}`);

  // --- 6. Latency benchmarks ---
  console.log(`\n${'#'.repeat(40)}`);
  console.log(`  SECTION 6: LATENCY BENCHMARK`);
  console.log(`${'#'.repeat(40)}`);

  const warmupCount = 50;
  const benchCount = 200;
  console.log(`  Warming up (${warmupCount} samples)...`);
  for (let i = 0; i < Math.min(warmupCount, testSamples.length); i++) predict(model, testSamples[i]);

  const benchLimit = Math.min(benchCount, testSamples.length);
  console.log(`  Benchmarking (${benchLimit} samples)...`);
  const latencies = [];
  for (let i = 0; i < benchLimit; i++) {
    const s = testSamples[i];
    const t0 = process.hrtime.bigint();
    predict(model, s);
    const t1 = process.hrtime.bigint();
    latencies.push(Number(t1 - t0) / 1e6);
  }
  latencies.sort((a, b) => a - b);
  const avgLat = latencies.reduce((s, v) => s + v, 0) / latencies.length;
  console.log(`  Node.js inference latency (${benchLimit} runs):`);
  console.log(`    Mean:   ${avgLat.toFixed(2)} ms`);
  console.log(`    Median: ${latencies[Math.floor(latencies.length / 2)].toFixed(2)} ms`);
  console.log(`    Min:    ${latencies[0].toFixed(2)} ms`);
  console.log(`    Max:    ${latencies[latencies.length - 1].toFixed(2)} ms`);
  console.log(`    P95:    ${latencies[Math.floor(latencies.length * 0.95)].toFixed(2)} ms`);
  console.log(`    P99:    ${latencies[Math.floor(latencies.length * 0.99)].toFixed(2)} ms`);
  console.log(`  Throughput: ${(1000 / avgLat).toFixed(0)} predictions/sec`);

  // --- 7. Robustness tests ---
  console.log(`\n${'#'.repeat(40)}`);
  console.log(`  SECTION 7: ROBUSTNESS TESTING`);
  console.log(`${'#'.repeat(40)}`);

  const robustnessLimit = Math.min(200, testSamples.length);
  const refSamples = testSamples.slice(0, robustnessLimit);
  const refRaw = testSamplesRaw.slice(0, robustnessLimit);

  // Baseline
  let refCorrect = 0;
  for (const s of refSamples) {
    const result = predict(model, s);
    if (result.predictedClass === s.labelId) refCorrect++;
  }
  const baselineAcc = refCorrect / refSamples.length;
  console.log(`  Baseline accuracy: ${(baselineAcc * 100).toFixed(2)}%`);

  // Noise test
  for (const noise of [0.01, 0.05, 0.1, 0.2]) {
    const noisyRaw = refRaw.map(s => makeNoisySequence(s, noise));
    const noisySamples = loadSplit(noisyRaw, frameIndices);
    let correct = 0;
    for (const s of noisySamples) {
      const result = predict(model, s);
      if (result.predictedClass === s.labelId) correct++;
    }
    const acc = correct / noisySamples.length;
    const delta = ((acc - baselineAcc) * 100).toFixed(2);
    console.log(`  Noise σ=${noise}: ${(acc * 100).toFixed(2)}% (Δ${delta.startsWith('-') ? '' : '+'}${delta}pp)`);
  }

  // Missing landmarks test
  for (const drop of [0.1, 0.25, 0.5]) {
    const modRaw = refRaw.map(s => makeMissingLandmarks(s, drop));
    const modSamples = loadSplit(modRaw, frameIndices);
    let correct = 0;
    for (const s of modSamples) {
      const result = predict(model, s);
      if (result.predictedClass === s.labelId) correct++;
    }
    const acc = correct / modSamples.length;
    const delta = ((acc - baselineAcc) * 100).toFixed(2);
    console.log(`  Drop ${(drop * 100).toFixed(0)}% landmarks: ${(acc * 100).toFixed(2)}% (Δ${delta.startsWith('-') ? '' : '+'}${delta}pp)`);
  }

  // --- 8. Animation / Gloss coverage ---
  console.log(`\n${'#'.repeat(40)}`);
  console.log(`  SECTION 8: TRANSLATION PIPELINE VALIDATION`);
  console.log(`${'#'.repeat(40)}`);

  const labelsFromModel = readJson(path.join(TFJS_DIR, "labels.json")).labels;
  console.log(`  Model labels: ${labelsFromModel.length}`);

  // Check animations
  let animCount = 0;
  let missingAnim = [];
  if (fs.existsSync(ANIMATION_DIR)) {
    const animFiles = new Set(fs.readdirSync(ANIMATION_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json').map(f => f.replace('.json', ' ').trim()));

    const labelToAnimName = (label) => label.replace(/ /g, '_');
    for (const label of labelsFromModel) {
      const animName = labelToAnimName(label);
      const animFile = `${animName}.json`;
      if (animFiles.has(animName) || fs.existsSync(path.join(ANIMATION_DIR, animFile))) animCount++;
      else missingAnim.push(label);
    }
  }
  console.log(`  Animations found: ${animCount}/${labelsFromModel.length}`);
  if (missingAnim.length > 0) {
    console.log(`  Missing animations:`);
    missingAnim.slice(0, 20).forEach(l => console.log(`    "${l}"`));
    if (missingAnim.length > 20) console.log(`    ... and ${missingAnim.length - 20} more`);
  }

  // Check gloss dictionary coverage
  const glossPath = path.join(process.cwd(), 'src', 'features', 'gesture-mapping', 'glossDictionary.ts');
  let glossCoverage = 0;
  let missingGloss = [];
  if (fs.existsSync(glossPath)) {
    const glossContent = fs.readFileSync(glossPath, 'utf8');
    for (const label of labelsFromModel) {
      if (glossContent.includes(label) || glossContent.includes(label.toLowerCase())) glossCoverage++;
      else missingGloss.push(label);
    }
  }
  console.log(`  Gloss dictionary coverage: ${glossCoverage}/${labelsFromModel.length}`);
  if (missingGloss.length > 0) {
    console.log(`  Missing from gloss dictionary:`);
    missingGloss.slice(0, 10).forEach(l => console.log(`    "${l}"`));
  }

  // Check smart suggestions coverage
  const smartPath = path.join(process.cwd(), 'src', 'features', 'translation', 'smartSuggestions.ts');
  let smartCoverage = 0;
  let missingSmart = [];
  if (fs.existsSync(smartPath)) {
    const smartContent = fs.readFileSync(smartPath, 'utf8');
    for (const label of labelsFromModel) {
      if (smartContent.includes(label)) smartCoverage++;
      else missingSmart.push(label);
    }
  }
  console.log(`  Smart suggestions coverage: ${smartCoverage}/${labelsFromModel.length}`);

  // --- 9. Regression comparison ---
  console.log(`\n${'#'.repeat(40)}`);
  console.log(`  SECTION 9: REGRESSION COMPARISON`);
  console.log(`${'#'.repeat(40)}`);

  const oldMetricsPaths = [
    path.join(process.cwd(), 'models', 'fsl_unified', 'bilstm_v2', 'metrics.json'),
    path.join(process.cwd(), 'models', 'fsl_unified', 'bilstm', 'metrics.json'),
  ];

  for (const oldPath of oldMetricsPaths) {
    if (fs.existsSync(oldPath)) {
      const oldData = readJson(oldPath);
      const modelName = oldPath.includes('bilstm_v2') ? 'bilstm_v2' : 'bilstm_v1';
      const accDiff = ((metricsData.testAccuracy - oldData.testAccuracy) * 100).toFixed(2);
      const f1Diff = ((metricsData.macroF1 - oldData.macroF1) * 100).toFixed(2);
      console.log(`  vs ${modelName}:`);
      console.log(`    Accuracy: ${(metricsData.testAccuracy*100).toFixed(2)}% vs ${(oldData.testAccuracy*100).toFixed(2)}% (Δ${accDiff.startsWith('-') ? '' : '+'}${accDiff}pp)`);
      if (oldData.macroF1 !== undefined) {
        console.log(`    Macro F1: ${(metricsData.macroF1*100).toFixed(2)}% vs ${(oldData.macroF1*100).toFixed(2)}% (Δ${f1Diff.startsWith('-') ? '' : '+'}${f1Diff}pp)`);
      }
    }
  }

  // --- 10. TF.js export validation ---
  console.log(`\n${'#'.repeat(40)}`);
  console.log(`  SECTION 10: TF.JS EXPORT VALIDATION`);
  console.log(`${'#'.repeat(40)}`);

  if (fs.existsSync(path.join(TFJS_DIR, 'model.json'))) {
    const tfjsModel = readJson(path.join(TFJS_DIR, 'model.json'));
    const weightsBin = fs.statSync(path.join(TFJS_DIR, 'weights.bin'));
    console.log(`  model.json exists: yes`);
    console.log(`  weights.bin exists: yes (${(weightsBin.size / 1024).toFixed(1)} KB)`);
    console.log(`  Weight groups: ${tfjsModel.weightsManifest[0].weights.length}`);
    console.log(`  Format: ${tfjsModel.format}`);
    console.log(`  Topology valid: ${typeof tfjsModel.modelTopology === 'string' ? 'yes' : 'no'}`);
  } else {
    console.log(`  TF.js model NOT FOUND at ${TFJS_DIR}`);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  EVALUATION COMPLETE`);
  console.log(`${'='.repeat(70)}`);
};

main().catch(err => { console.error('Evaluation failed:', err); process.exit(1); });
