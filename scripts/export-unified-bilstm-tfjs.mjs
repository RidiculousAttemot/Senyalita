import fs from "fs";
import path from "path";
import * as tf from "@tensorflow/tfjs";

const INPUT_DIR = path.join(process.cwd(), "models", "fsl_unified", "bilstm_v4");
const OUTPUT_DIR = path.join(process.cwd(), "public", "models", "fsl_unified", "bilstm_tfjs");
const FEATURE_DIMENSION = 126;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const ensureDir = (dirPath) => { if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true }); };

const main = async () => {
  console.log("Exporting Unified BiLSTM model to TensorFlow.js format");

  const bilstmModel = readJson(path.join(INPUT_DIR, "model.json"));
  const config = readJson(path.join(INPUT_DIR, "config.json"));
  const labelsData = readJson(path.join(INPUT_DIR, "labels.json"));
  const w = bilstmModel.weights;

  const HIDDEN_SIZE = config.architecture.recurrentLayers[0].hiddenSize;
  const TEMPORAL_STEPS = config.architecture.recurrentLayers[0].temporalSteps;
  const COMBINED_SIZE = config.architecture.combinedSize;
  const OUTPUT_CLASSES = config.architecture.classifier.outputClasses;

  console.log(`Labels: ${OUTPUT_CLASSES} (${labelsData.labels.slice(0,5).join(",")}...${labelsData.labels.slice(-3).join(",")})`);
  console.log(`Hidden size: ${HIDDEN_SIZE} per direction, ${COMBINED_SIZE} combined`);

  const model = tf.sequential();

  model.add(tf.layers.bidirectional({
    layer: tf.layers.lstm({ units: HIDDEN_SIZE, returnSequences: false, recurrentActivation: "sigmoid" }),
    inputShape: [TEMPORAL_STEPS, FEATURE_DIMENSION],
    mergeMode: "concat"
  }));

  const DROPOUT_RATE = config.architecture.recurrentLayers[0].dropout ?? 0.25;
  model.add(tf.layers.dropout({ rate: DROPOUT_RATE }));

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
  const predicted = tf.argMax(prediction, 1).dataSync()[0];
  console.log(`Sanity check - prediction on zeros: index ${predicted}`);
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
    generatedBy: "unified-bilstm-export",
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
  console.log(`Labels saved (${labelsData.labels.length} classes)`);

  model.dispose();

  const outputFiles = fs.readdirSync(OUTPUT_DIR);
  console.log("Output files:", outputFiles.join(", "));
  console.log("Unified BiLSTM TFJS export complete.");
};

main().catch((error) => {
  console.error("Export failed:", error.message);
  process.exit(1);
});
