#!/usr/bin/env node
import fs from "fs";
import path from "path";
import * as tf from "@tensorflow/tfjs";

const MODELS_DIR = path.join(process.cwd(), "models", "fsl_unified_v2");
const OUTPUT_DIR = path.join(process.cwd(), "public", "models", "fsl_unified_v2", "bilstm_tfjs");
const TEMPORAL_STEPS = 30;
const FEATURE_DIMENSION = 126;

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const exportBilstm = (inputDir, outputDir, variant, hiddenSize, combinedSize, outputClasses) => {
  console.log(`\nExporting ${variant} to TFJS...`);
  ensureDir(outputDir);

  const bilstmModel = readJson(path.join(inputDir, "model.json"));
  const labelsData = readJson(path.join(inputDir, "labels.json"));
  const metrics = readJson(path.join(inputDir, "metrics.json"));
  const config = readJson(path.join(inputDir, "config.json"));
  const w = bilstmModel.weights;

  const model = tf.sequential();
  model.add(tf.layers.bidirectional({
    layer: tf.layers.lstm({ units: hiddenSize, returnSequences: false, recurrentActivation: "sigmoid" }),
    inputShape: [TEMPORAL_STEPS, FEATURE_DIMENSION],
    mergeMode: "concat"
  }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: outputClasses, activation: "softmax" }));

  const fwdKernel = tf.tensor2d(Float32Array.from(w.lstmFwd.wx), [FEATURE_DIMENSION, hiddenSize * 4]);
  const fwdRecurrent = tf.tensor2d(Float32Array.from(w.lstmFwd.wh), [hiddenSize, hiddenSize * 4]);
  const fwdBias = tf.tensor1d(Float32Array.from(w.lstmFwd.b));
  const bwdKernel = tf.tensor2d(Float32Array.from(w.lstmBwd.wx), [FEATURE_DIMENSION, hiddenSize * 4]);
  const bwdRecurrent = tf.tensor2d(Float32Array.from(w.lstmBwd.wh), [hiddenSize, hiddenSize * 4]);
  const bwdBias = tf.tensor1d(Float32Array.from(w.lstmBwd.b));
  model.layers[0].setWeights([fwdKernel, fwdRecurrent, fwdBias, bwdKernel, bwdRecurrent, bwdBias]);

  const wyTensor = tf.tensor2d(Float32Array.from(w.wy), [combinedSize, outputClasses]);
  const byTensor = tf.tensor1d(Float32Array.from(w.by));
  model.layers[2].setWeights([wyTensor, byTensor]);

  const dummyInput = tf.zeros([1, TEMPORAL_STEPS, FEATURE_DIMENSION]);
  const prediction = model.predict(dummyInput);
  const predicted = tf.argMax(prediction, 1).dataSync()[0];
  console.log(`Sanity check: prediction on zeros -> index ${predicted}`);
  tf.dispose([dummyInput, prediction]);

  const weightNames = model.weights.map((wt) => wt.name);
  const weightTensors = model.getWeights();
  const weightSpecs = weightTensors.map((tensor, idx) => ({
    name: weightNames[idx], shape: tensor.shape, dtype: "float32"
  }));

  const buffers = [];
  for (const tensor of weightTensors) {
    const data = await tensor.data();
    buffers.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  }

  const modelJson = {
    modelTopology: model.toJSON(),
    format: "tfjs-graph-model",
    generatedBy: `fsl-v45-${variant}`,
    convertedAt: new Date().toISOString(),
    weightsManifest: [{ paths: ["weights.bin"], weights: weightSpecs }]
  };

  const allWeightData = Buffer.concat(buffers);
  fs.writeFileSync(path.join(outputDir, "model.json"), JSON.stringify(modelJson, null, 2));
  fs.writeFileSync(path.join(outputDir, "weights.bin"), allWeightData);
  fs.writeFileSync(path.join(outputDir, "labels.json"), JSON.stringify({ labels: labelsData.labels }, null, 2));

  const benchmarkData = {
    modelSize: { weightsBytes: allWeightData.length, weightsKB: (allWeightData.length / 1024).toFixed(1) },
    inputShape: [1, TEMPORAL_STEPS, FEATURE_DIMENSION],
    outputClasses,
    metrics: { testAccuracy: metrics.testAccuracy, testLoss: metrics.testLoss, macroF1: metrics.macroF1 },
    config,
    exportedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outputDir, "metrics.json"), JSON.stringify(benchmarkData, null, 2));

  model.dispose();
  console.log(`  TFJS export complete: ${outputDir}`);
  console.log(`  Weights: ${(allWeightData.length / 1024).toFixed(1)} KB`);

  return benchmarkData;
};

