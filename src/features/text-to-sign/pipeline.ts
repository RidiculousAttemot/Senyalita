import { normalizeInput } from "./normalizer";
import type { NormalizedInput } from "./normalizer";
import { translateToGloss } from "./glossTranslator";
import type { GlossResult, GlossTranslation } from "./glossTranslator";
import { buildSequence } from "./animationSequencer";
import type { SequencedItem } from "./animationSequencer";
import { PauseEngine } from "./pauseEngine";
import { buildAnimationQueue } from "./animationQueue";
import type { AnimationQueueItem } from "./animationQueue";
import { GESTURE_ANIMATIONS, getAnimation } from "@/features/animation/gestureAnimations";
import type { GestureAnimation } from "@/features/animation/types";
import { globalEngine } from "@/features/fsl-translation";

export interface PipelineResult {
  input: string;
  normalized: NormalizedInput;
  gloss: GlossResult;
  sequence: SequencedItem[];
  animations: AnimationQueueItem[];
  totalDuration: number;
  overallConfidence: number;
}

export interface PipelineOptions {
  useGrammar?: boolean;
  useContext?: boolean;
  phraseMerge?: boolean;
}

export function runPipeline(
  input: string,
  options?: PipelineOptions,
): PipelineResult {
  const normalized = normalizeInput(input);
  const gloss = translateToGloss(normalized);

  const opts = {
    useGrammar: true,
    useContext: false,
    phraseMerge: true,
    ...options,
  };

  globalEngine.clearContext();
  const fslResult = globalEngine.translate(input, {
    useGrammar: opts.useGrammar,
    useContext: opts.useContext,
  });

  const sequence = buildSequence(gloss.glossSequence, input, {
    phraseMerge: opts.phraseMerge,
  });

  const animations = buildAnimationQueue(gloss, sequence);

  const pauseEngine = new PauseEngine();
  const totalDuration = sequence.reduce(
    (sum, item) => {
      if (item.isPause) return sum + item.pauseDuration;
      if (item.animation) return sum + item.animation.duration;
      return sum + 1.0;
    },
    0,
  );

  const overallConfidence = computeOverallConfidence(gloss.glossSequence);

  return {
    input,
    normalized,
    gloss,
    sequence,
    animations,
    totalDuration,
    overallConfidence,
  };
}

function computeOverallConfidence(glossSequence: GlossTranslation[]): number {
  if (glossSequence.length === 0) return 0;
  const sum = glossSequence.reduce((acc, g) => acc + g.confidence, 0);
  return Math.round((sum / glossSequence.length) * 100) / 100;
}

export function preloadAnimations(glossResult: GlossResult): void {
  for (const item of glossResult.glossSequence) {
    getAnimation(item.gloss);
  }
}
