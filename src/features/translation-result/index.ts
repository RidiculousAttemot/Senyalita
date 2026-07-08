import type { AnimationQueueItem } from "@/features/text-to-sign/animationQueue";

export type TranslationState =
  | "idle"
  | "typing"
  | "translating"
  | "generating-sign-sequence"
  | "animating"
  | "completed"
  | "error";

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  gloss: string[];
  gestures: AnimationQueueItem[];
  animationQueue: AnimationQueueItem[];
  language: string;
  confidence: number;
  error?: string;
}

export function createEmptyResult(): TranslationResult {
  return {
    originalText: "",
    translatedText: "",
    gloss: [],
    gestures: [],
    animationQueue: [],
    language: "en",
    confidence: 1,
  };
}
