#!/usr/bin/env node
/**
 * Export FSL Alphabet BiLSTM v3 model to TensorFlow.js format
 *
 * Loads the v3 model.json (same architecture as v2, 26 output classes),
 * rebuilds the BiLSTM topology in tfjs, copies weights, validates the
 * output shape, and writes:
 *   - model.json  (topology + weights manifest)
 *   - weights.bin (flat weight data)
 *   - labels.json (label array)
 *
 * Usage: node scripts/export-fsl-alphabet-bilstm-v3-tfjs.mjs
 */

import fs from "fs";
import path from "path";
import * as tf from "@tensorflow/tfjs";

const INPUT_DIR = path.join(process.cwd(), "models", "fsl_alphabet", "bilstm_v3");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_alphabet", "bilstm_v3_tfjs");
const TEMPORAL_STEPS = 30;
const HIDDEN_SIZE = 32;
const COMBINED_SIZE = 64;
const FEATURE_DIMENSION = 126;
const OUTPUT_CLASSES = 26;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const main = async () => {
  console.log("Exporting BiLSTM v3 model to TensorFlow.js format");
  console.log(`Input:  ${INPUT_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  for (const file of ["model.json", "config.json", "labels.json"]) {
    const filePath = path.join(INPUT_DIR, file);
    if (!fs.existsSync(filePath)) throw new Error(`Missing required file: ${filePath}`);
  }

  const bilstmModel = readJson(path.join(INPUT_DIR, "model.json"));
  const labelsData = readJson(path.join(INPUT_DIR, "labels.json"));

  if (!Array.isArray(labelsData.labels) || labelsData.labels.length !== OUTPUT_CLASSES) {
    throw new Error(`Expected ${OUTPUT_CLASSES} labels, found ${labelsData.labels?.length}`);
  }

  const w = bilstmModel.weights;

  console.log(`Labels: ${labelsData.labels.length}`);
  console.log(`Hidden size: ${HIDDEN_SIZE} per direction, ${COMBINED_SIZE} combined`);

  const model = tf.sequential();

  model.add(tf.layers.bidirectional({
    layer: tf.layers.lstm({ units: HIDDEN_SIZE, returnSequences: false, recurrentActivation: "sigmoid" }),
    inputShape: [TEMPORAL_STEPS, FEATURE_DIMENSION],
    mergeMode: "concat"
  }));

  model.add(tf.layers.dropout({ rate: 0.2 }));

  model.add(tf.layers.dense({
    units: OUTPUT_CLASSES,
    activation: "softmax"
  }));

  const fwdKernel = tf.tensor2d(Float32Array.from(w.lstmFwd.wx), [FEATURE_DIMENSION, HIDDEN_SIZE * 4]);
  const fwdRecurrent = tf.tensor2d(Float32Array.from(w.lstmFwd.wh), [HIDDEN_SIZE, HIDDEN_SIZE * 4]);
  const fwdBias = tf.tensor1d(Float32Array.from(w.lstmFwd.b));
  const bwdKernel = tf.tensor2d(Float32Array.from(w.lstmBwd.wx), [FEATURE_DIMENSION, HIDDEN_SIZE * 4]);
  const bwdRecurrent = tf.tensor2d(Float32Array.from(w.lstmBwd.wh), [HIDDEN_SIZE, HIDDEN_SIZE * 4]);
  const bwdBias = tf.tensor1d(Float32Array.from(w.lstmBwd.b));

  model.layers[0].setWeights([fwdKernel, fwdRecurrent, fwdBias, bwdKernel, bwdRecurrent, bwdBias]);

  const wyTensor = tf.tensor2d(Float32Array.from(w.wy), [COMBINED_SIZE, OUTPUT_CLASSES]);
  const byTensor = tf.tensor1d(Float32Array.from(w.by));

  model.layers[2].setWeights([wyTensor, byTensor]);

  const dummyInput = tf.zeros([1, TEMPORAL_STEPS, FEATURE_DIMENSION]);
  const prediction = model.predict(dummyInput);
  const predShape = prediction.shape;
  const predicted = tf.argMax(prediction, 1).dataSync()[0];
  console.log(`Output shape: [${predShape.join(", ")}]`);
  console.log(`Sanity check - prediction on zeros: ${labelsData.labels[predicted]}`);
  if (predShape[predShape.length - 1] !== OUTPUT_CLASSES) {
    throw new Error(`Output shape mismatch: expected last dim ${OUTPUT_CLASSES}, got ${predShape[predShape.length - 1]}`);
  }
  tf.dispose([dummyInput, prediction]);

  ensureDir(OUTPUT_DIR);

  const weightNames = model.weights.map((w) => w.name);
  const weightTensors = model.getWeights();
  const weightSpecs = weightTensors.map((tensor, index) => ({
    name: weightNames[index],
    shape: tensor.shape,
    dtype: "float32"
  }));

  const weightDataBuffers = [];
  for (const tensor of weightTensors) {
    const data = await tensor.data();
    weightDataBuffers.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  }

  const modelJson = {
    modelTopology: model.toJSON(),
    format: "tfjs-graph-model",
    generatedBy: "fsl-alphabet-bilstm-v3-export",
    convertedAt: new Date().toISOString(),
    weightsManifest: [
      { paths: ["weights.bin"], weights: weightSpecs }
    ]
  };

  const allWeightData = Buffer.concat(weightDataBuffers);
  fs.writeFileSync(path.join(OUTPUT_DIR, "model.json"), JSON.stringify(modelJson, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, "weights.bin"), allWeightData);

  console.log(`Saved ${weightSpecs.length} weight groups (${allWeightData.length} bytes)`);
  weightSpecs.forEach((ws) => console.log(`  ${ws.name}: [${ws.shape.join(",")}]`));

  const labelsOut = { labels: labelsData.labels };
  fs.writeFileSync(path.join(OUTPUT_DIR, "labels.json"), JSON.stringify(labelsOut, null, 2));
  console.log("Labels saved");

  model.dispose();

  const outputFiles = fs.readdirSync(OUTPUT_DIR);
  console.log("Output files:", outputFiles.join(", "));
  console.log("BiLSTM v3 TFJS export complete.");
};

main().catch((error) => {
  console.error("Export failed:", error.stack || error.message);
  process.exit(1);
});
