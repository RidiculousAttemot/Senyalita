import type { InferenceResult } from "./model";
import type { MotionState, GesturePhase } from "./motionDetection";

const ALPHABET_LABELS = new Set([
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "ñ", "ng", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
]);

const PHRASE_LABELS = new Set([
  "good morning", "good afternoon", "good evening", "hello", "how are you",
  "im fine", "nice to meet you", "thank you", "youre welcome", "see you tomorrow",
  "understand", "don't understand", "know", "don't know",
  "no", "yes", "wrong", "correct", "slow", "fast",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "today", "tomorrow", "yesterday",
  "father", "mother", "son", "daughter", "grandfather", "grandmother",
  "uncle", "auntie", "cousin", "parents", "boy", "girl", "man", "woman",
  "deaf", "hard of hearing", "wheelchair person", "blind", "deaf blind", "married",
  "blue", "green", "red", "brown", "black", "white", "yellow", "orange",
  "gray", "pink", "violet", "light", "dark",
  "bread", "egg", "fish", "meat", "chicken", "spaghetti", "rice",
  "longanisa", "shrimp", "crab",
  "hot", "cold", "juice", "milk", "coffee", "tea", "beer", "wine", "sugar", "no sugar",
  "sorry", "please", "help", "goodbye", "love", "happy", "sad", "beautiful",
  "baptism", "birthday", "christmas", "feast", "graduation", "wedding",
  "what", "who", "where", "when", "why", "how much", "how many",
  "bathroom", "hospital", "school", "church", "market", "store", "house",
  "water", "fire", "earthquake", "flood", "typhoon",
  "sleep", "eat", "drink", "walk", "run", "sit", "stand", "pray",
  "baby", "teacher", "student", "doctor", "nurse", "police", "friend",
  "good", "bad", "big", "small", "new", "old",
  "hungry", "thirsty", "tired", "sick", "healthy",
  "again", "always", "never", "sometimes", "now", "later",
  "come here", "go there", "look", "listen", "speak", "sign",
  "fsl", "filipino sign language", "interpreter",
]);

export type PriorityOverride = {
  originalLabel: string;
  overriddenLabel: string;
  reason: string;
};

export class RecognitionPriorityManager {
  private lastOverride: PriorityOverride | null = null;

  reset(): void {
    this.lastOverride = null;
  }

  getLastOverride(): PriorityOverride | null {
    return this.lastOverride;
  }

  applyPriority(
    result: InferenceResult,
    motionState: MotionState,
    gesturePhase: GesturePhase,
    frameCount: number
  ): InferenceResult {
    const labelLower = result.label.toLowerCase();
    const isAlphabet = ALPHABET_LABELS.has(labelLower);
    const isPhrase = PHRASE_LABELS.has(labelLower);

    if (!isAlphabet && !isPhrase) {
      return result;
    }

    const isGestureActive = motionState === "gesturing" || gesturePhase !== "none";
    const hasEnoughFrames = frameCount >= 12;
    const lowMargin = result.confidence < 0.75;

    if (isAlphabet && isGestureActive && hasEnoughFrames) {
      const topPhrase = result.topK.find(
        (k) => PHRASE_LABELS.has(k.label.toLowerCase()) && k.confidence > 0.2
      );
      if (topPhrase) {
        this.lastOverride = {
          originalLabel: result.label,
          overriddenLabel: topPhrase.label,
          reason: `phrase_priority: motion_active+${frameCount}frames`,
        };
        return { ...result, label: topPhrase.label, confidence: topPhrase.confidence };
      }
    }

    if (isPhrase && !isGestureActive && hasEnoughFrames && lowMargin) {
      const topAlpha = result.topK.find(
        (k) => ALPHABET_LABELS.has(k.label.toLowerCase()) && k.confidence > 0.3
      );
      if (topAlpha) {
        this.lastOverride = {
          originalLabel: result.label,
          overriddenLabel: topAlpha.label,
          reason: `alphabet_fallback: low_phrase_confidence`,
        };
        return { ...result, label: topAlpha.label, confidence: topAlpha.confidence };
      }
    }

    return result;
  }
}
