import { normalizeInput, type NormalizedInput } from "./normalizer";
import { globalEngine } from "@/features/fsl-translation";
import type { FslTranslationResult } from "@/features/fsl-translation";

export interface GlossTranslation {
  original: string;
  gloss: string;
  confidence: number;
  strategy: "direct" | "synonym" | "related" | "fingerspelling";
}

export interface GlossResult {
  original: string;
  glossSequence: GlossTranslation[];
  language: string;
  intent: string;
  processingTimeMs: number;
  fslResult?: FslTranslationResult;
}

export function translateToGloss(input: NormalizedInput): GlossResult {
  const fslResult = globalEngine.translate(input.original, {
    useGrammar: true,
    useContext: false,
  });

  const glossSequence: GlossTranslation[] = fslResult.glossSequence.map((g) => ({
    original: g.original,
    gloss: g.gloss,
    confidence: g.resolution.confidence,
    strategy: g.resolution.strategy,
  }));

  return {
    original: input.original,
    glossSequence,
    language: fslResult.detectedLanguage.language,
    intent: fslResult.intent,
    processingTimeMs: fslResult.processingTimeMs,
    fslResult,
  };
}

export function getGlossConfidence(gloss: GlossTranslation[]): number {
  if (gloss.length === 0) return 0;
  const sum = gloss.reduce((acc, g) => acc + g.confidence, 0);
  return sum / gloss.length;
}
