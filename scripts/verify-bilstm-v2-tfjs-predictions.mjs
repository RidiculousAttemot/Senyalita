import fs from "fs";
import path from "path";
import * as tf from "@tensorflow/tfjs";

const DATA_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_v2");
const MODEL_DIR = path.join(process.cwd(), "models", "fsl_alphabet", "bilstm_v2_tfjs");
const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const TEMPORAL_STEPS = 30;
const TEST_SAMPLE_COUNT = 500;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const temporalFrameIndices = () => {
  return Array.from({ length: TEMPORAL_STEPS }, (_, index) =>
    Math.round((index * (SEQUENCE_LENGTH - 1)) / (TEMPORAL_STEPS - 1))
  );
};

const main = async () => {
  console.log("Verifying BiLSTM v2 TFJS export predictions...\n");

  const labelsData = readJson(path.join(DATA_DIR, "labels.json"));
  const labels = labelsData.labels;
  const testData = readJson(path.join(DATA_DIR, "test.json"));
  const frameIndices = temporalFrameIndices();

  console.log(`Labels (${labels.length}): ${labels.join(", ")}`);
  console.log(`Test samples available: ${testData.samples.length}`);

  const modelJson = readJson(path.join(MODEL_DIR, "model.json"));
  const modelTopology = JSON.parse(modelJson.modelTopology);
  const manifest = modelJson.weightsManifest[0];
  const weightSpecs = manifest.weights;
  const weightData = fs.readFileSync(path.join(MODEL_DIR, manifest.paths[0])).buffer;

  const model = await tf.loadLayersModel(tf.io.fromMemory({
    modelTopology,
    weightSpecs,
    weightData
  }));
  console.log("TFJS model loaded.\n");

  const testSamples = testData.samples.slice(0, TEST_SAMPLE_COUNT);
  let correct = 0;
  let total = 0;
  const confusionMatrix = Array.from({ length: labels.length }, () => new Array(labels.length).fill(0));

  for (const sample of testSamples) {
    const dense = new Float32Array(TEMPORAL_STEPS * FEATURE_DIMENSION);
    for (let step = 0; step < TEMPORAL_STEPS; step += 1) {
      const fi = frameIndices[step];
      const src = sample.sequence[fi];
      const destOff = step * FEATURE_DIMENSION;
      for (let j = 0; j < FEATURE_DIMENSION; j += 1) {
        dense[destOff + j] = src[j];
      }
    }

    const input = tf.tensor3d(dense, [1, TEMPORAL_STEPS, FEATURE_DIMENSION]);
    const output = model.predict(input);
    const probs = await output.data();
    const argmax = Array.from(probs).indexOf(Math.max(...Array.from(probs)));

    const expected = sample.labelId;
    confusionMatrix[expected][argmax] += 1;
    if (argmax === expected) correct += 1;
    total += 1;

    tf.dispose([input, output]);
  }

  const accuracy = correct / total;
  console.log(`Test samples evaluated: ${total}`);
  console.log(`Correct: ${correct}`);
  console.log(`Accuracy: ${(accuracy * 100).toFixed(2)}%\n`);

  const perLabel = {};
  for (let ci = 0; ci < labels.length; ci += 1) {
    const tp = confusionMatrix[ci][ci];
    let fp = 0, fn = 0, support = 0;
    for (let cj = 0; cj < labels.length; cj += 1) {
      if (cj !== ci) fp += confusionMatrix[cj][ci];
      if (cj !== ci) fn += confusionMatrix[ci][cj];
      support += confusionMatrix[ci][cj];
    }
    const prec = tp + fp === 0 ? 0 : tp / (tp + fp);
    const rec = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = prec + rec === 0 ? 0 : (2 * prec * rec) / (prec + rec);
    perLabel[labels[ci]] = { precision: prec, recall: rec, f1: f1, support };
    console.log(`  ${labels[ci].padEnd(3)} prec=${(prec * 100).toFixed(1)}% recall=${(rec * 100).toFixed(1)}% f1=${(f1 * 100).toFixed(1)}% (${support} samples)`);
  }

  console.log(`\nOverall accuracy: ${(accuracy * 100).toFixed(2)}%`);

  const mismatches = [];
  for (let ci = 0; ci < labels.length; ci += 1) {
    for (let cj = 0; cj < labels.length; cj += 1) {
      if (ci !== cj && confusionMatrix[ci][cj] > 0) {
        mismatches.push({ expected: labels[ci], predicted: labels[cj], count: confusionMatrix[ci][cj] });
      }
    }
  }
  mismatches.sort((a, b) => b.count - a.count);
  if (mismatches.length > 0) {
    console.log(`\nTop confusions:`);
    for (const m of mismatches.slice(0, 10)) {
      console.log(`  '${m.expected}' → '${m.predicted}': ${m.count}`);
    }
  }

  model.dispose();
};

main().catch((err) => {
  console.error("Verification failed:", err.message);
  process.exit(1);
});
