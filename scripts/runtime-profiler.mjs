import fs from "fs";
import path from "path";
import * as tf from "@tensorflow/tfjs";
import { fileURLToPath } from "url";

const ROOT = process.cwd();
const MODEL_DIR = path.join(ROOT, "public", "models", "fsl_unified", "bilstm_tfjs");
const DOCS_DIR = path.join(ROOT, "docs");

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, "utf8"));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const TEMPORAL_STEPS = 30;
const FEATURE_DIM = 126;
const NUM_WARMUP = 10;
const NUM_ITERATIONS = 100;

const formatBytes = (b) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`;

function loadModelFromFiles(modelDir) {
  const modelJson = readJson(path.join(modelDir, "model.json"));
  const weightData = fs.readFileSync(path.join(modelDir, "weights.bin"));

  const topo = JSON.parse(modelJson.modelTopology);
  const weightSpecs = modelJson.weightsManifest[0].weights;
  const artifacts = {
    modelTopology: topo,
    weightSpecs,
    weightData: new Uint8Array(weightData).buffer,
    format: "layers-model",
    generatedBy: "unified-bilstm-export",
    convertedAt: new Date().toISOString(),
  };
  return tf.loadLayersModel(tf.io.fromMemory(artifacts));
}

async function main() {
  console.log("=== Runtime Profiler ===");

  // 1. Memory baseline
  const memBefore = process.memoryUsage();

  // 2. Model load time
  const modelJson = readJson(path.join(MODEL_DIR, "model.json"));
  const weightBin = fs.readFileSync(path.join(MODEL_DIR, "weights.bin"));

  const loadStart = performance.now();
  const model = await loadModelFromFiles(MODEL_DIR);
  const loadTime = performance.now() - loadStart;
  console.log(`Model load: ${loadTime.toFixed(1)}ms`);

  // 3. Model size
  console.log(`Model size: ${formatBytes(weightBin.length)} (weights) + ${formatBytes(JSON.stringify(modelJson).length)} (JSON)`);

  // 4. Warmup
  const warmupInput = tf.zeros([1, TEMPORAL_STEPS, FEATURE_DIM]);
  for (let i = 0; i < NUM_WARMUP; i++) {
    model.predict(warmupInput);
  }
  tf.dispose(warmupInput);
  console.log(`Warmup: ${NUM_WARMUP} runs`);

  // 5. Inference time measurement
  const dummyInput = tf.randomNormal([1, TEMPORAL_STEPS, FEATURE_DIM]);
  const times = [];
  for (let i = 0; i < NUM_ITERATIONS; i++) {
    const start = performance.now();
    const result = model.predict(dummyInput);
    const elapsed = performance.now() - start;
    times.push(elapsed);
    tf.dispose(result);
  }
  tf.dispose(dummyInput);

  times.sort((a, b) => a - b);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const medianTime = times[Math.floor(times.length / 2)];
  const p99Time = times[Math.floor(times.length * 0.99)];
  const minTime = times[0];
  const maxTime = times[times.length - 1];

  // 6. Memory after inference
  const memAfter = process.memoryUsage();
  const tensorCount = tf.memory().numTensors;
  const memoryMB = tf.memory().numBytes / 1048576;

  // 7. Memory allocation tracking
  const allocStart = process.memoryUsage();
  for (let i = 0; i < 50; i++) {
    const inp = tf.randomNormal([1, TEMPORAL_STEPS, FEATURE_DIM]);
    const r = model.predict(inp);
    const data = r.dataSync();
    tf.dispose([inp, r]);
  }
  const allocEnd = process.memoryUsage();
  const allocDelta = allocEnd.heapUsed - allocStart.heapUsed;

  model.dispose();

  // Report
  const modelSizeBytes = weightBin.length + Buffer.byteLength(JSON.stringify(modelJson), "utf8");
  const fps = avgTime > 0 ? (1000 / avgTime) : 0;

  const report = {
    profiled: new Date().toISOString(),
    model: "BiLSTM v1 (TFJS)",
    modelPath: MODEL_DIR,
    loadTimeMs: Math.round(loadTime),
    inferenceMs: {
      mean: Number(avgTime.toFixed(2)),
      median: Number(medianTime.toFixed(2)),
      min: Number(minTime.toFixed(2)),
      max: Number(maxTime.toFixed(2)),
      p99: Number(p99Time.toFixed(2)),
      stdDev: Number(Math.sqrt(times.reduce((s, t) => s + (t - avgTime) ** 2, 0) / times.length).toFixed(2)),
    },
    fps: Number(fps.toFixed(1)),
    memory: {
      heapUsedBeforeMB: Number((memBefore.heapUsed / 1048576).toFixed(1)),
      heapUsedAfterMB: Number((memAfter.heapUsed / 1048576).toFixed(1)),
      heapTotalMB: Number((memAfter.heapTotal / 1048576).toFixed(1)),
      tensorMemoryMB: Number(memoryMB.toFixed(1)),
      tensorCount,
      allocPerIterationKB: Number((allocDelta / 50 / 1024).toFixed(1)),
    },
    modelSize: {
      jsonSizeKB: Number((JSON.stringify(modelJson).length / 1024).toFixed(1)),
      weightsSizeKB: Number((weightBin.length / 1024).toFixed(1)),
      totalKB: Number((modelSizeBytes / 1024).toFixed(1)),
    },
  };

  const target = {
    firstPredictionMs: 250,
    stablePredictionMs: 500,
    targetFps: 30,
    targetMemoryMB: 150,
  };

  const met = {
    firstPrediction: loadTime + avgTime < target.firstPredictionMs,
    stablePrediction: avgTime * 10 < target.stablePredictionMs,
    fps: fps >= target.targetFps,
    memory: memAfter.heapUsed / 1048576 < target.targetMemoryMB,
  };

  const doc = `# Runtime Optimization Report

