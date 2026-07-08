import * as tf from "@tensorflow/tfjs";
import { InferenceResult } from "./types";
import { getCache, setCache, getCachedResult } from "./cache";
export { getCachedResult };

const MODEL_URL = "/models/fsl_unified/bilstm_tfjs/model.json";
const LABELS_URL = "/models/fsl_unified/bilstm_tfjs/labels.json";
const FEATURE_DIMENSION = 126;

let loadPromise: Promise<boolean> | null = null;

const loadModel = async (): Promise<boolean> => {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const [modelResponse, labelsResponse] = await Promise.all([
        fetch(MODEL_URL),
        fetch(LABELS_URL),
      ]);

      if (!modelResponse.ok || !labelsResponse.ok) {
        throw new Error(
          `Failed to fetch model files (${modelResponse.status}, ${labelsResponse.status})`,
        );
      }

      const modelJson = await modelResponse.json();
      const labelsData = await labelsResponse.json();

      if (!labelsData.labels || !Array.isArray(labelsData.labels)) {
        throw new Error("Invalid labels.json format");
      }

      const modelTopology = JSON.parse(modelJson.modelTopology);
      const manifest = modelJson.weightsManifest[0];
      const weightSpecs = manifest.weights;
      const weightsUrl = `${MODEL_URL.replace("model.json", "")}${manifest.paths[0]}`;

      const weightsResponse = await fetch(weightsUrl);
      if (!weightsResponse.ok) {
        throw new Error(`Failed to fetch weights (${weightsResponse.status})`);
      }

      const weightArrayBuffer = await weightsResponse.arrayBuffer();
      const weightData = new Uint8Array(weightArrayBuffer).buffer;

      const artifacts: tf.io.ModelArtifacts = {
        modelTopology,
        weightSpecs,
        weightData,
      };

      const model = await tf.loadLayersModel(tf.io.fromMemory(artifacts));

      const warmupInput = tf.zeros([1, 35, FEATURE_DIMENSION]);
      model.predict(warmupInput);
      tf.dispose(warmupInput);

      setCache({
        status: "ready",
        model,
        labels: labelsData.labels,
        error: null,
      });

      console.log(
        `[ModelLoader] Ready | version: bilstm_v4 | path: ${MODEL_URL} | classes: ${labelsData.labels.length} | input: [1,35,${FEATURE_DIMENSION}]`
      );

      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown model load error";
      setCache({ status: "error", error: message });
      return false;
    }
  })();

  return loadPromise;
};

const infer = async (features: Float32Array): Promise<InferenceResult | null> => {
  const cache = getCache();
  if (cache.status !== "ready" || !cache.model) {
    return null;
  }

  try {
    const timesteps = features.length / FEATURE_DIMENSION;
    const input = tf.tensor3d(features, [1, timesteps, FEATURE_DIMENSION]);
    const output = (cache.model as tf.LayersModel).predict(input) as tf.Tensor;
    const probabilities = await output.data();

    const probsArray = Array.from(probabilities);
    let labelId = 0;
    for (let i = 1; i < probsArray.length; i++) {
      if (probsArray[i] > probsArray[labelId]) labelId = i;
    }
    const confidence = probsArray[labelId];

    const indexed = probsArray.map((p, i) => ({ index: i, probability: p }));
    indexed.sort((a, b) => b.probability - a.probability);
    const topK = indexed.slice(0, 5).map((item) => ({
      label: cache.labels[item.index] ?? "?",
      confidence: item.probability,
    }));

    const result: InferenceResult = {
      label: cache.labels[labelId] ?? "?",
      labelId,
      confidence,
      topK,
    };

    tf.dispose([input, output]);
    return result;
  } catch {
    return null;
  }
};

export { loadModel, infer };
