import type { GestureAnimation } from "@/features/animation/types";

const FINGER_SPELL_ANIMATIONS: Record<string, GestureAnimation> = {
  a: {
    version: 1, gesture: "A", duration: 1.0, fps: 30,
    keyframes: [
      { time: 0, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.3, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.4, y: -0.6, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.2, y: -0.8, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.15, y: -0.9, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.6, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
    ],
  },
  b: {
    version: 1, gesture: "B", duration: 1.0, fps: 30,
    keyframes: [
      { time: 0, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.3, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.3, y: -0.5, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.1, y: -0.6, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.05, y: -0.7, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.6, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
    ],
  },
  c: {
    version: 1, gesture: "C", duration: 1.0, fps: 30,
    keyframes: [
      { time: 0, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.3, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.2, y: -0.4, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: -0.1, y: -0.5, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: -0.15, y: -0.6, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.6, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
    ],
  },
  d: {
    version: 1, gesture: "D", duration: 1.0, fps: 30,
    keyframes: [
      { time: 0, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.3, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.35, y: -0.4, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.15, y: -0.5, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.1, y: -0.6, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.6, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
    ],
  },
  e: {
    version: 1, gesture: "E", duration: 1.0, fps: 30,
    keyframes: [
      { time: 0, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.3, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.45, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.4, y: -0.6, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.3, y: -0.7, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.25, y: -0.8, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.6, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
    ],
  },
  f: {
    version: 1, gesture: "F", duration: 1.0, fps: 30,
    keyframes: [
      { time: 0, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.3, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.4, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.5, y: -0.7, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.4, y: -0.9, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.35, y: -1.0, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.6, pose: { joints: { head: { x: 0, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
    ],
  },
};

const MORPHOLOGICAL_RULES: Array<{ suffix: string; replacement: string; minLength: number }> = [
  { suffix: "ing", replacement: "", minLength: 4 },
  { suffix: "ings", replacement: "", minLength: 5 },
  { suffix: "s", replacement: "", minLength: 4 },
  { suffix: "es", replacement: "", minLength: 5 },
  { suffix: "ed", replacement: "", minLength: 4 },
  { suffix: "er", replacement: "", minLength: 4 },
  { suffix: "est", replacement: "", minLength: 5 },
  { suffix: "ly", replacement: "", minLength: 5 },
  { suffix: "tion", replacement: "", minLength: 6 },
  { suffix: "ness", replacement: "", minLength: 6 },
  { suffix: "ment", replacement: "", minLength: 6 },
  { suffix: "able", replacement: "", minLength: 6 },
  { suffix: "ful", replacement: "", minLength: 5 },
  { suffix: "less", replacement: "", minLength: 6 },
  { suffix: "ous", replacement: "", minLength: 5 },
  { suffix: "ive", replacement: "", minLength: 5 },
  { suffix: "al", replacement: "", minLength: 5 },
  { suffix: "y", replacement: "", minLength: 5 },
];

export function simplifyMorphology(word: string): string {
  const lower = word.toLowerCase();
  for (const rule of MORPHOLOGICAL_RULES) {
    if (lower.endsWith(rule.suffix) && lower.length > rule.minLength) {
      const stem = lower.slice(0, -rule.suffix.length);
      if (stem.length >= 2) return stem;
    }
  }
  if (lower.endsWith("ies") && lower.length > 5) {
    return lower.slice(0, -3) + "y";
  }
  if (lower.endsWith("ied") && lower.length > 5) {
    return lower.slice(0, -3) + "y";
  }
  if (lower.endsWith("ves") && lower.length > 5) {
    return lower.slice(0, -3) + "f";
  }
  return lower;
}

export function fingerSpellAnimation(letter: string): GestureAnimation | null {
  const key = letter.toLowerCase();
  if (FINGER_SPELL_ANIMATIONS[key]) return FINGER_SPELL_ANIMATIONS[key];
  return FINGER_SPELL_ANIMATIONS[key] ?? null;
}

export function getUnknownPlaceholder(): GestureAnimation {
  return {
    version: 1,
    gesture: "???",
    duration: 0.8,
    fps: 30,
    keyframes: [
      { time: 0, pose: { joints: { head: { x: 0, y: -1.6, z: -0.1 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.4, pose: { joints: { head: { x: 0.05, y: -1.6, z: 0 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.4, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.6, y: -0.7, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.45, y: -1.0, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.4, y: -1.1, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
      { time: 0.8, pose: { joints: { head: { x: 0, y: -1.6, z: -0.1 }, neck: { x: 0, y: -1.2, z: 0 }, torso: { x: 0, y: -0.4, z: 0 }, leftShoulder: { x: -0.35, y: -0.5, z: 0 }, rightShoulder: { x: 0.35, y: -0.5, z: 0 }, leftElbow: { x: -0.55, y: -0.9, z: 0 }, rightElbow: { x: 0.55, y: -0.9, z: 0 }, leftWrist: { x: -0.55, y: -1.3, z: 0 }, rightWrist: { x: 0.55, y: -1.3, z: 0 }, leftHand: { x: -0.55, y: -1.4, z: 0 }, rightHand: { x: 0.55, y: -1.4, z: 0 }, leftHip: { x: -0.15, y: 0.2, z: 0 }, rightHip: { x: 0.15, y: 0.2, z: 0 } } } },
    ],
  };
}
