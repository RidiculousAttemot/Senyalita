import * as tf from "@tensorflow/tfjs";
import { InferenceResult, ModelLoadResult } from "./types";

const MODEL_URL = "/models/fsl_alphabet/bilstm_v2_tfjs/model.json";
const LABELS_URL = "/models/fsl_alphabet/bilstm_v2_tfjs/labels.json";

type Loadable = {
  status: "loading" | "ready" | "error";
  model: tf.LayersModel | null;
  labels: string[];
  error: string | null;
};

let cache: Loadable = {
  status: "loading",
  model: null,
  labels: [],
  error: null
};

let loadPromise: Promise<Loadable> | null = null;

const loadModel = async (): Promise<Loadable> => {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const [modelResponse, labelsResponse] = await Promise.all([
        fetch(MODEL_URL),
        fetch(LABELS_URL)
      ]);

      if (!modelResponse.ok || !labelsResponse.ok) {
        throw new Error(
          `Failed to fetch model files (${modelResponse.status}, ${labelsResponse.status})`
        );
      }

      const modelJson = await modelResponse.json();
      const labelsData = await labelsResponse.json();

      if (!labelsData.labels || !Array.isArray(labelsData.labels)) {
        throw new Error("Invalid labels.json format");
      }

      const modelTopology = JSON.parse(modelJson.modelTopology);
      const weightSpecs = modelJson.weightsManifest[0].weights;
      const weightsUrl = `${MODEL_URL.replace("model.json", "")}${weightSpecs[0].paths[0]}`;

      const weightsResponse = await fetch(weightsUrl);
      if (!weightsResponse.ok) {
        throw new Error(`Failed to fetch weights (${weightsResponse.status})`);
      }

      const weightArrayBuffer = await weightsResponse.arrayBuffer();
      const weightData = new Uint8Array(weightArrayBuffer).buffer;

      const artifacts: tf.io.ModelArtifacts = {
        modelTopology,
        weightSpecs,
        weightData
      };

      const model = await tf.loadLayersModel(tf.io.fromMemory(artifacts));

      const warmupInput = tf.zeros([1, 30, 126]);
      model.predict(warmupInput);
      tf.dispose(warmupInput);

      cache = {
        status: "ready",
        model,
        labels: labelsData.labels,
        error: null
      };

      return cache;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown model load error";
      cache = { status: "error", model: null, labels: [], error: message };
      return cache;
    }
  })();

  return loadPromise;
};

const getCachedResult = (): ModelLoadResult => {
  return {
    status: cache.status,
    error: cache.error ?? undefined
  };
};

const infer = async (features: Float32Array): Promise<InferenceResult | null> => {
  if (cache.status !== "ready" || !cache.model) {
    return null;
  }

  try {
    const input = tf.tensor3d(features, [1, 30, 126]);
    const output = cache.model.predict(input) as tf.Tensor;
    const probabilities = await output.data();

    const probsArray = Array.from(probabilities);
    const labelId = probsArray.indexOf(Math.max(...probsArray));
    const confidence = probsArray[labelId];

    const indexed = probsArray.map((p, i) => ({ index: i, probability: p }));
    indexed.sort((a, b) => b.probability - a.probability);
    const topK = indexed.slice(0, 3).map((item) => ({
      label: cache.labels[item.index] ?? "?",
      confidence: item.probability
    }));

    const result: InferenceResult = {
      label: cache.labels[labelId] ?? "?",
      labelId,
      confidence,
      topK
    };

    tf.dispose([input, output]);
    return result;
  } catch (err) {
    return null;
  }
};

export { loadModel, getCachedResult, infer };
