import fs from "fs";
import path from "path";
import * as tf from "@tensorflow/tfjs";

const MODEL_DIR = path.join(process.cwd(), "models", "fsl_alphabet", "bilstm_v2_tfjs");

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const main = async () => {
  console.log("=== BiLSTM v2 Runtime Verification ===\n");

  // Load model files
  const loadStart = performance.now();
  const modelJson = readJson(path.join(MODEL_DIR, "model.json"));
  const labelsData = readJson(path.join(MODEL_DIR, "labels.json"));

  const modelTopology = JSON.parse(modelJson.modelTopology);
  const weightSpecs = modelJson.weightsManifest[0].weights;
  const weightFile = path.join(MODEL_DIR, "weights.bin");
  const weightArrayBuffer = fs.readFileSync(weightFile).buffer;
  const weightData = new Uint8Array(weightArrayBuffer).buffer;

  const artifacts = { modelTopology, weightSpecs, weightData };
  const model = await tf.loadLayersModel(tf.io.fromMemory(artifacts));

  const loadEnd = performance.now();
  const loadTimeMs = (loadEnd - loadStart).toFixed(1);

  // Warmup
  const warmupInput = tf.zeros([1, 30, 126]);
  model.predict(warmupInput);
  tf.dispose(warmupInput);

  // Memory after load (rough estimate)
  const memBefore = process.memoryUsage();

  console.log(`Model loading time: ${loadTimeMs} ms`);
  console.log(`Weights: ${weightSpecs.length} groups`);
  console.log(`Labels: ${labelsData.labels.length}`);
  console.log(`Architecture: BiLSTM(32) → Dropout(0.2) → Dense(28)`);
  console.log(`Input shape: [1, 30, 126]`);
  console.log(`\n--- Inference Benchmark ---`);

  // Generate 100 synthetic inputs
  const NUM_RUNS = 100;
  const latencies = [];

  for (let i = 0; i < NUM_RUNS; i++) {
    const input = tf.randomNormal([1, 30, 126]);
    const start = performance.now();
    const output = model.predict(input);
    const _data = await output.data();
    const end = performance.now();
    latencies.push(end - start);
    tf.dispose([input, output]);
  }

  latencies.sort((a, b) => a - b);
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const median = latencies[Math.floor(latencies.length / 2)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  console.log(`Inference runs: ${NUM_RUNS}`);
  console.log(`Min inference time: ${min.toFixed(2)} ms`);
  console.log(`Max inference time: ${max.toFixed(2)} ms`);
  console.log(`Avg inference time: ${avg.toFixed(2)} ms`);
  console.log(`Median inference time: ${median.toFixed(2)} ms`);
  console.log(`P95 inference time: ${p95.toFixed(2)} ms`);

  // Theoretical FPS
  const avgFps = 1000 / avg;
  const worstFps = 1000 / p95;
  console.log(`\nEstimated FPS (avg latency): ${avgFps.toFixed(1)}`);
  console.log(`Estimated FPS (p95 latency): ${worstFps.toFixed(1)}`);

  // Memory after inference
  const memAfter = process.memoryUsage();
  const heapUsed = ((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(1);
  const rssDiff = ((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(1);
  console.log(`\n--- Memory ---`);
  console.log(`RSS delta: ${rssDiff} MB`);
  console.log(`Heap used delta: ${heapUsed} MB`);
  console.log(`Total heap: ${(memAfter.heapTotal / 1024 / 1024).toFixed(1)} MB`);

  // Process-based memory (Node.js)
  console.log(`Process RSS: ${(memAfter.rss / 1024 / 1024).toFixed(1)} MB`);

  model.dispose();
  console.log(`\n=== Runtime Verification Complete ===`);
};

main().catch((err) => {
  console.error("Runtime verification failed:", err.message);
  process.exit(1);
});
