import { normalizeLandmarks } from "@/features/recognition/normalize";
import { loadModel, infer } from "@/features/recognition/model/loader";
import { translateResult } from "@/features/recognition/translation";
import type { GestureAnimationAsset, AnimationFrame } from "@/features/sign-animation/types";

export interface GlossSuggestion {
  gloss: string;
  confidence: number;
}

export interface GlossSuggestionResult {
  suggested: GlossSuggestion;
  alternatives: GlossSuggestion[];
  modelLoaded: boolean;
  error?: string;
}

const TEMPORAL_STEPS = 35;
const FEATURE_DIMENSION = 126;

function extractFrameFeatures(frame: AnimationFrame): Float32Array | null {
  const leftHand = frame.landmarks.find((h) => h.side === "left")?.landmarks ?? null;
  const rightHand = frame.landmarks.find((h) => h.side === "right")?.landmarks ?? null;
  if (!leftHand && !rightHand) return null;
  return normalizeLandmarks(leftHand, rightHand);
}

function buildTemporalSample(frames: AnimationFrame[]): Float32Array | null {
  const features: Float32Array[] = [];
  for (const frame of frames) {
    const f = extractFrameFeatures(frame);
    if (f) features.push(f);
  }
  if (features.length < 5) return null;

  const available = Math.min(features.length, 45);
  const recent = features.slice(-available);
  const sampled = new Float32Array(TEMPORAL_STEPS * FEATURE_DIMENSION);

  for (let step = 0; step < TEMPORAL_STEPS; step++) {
    const frameIndex = Math.round((step * (available - 1)) / (TEMPORAL_STEPS - 1));
    const frame = recent[frameIndex];
    const destOffset = step * FEATURE_DIMENSION;
    for (let j = 0; j < FEATURE_DIMENSION; j++) {
      sampled[destOffset + j] = frame[j];
    }
  }
  return sampled;
}

export async function suggestGloss(asset: GestureAnimationAsset): Promise<GlossSuggestionResult> {
  try {
    await loadModel();
    const sample = buildTemporalSample(asset.frames);
    if (!sample) {
      return {
        suggested: { gloss: "UNKNOWN", confidence: 0 },
        alternatives: [],
        modelLoaded: true,
        error: "Not enough valid hand landmarks for inference",
      };
    }

    const result = await infer(sample);
    if (!result) {
      return {
        suggested: { gloss: "UNKNOWN", confidence: 0 },
        alternatives: [],
        modelLoaded: true,
        error: "Model inference returned no result",
      };
    }

    const translated = translateResult(result);
    return {
      suggested: { gloss: translated.label.toUpperCase(), confidence: translated.confidence },
      alternatives: translated.topK.slice(1).map((item) => ({
        gloss: item.label.toUpperCase(),
        confidence: item.confidence,
      })),
      modelLoaded: true,
    };
  } catch (err) {
    return {
      suggested: { gloss: "UNKNOWN", confidence: 0 },
      alternatives: [],
      modelLoaded: false,
      error: err instanceof Error ? err.message : "Inference failed",
    };
  }
}
