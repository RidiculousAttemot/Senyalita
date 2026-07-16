import { WORD_TO_GLOSS, GLOSS_SYNONYM_NORMALIZATION, GESTURE_CATEGORIES } from "./glossDictionary";
import type { AnimationClip } from "@/features/animation/types";

export interface GestureMappingResult {
  gloss: string;
  category: string;
  animation: null;
  hasAnimation: false;
  isFingerSpelling: boolean;
  label: string;
}

const ALPHABET_SET = new Set([
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
]);

function isAlphabet(label: string): boolean {
  return ALPHABET_SET.has(label.toLowerCase());
}

function toGlossLabel(word: string): string | null {
  const normalized = word.toLowerCase().trim();

  if (WORD_TO_GLOSS[normalized]) {
    return WORD_TO_GLOSS[normalized];
  }

  if (normalized.length === 1 && /^[a-zñ]$/.test(normalized)) {
    const mapped: Record<string, string> = {
      a: "A", b: "B", c: "C", d: "D", e: "E", f: "F", g: "G", h: "H",
      i: "I", j: "J", k: "K", l: "L", m: "M", n: "N", ñ: "Ñ", ng: "NG",
      o: "O", p: "P", q: "Q", r: "R", s: "S", t: "T", u: "U", v: "V",
      w: "W", x: "X", y: "Y", z: "Z",
    };
    return mapped[normalized] ?? normalized.toUpperCase();
  }

  return normalized.toUpperCase();
}

export function mapWordToGesture(word: string): GestureMappingResult {
  const gloss = toGlossLabel(word);
  if (!gloss) {
    return {
      gloss: word.toUpperCase(),
      category: "unknown",
      animation: null,
      hasAnimation: false,
      isFingerSpelling: word.length === 1,
      label: word.toUpperCase(),
    };
  }

  const normalizedGloss = GLOSS_SYNONYM_NORMALIZATION[gloss] ?? gloss;
  const category = GESTURE_CATEGORIES[normalizedGloss] ?? "general";
  const isLetter = isAlphabet(normalizedGloss);

  return {
    gloss: normalizedGloss,
    category,
    animation: null,
    hasAnimation: false,
    isFingerSpelling: isLetter,
    label: normalizedGloss,
  };
}

export function createAnimationClip(
  gestureLabel: string,
  index: number,
): AnimationClip {
  return {
    id: `anim-${gestureLabel}-${index}-${Date.now()}`,
    gesture: gestureLabel,
    animation: null as any,
    metadata: {
      label: gestureLabel,
      category: isAlphabet(gestureLabel) ? "alphabet" : "phrase",
      difficulty: 1,
      meaning: gestureLabel,
    },
  };
}

export function getAllGestureLabels(): string[] {
  return [...new Set([...Object.keys(WORD_TO_GLOSS), ...Object.keys(GESTURE_CATEGORIES)])].sort();
}