Generated: ${report.profiled.split("T")[0]}

## Executive Summary

| Metric | Measured | Target | Status |
|--------|:--------:|:------:|:------:|
| Load time | ${report.loadTimeMs}ms | < ${target.firstPredictionMs}ms | ${met.firstPrediction ? '✅' : '❌'} |
| Stable prediction | ${(report.inferenceMs.mean * 10).toFixed(0)}ms (per 10 inferences) | < ${target.stablePredictionMs}ms | ${met.stablePrediction ? '✅' : '❌'} |
| FPS | ${report.fps} | >= ${target.targetFps} | ${met.fps ? '✅' : '❌'} |
| Memory | ${report.memory.heapUsedAfterMB}MB | < ${target.targetMemoryMB}MB | ${met.memory ? '✅' : '❌'} |

## Model Details

| Property | Value |
|----------|-------|
| Model | ${report.model} |
| Format | TensorFlow.js graph model |
| JSON size | ${report.modelSize.jsonSizeKB}KB |
| Weights size | ${report.modelSize.weightsSizeKB}KB |
| Total size | ${report.modelSize.totalKB}KB |

## Inference Latency

| Metric | Value |
|--------|:-----:|
| Mean | ${report.inferenceMs.mean}ms |
| Median | ${report.inferenceMs.median}ms |
| Min | ${report.inferenceMs.min}ms |
| Max | ${report.inferenceMs.max}ms |
| P99 | ${report.inferenceMs.p99}ms |
| Std Dev | ${report.inferenceMs.stdDev}ms |
| FPS | ${report.fps} |

## Memory Profile

| Metric | Value |
|--------|:-----:|
| Heap (before) | ${report.memory.heapUsedBeforeMB}MB |
| Heap (after) | ${report.memory.heapUsedAfterMB}MB |
| Heap total | ${report.memory.heapTotalMB}MB |
| Tensor memory | ${report.memory.tensorMemoryMB}MB |
| Active tensors | ${report.memory.tensorCount} |
| Allocation per inference | ${report.memory.allocPerIterationKB}KB |

## Optimization Opportunities

| Area | Current | Target | Gap |
|------|:-------:|:------:|:---:|
| Load time | ${report.loadTimeMs}ms | ${target.firstPredictionMs}ms | ${report.loadTimeMs > target.firstPredictionMs ? (report.loadTimeMs - target.firstPredictionMs)+'ms over' : 'Within target'} |
| Inference | ${report.inferenceMs.mean}ms | < 10ms | ${report.inferenceMs.mean > 10 ? (report.inferenceMs.mean - 10).toFixed(1)+'ms over' : 'Within target'} |
| FPS | ${report.fps} | ${target.targetFps} | ${report.fps < target.targetFps ? (target.targetFps - report.fps).toFixed(1)+' below' : 'Within target'} |

## Recommendations

${!met.firstPrediction ? '- **Model loading**: Consider lazy loading or smaller model format\n' : ''}${!met.stablePrediction ? '- **Inference speed**: Model quantization or smaller architecture needed\n' : ''}${!met.fps ? '- **FPS**: Frame pipeline optimization needed\n' : ''}${!met.memory ? '- **Memory**: Manage tensor disposal more aggressively\n' : ''}
`;

  fs.writeFileSync(path.join(DOCS_DIR, "runtime-optimization-report.md"), doc);
  console.log(`\nRuntime profile: avg ${report.inferenceMs.mean}ms (${report.fps} FPS)`);
  console.log(`Memory: ${report.memory.heapUsedAfterMB}MB heap, ${report.memory.tensorMemoryMB}MB tensors`);
  console.log(`Report: docs/runtime-optimization-report.md`);
}

main().catch(console.error);