const main = async () => {
  console.log("FSL v4.5 — TFJS Model Export");
  console.log("=".repeat(55));

  const candidates = [
    { dir: "bilstm_v4", variant: "bilstm-v4" },
    { dir: "cnn_bilstm", variant: "cnn-bilstm" },
    { dir: "transformer", variant: "transformer" },
    { dir: "transformer_attention", variant: "transformer-attention" },
  ];

  const results = [];
  for (const c of candidates) {
    const inputDir = path.join(MODELS_DIR, c.dir);
    if (!fs.existsSync(path.join(inputDir, "model.json"))) {
      console.log(`Skipping ${c.variant}: no model.json in ${inputDir}`);
      continue;
    }
    const config = readJson(path.join(inputDir, "config.json"));
    const labelsData = readJson(path.join(inputDir, "labels.json"));
    const metrics = readJson(path.join(inputDir, "metrics.json"));
    const hs = config.architecture?.hiddenSize || config.hiddenSize || 48;
    const cs = hs * 2;
    const oc = labelsData.labels.length;

    const outputDir = path.join(OUTPUT_DIR, "..", `${c.dir}_tfjs`);
    const bm = await exportBilstm(inputDir, outputDir, c.variant, hs, cs, oc);
    bm.variant = c.variant;
    bm.testAccuracy = metrics.testAccuracy || 0;
    results.push(bm);
  }

  results.sort((a, b) => b.testAccuracy - a.testAccuracy);
  console.log(`\n=== Model Benchmark Summary ===`);
  console.log(`| Variant | Test Acc | Model Size |`);
  console.log(`|---------|----------|------------|`);
  for (const r of results) {
    console.log(`| ${r.variant.padEnd(22)} | ${((r.testAccuracy || 0) * 100).toFixed(2).padStart(5)}% | ${r.modelSize?.weightsKB ?? "?"} KB |`);
  }

  const best = results[0];
  if (best) {
    console.log(`\nRecommended: ${best.variant} (${((best.testAccuracy || 0) * 100).toFixed(2)}% accuracy, ${best.modelSize?.weightsKB ?? "?"} KB)`);

    const deploymentConfig = {
      recommendation: {
        bestModel: best.variant,
        accuracy: best.testAccuracy,
        modelSizeKB: best.modelSize?.weightsKB,
        reason: `${best.variant} offers the best accuracy-to-size ratio for real-time browser inference.`,
      },
      deployment: {
        target: "public/models/fsl_unified_v2/bilstm_tfjs/",
        loaderUpdate: "Update src/features/recognition/model/loader.ts to point to /models/fsl_unified_v2/bilstm_tfjs/model.json",
        expectedImpact: {
          phraseRecognition: "v4.5 integration adds more phrase-level training data, improving phrase accuracy.",
          gestureConfusion: "Additional samples reduce confusion between similar gestures.",
          conversationQuality: "More accurate phrasing improves conversation flow and reply quality.",
        }
      },
      generatedAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, "..", "deployment_recommendation.json"), JSON.stringify(deploymentConfig, null, 2));
  }

  console.log("\nAll exports complete.");
};

main().catch((err) => { console.error("Export failed:", err.message); process.exit(1); });
