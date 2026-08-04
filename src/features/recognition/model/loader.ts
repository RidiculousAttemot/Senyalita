/**
 * Selective TensorFlow.js imports, not the `@tensorflow/tfjs` union bundle.
 *
 * The union package pulls tfjs-converter and tfjs-data alongside core, layers
 * and every backend. Neither is reachable from this code: the model is a
 * LayersModel loaded from memory, so `loadGraphModel` and the whole data
 * pipeline API ship as dead weight. Measured on a clean production build, the
 * tfjs chunks were 1477 KB raw / 260 KB gzip.
 *
 * The two backend imports are side-effect registrations, not values — WebGL is
 * the fast path and CPU is the fallback for machines without a usable WebGL
 * context. Dropping the CPU one would make this fail outright rather than
 * degrade on those machines.
 */
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
import { loadLayersModel, type LayersModel } from "@tensorflow/tfjs-layers";
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

      const model = await loadLayersModel(tf.io.fromMemory(artifacts));

      const warmupInput = tf.zeros([1, 35, FEATURE_DIMENSION]);
      model.predict(warmupInput);
      tf.dispose(warmupInput);

      setCache({
        status: "ready",
        model,
        labels: labelsData.labels,
        error: null,
      });

      

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

/**
 * @param allowedLabels When given, the argmax and topK are taken over only
 * these classes. Omit it and every class competes, which is what /evaluation
 * needs to keep scoring all 131.
 *
 * This restricts rather than filters, and the difference is the whole point.
 * Dropping a prediction whose argmax falls outside the allowed set means the
 * UI shows nothing at all whenever the model prefers an out-of-scope class —
 * and with 95 phrase classes against 36 in scope, that is most noisy frames.
 * Constraining the argmax always yields the best allowed answer instead.
 */
const infer = async (
  features: Float32Array,
  allowedLabels?: ReadonlySet<string>,
): Promise<InferenceResult | null> => {
  const cache = getCache();
  if (cache.status !== "ready" || !cache.model) {
    return null;
  }

  try {
    const timesteps = features.length / FEATURE_DIMENSION;
    const input = tf.tensor3d(features, [1, timesteps, FEATURE_DIMENSION]);
    const output = (cache.model as LayersModel).predict(input) as tf.Tensor;
    const probabilities = await output.data();

    const probsArray = Array.from(probabilities);
    const isAllowed = (index: number) =>
      !allowedLabels || allowedLabels.has(cache.labels[index] ?? "");

    let labelId = -1;
    for (let i = 0; i < probsArray.length; i++) {
      if (!isAllowed(i)) continue;
      if (labelId < 0 || probsArray[i] > probsArray[labelId]) labelId = i;
    }
    // An allowed set naming nothing the model knows would leave no candidate;
    // fall back to the unrestricted argmax rather than return nothing.
    if (labelId < 0) {
      labelId = 0;
      for (let i = 1; i < probsArray.length; i++) {
        if (probsArray[i] > probsArray[labelId]) labelId = i;
      }
    }
    const confidence = probsArray[labelId];

    const indexed = probsArray
      .map((p, i) => ({ index: i, probability: p }))
      .filter((item) => isAllowed(item.index));
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
